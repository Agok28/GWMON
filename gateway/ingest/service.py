"""NetFlow ingest service.

Reads nfcapd files from a configurable directory, converts them to JSON via
`nfdump -o json`, and writes both raw flow records and per-minute rollups
into InfluxDB. Intended to run on the Gateway VM as a systemd service
(see gwmon-ingest.service).

Configuration is loaded from a YAML file (see gwmon.yaml.example).
"""

import argparse
import json
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime, timezone

import yaml
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS


def run_nfdump_json(netflow_dir: str, limit: int = 200) -> list[dict]:
    cmd = ["nfdump", "-R", netflow_dir, "-o", "json"]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"nfdump failed: {p.stderr.strip()}")

    data = json.loads(p.stdout)

    if isinstance(data, list):
        flows = data
    elif isinstance(data, dict):
        flows = data.get("flows") or data.get("records") or []
    else:
        flows = []

    return flows[:limit]


def parse_flow_time(flow: dict) -> datetime:
    val = flow.get("received") or flow.get("last") or flow.get("first")
    if not val:
        return datetime.now(timezone.utc)

    if isinstance(val, (int, float)):
        return datetime.fromtimestamp(float(val), tz=timezone.utc)

    if isinstance(val, str):
        s = val.strip()
        for fmt in (
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        ):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                pass

    return datetime.now(timezone.utc)


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def make_influx_client(cfg: dict) -> tuple[InfluxDBClient, str, str]:
    influx = cfg.get("influxdb") or cfg.get("influx") or {}
    url = influx.get("url")
    org = influx.get("org")
    bucket = influx.get("bucket")
    token = influx.get("token")

    missing = [k for k, v in [("url", url), ("org", org), ("bucket", bucket), ("token", token)] if not v]
    if missing:
        raise RuntimeError(f"Missing Influx config keys: {missing}")

    client = InfluxDBClient(url=url, token=token, org=org)
    return client, org, bucket


def flow_to_points(flow: dict) -> list[Point]:
    src = flow.get("src4_addr") or flow.get("src_addr") or "unknown"
    dst = flow.get("dst4_addr") or flow.get("dst_addr") or "unknown"
    proto = str(flow.get("proto") or "unknown")

    src_port = flow.get("src_port") or 0
    dst_port = flow.get("dst_port") or 0
    bytes_v = flow.get("in_bytes") or flow.get("bytes") or 0
    pkts_v = flow.get("in_packets") or flow.get("packets") or 0

    try:
        src_port = int(src_port)
    except Exception:
        src_port = 0
    try:
        dst_port = int(dst_port)
    except Exception:
        dst_port = 0
    try:
        bytes_v = int(bytes_v)
    except Exception:
        bytes_v = 0
    try:
        pkts_v = int(pkts_v)
    except Exception:
        pkts_v = 0

    ts = parse_flow_time(flow)

    return [
        Point("flow")
        .tag("src_ip", str(src))
        .tag("dst_ip", str(dst))
        .tag("proto", proto)
        .field("src_port", src_port)
        .field("dst_port", dst_port)
        .field("bytes", bytes_v)
        .field("packets", pkts_v)
        .time(ts)
    ]


def flows_to_minute_rollups(flows: list[dict]) -> list[Point]:
    agg: dict[tuple[datetime, str], dict[str, int]] = {}

    for flow in flows:
        proto = str(flow.get("proto") or "unknown")
        bytes_v = flow.get("in_bytes") or flow.get("bytes") or 0
        pkts_v = flow.get("in_packets") or flow.get("packets") or 0

        try:
            bytes_v = int(bytes_v)
        except Exception:
            bytes_v = 0
        try:
            pkts_v = int(pkts_v)
        except Exception:
            pkts_v = 0

        ts = parse_flow_time(flow)
        minute_ts = ts.astimezone(timezone.utc).replace(second=0, microsecond=0)

        key = (minute_ts, proto)
        if key not in agg:
            agg[key] = {"bytes_sum": 0, "packets_sum": 0, "flows_count": 0}
        agg[key]["bytes_sum"] += bytes_v
        agg[key]["packets_sum"] += pkts_v
        agg[key]["flows_count"] += 1

        key_all = (minute_ts, "ALL")
        if key_all not in agg:
            agg[key_all] = {"bytes_sum": 0, "packets_sum": 0, "flows_count": 0}
        agg[key_all]["bytes_sum"] += bytes_v
        agg[key_all]["packets_sum"] += pkts_v
        agg[key_all]["flows_count"] += 1

    points: list[Point] = []
    for (minute_ts, proto), vals in agg.items():
        points.append(
            Point("traffic_minute")
            .tag("proto", proto)
            .field("bytes_sum", int(vals["bytes_sum"]))
            .field("packets_sum", int(vals["packets_sum"]))
            .field("flows_count", int(vals["flows_count"]))
            .time(minute_ts)
        )

    return points


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, help="Path to config YAML")
    ap.add_argument("--netflow-dir", default="/var/log/netflow", help="Directory with nfcapd files")
    ap.add_argument("--poll-seconds", type=int, default=10)
    ap.add_argument("--limit", type=int, default=300)

    args = ap.parse_args()
    netflow_dir = args.netflow_dir

    if not Path(netflow_dir).exists():
        print(f"[gwmon-ingest] ERROR: netflow dir not found: {netflow_dir}", file=sys.stderr)
        return 2

    try:
        cfg = load_config(args.config)
        client, org, bucket = make_influx_client(cfg)
    except Exception as e:
        print(f"[gwmon-ingest] ERROR loading config/influx: {e}", file=sys.stderr)
        return 3

    write_api = client.write_api(write_options=SYNCHRONOUS)

    print(
        f"[gwmon-ingest] started. netflow_dir={netflow_dir} poll={args.poll_seconds}s "
        f"bucket={bucket} org={org} limit={args.limit}"
    )

    last_seen_mtime = 0.0

    while True:
        newest = 0.0
        for f in Path(netflow_dir).glob("nfcapd.*"):
            try:
                newest = max(newest, f.stat().st_mtime)
            except FileNotFoundError:
                pass

        if newest > last_seen_mtime:
            last_seen_mtime = newest
            try:
                flows = run_nfdump_json(netflow_dir, limit=args.limit)
                print(f"[gwmon-ingest] new data detected. flows_sample={len(flows)}")

                raw_points: list[Point] = []
                for flow in flows:
                    raw_points.extend(flow_to_points(flow))

                rollup_points = flows_to_minute_rollups(flows)

                if raw_points:
                    write_api.write(bucket=bucket, org=org, record=raw_points)
                    print(f"[gwmon-ingest] wrote_points={len(raw_points)} measurement=flow")

                if rollup_points:
                    write_api.write(bucket=bucket, org=org, record=rollup_points)
                    print(f"[gwmon-ingest] wrote_points={len(rollup_points)} measurement=traffic_minute")

            except Exception as e:
                print(f"[gwmon-ingest] ERROR ingest/write: {e}", file=sys.stderr)

        time.sleep(args.poll_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
