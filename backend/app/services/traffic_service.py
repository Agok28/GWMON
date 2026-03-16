from datetime import datetime, timezone

from influxdb_client.client.query_api import QueryApi

from app.core.config import get_settings
from app.models.traffic import (
    FlowRecord,
    FlowsResponse,
    ProtocolBucket,
    ProtocolDistributionResponse,
    ProtocolOption,
    TopEndpoint,
    TopEndpointsResponse,
    TrafficPoint,
    TrafficSummaryResponse,
)

PROTO_LABELS: dict[str, str] = {
    "0": "HOPOPT",
    "1": "ICMP",
    "2": "IGMP",
    "4": "IPv4",
    "6": "TCP",
    "8": "EGP",
    "17": "UDP",
    "27": "RDP",
    "41": "IPv6",
    "43": "IPv6-Route",
    "44": "IPv6-Frag",
    "47": "GRE",
    "50": "ESP",
    "51": "AH",
    "58": "ICMPv6",
    "59": "IPv6-NoNxt",
    "60": "IPv6-Opts",
    "89": "OSPF",
    "103": "PIM",
    "112": "VRRP",
    "132": "SCTP",
    "ALL": "ALL",
}


def _flux_time(dt: datetime) -> str:
    utc = dt.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def _base_flux(start: datetime, stop: datetime) -> str:
    return (
        f'from(bucket: "{get_settings().influxdb_bucket}")\n'
        f"  |> range(start: {_flux_time(start)}, stop: {_flux_time(stop)})\n"
        '  |> filter(fn: (r) => r._measurement == "traffic_minute")\n'
    )


def get_traffic_summary(
    query_api: QueryApi,
    start: datetime,
    stop: datetime,
    proto: str | None = None,
    src_ip: str | None = None,
    dst_ip: str | None = None,
) -> TrafficSummaryResponse:
    flux = _base_flux(start, stop)

    if proto:
        flux += f'  |> filter(fn: (r) => r.proto == "{proto}")\n'
    else:
        flux += '  |> filter(fn: (r) => r.proto == "ALL")\n'
    if src_ip:
        flux += f'  |> filter(fn: (r) => r.src_ip == "{src_ip}")\n'
    if dst_ip:
        flux += f'  |> filter(fn: (r) => r.dst_ip == "{dst_ip}")\n'

    flux += '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
    flux += '  |> sort(columns: ["_time"])\n'

    tables = query_api.query(flux, org=get_settings().influxdb_org)

    points: list[TrafficPoint] = []
    total_bytes = 0.0
    total_packets = 0.0
    total_flows = 0.0

    for table in tables:
        for record in table.records:
            b = float(record.values.get("bytes_sum", 0) or 0)
            p = float(record.values.get("packets_sum", 0) or 0)
            f = float(record.values.get("flows_count", 0) or 0)
            total_bytes += b
            total_packets += p
            total_flows += f
            points.append(
                TrafficPoint(
                    time=record.get_time(),
                    bytes_sum=b,
                    packets_sum=p,
                    flows_count=f,
                    proto=record.values.get("proto"),
                )
            )

    return TrafficSummaryResponse(
        start=start,
        stop=stop,
        total_bytes=total_bytes,
        total_packets=total_packets,
        total_flows=total_flows,
        points=points,
    )


def get_top_sources(
    query_api: QueryApi,
    start: datetime,
    stop: datetime,
    limit: int = 10,
) -> TopEndpointsResponse:
    flux = (
        f'from(bucket: "{get_settings().influxdb_bucket}")\n'
        f"  |> range(start: {_flux_time(start)}, stop: {_flux_time(stop)})\n"
        '  |> filter(fn: (r) => r._measurement == "flow")\n'
        '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
        '  |> group(columns: ["src_ip"])\n'
        '  |> reduce(\n'
        "      identity: {bytes_sum: 0.0, packets_sum: 0.0, flows_count: 0.0},\n"
        "      fn: (r, accumulator) => ({\n"
        "          bytes_sum: accumulator.bytes_sum + (if exists r.bytes then float(v: r.bytes) else 0.0),\n"
        "          packets_sum: accumulator.packets_sum + (if exists r.packets then float(v: r.packets) else 0.0),\n"
        "          flows_count: accumulator.flows_count + 1.0,\n"
        "      }),\n"
        "  )\n"
        "  |> group()\n"
        '  |> sort(columns: ["bytes_sum"], desc: true)\n'
        f"  |> limit(n: {limit})\n"
    )

    tables = query_api.query(flux, org=get_settings().influxdb_org)

    endpoints: list[TopEndpoint] = []
    for table in tables:
        for record in table.records:
            endpoints.append(
                TopEndpoint(
                    ip=record.values.get("src_ip", "unknown"),
                    bytes_sum=float(record.values.get("bytes_sum", 0) or 0),
                    packets_sum=float(record.values.get("packets_sum", 0) or 0),
                    flows_count=float(record.values.get("flows_count", 0) or 0),
                )
            )

    return TopEndpointsResponse(start=start, stop=stop, endpoints=endpoints)


def get_top_destinations(
    query_api: QueryApi,
    start: datetime,
    stop: datetime,
    limit: int = 10,
) -> TopEndpointsResponse:
    flux = (
        f'from(bucket: "{get_settings().influxdb_bucket}")\n'
        f"  |> range(start: {_flux_time(start)}, stop: {_flux_time(stop)})\n"
        '  |> filter(fn: (r) => r._measurement == "flow")\n'
        '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
        '  |> group(columns: ["dst_ip"])\n'
        '  |> reduce(\n'
        "      identity: {bytes_sum: 0.0, packets_sum: 0.0, flows_count: 0.0},\n"
        "      fn: (r, accumulator) => ({\n"
        "          bytes_sum: accumulator.bytes_sum + (if exists r.bytes then float(v: r.bytes) else 0.0),\n"
        "          packets_sum: accumulator.packets_sum + (if exists r.packets then float(v: r.packets) else 0.0),\n"
        "          flows_count: accumulator.flows_count + 1.0,\n"
        "      }),\n"
        "  )\n"
        "  |> group()\n"
        '  |> sort(columns: ["bytes_sum"], desc: true)\n'
        f"  |> limit(n: {limit})\n"
    )

    tables = query_api.query(flux, org=get_settings().influxdb_org)

    endpoints: list[TopEndpoint] = []
    for table in tables:
        for record in table.records:
            endpoints.append(
                TopEndpoint(
                    ip=record.values.get("dst_ip", "unknown"),
                    bytes_sum=float(record.values.get("bytes_sum", 0) or 0),
                    packets_sum=float(record.values.get("packets_sum", 0) or 0),
                    flows_count=float(record.values.get("flows_count", 0) or 0),
                )
            )

    return TopEndpointsResponse(start=start, stop=stop, endpoints=endpoints)


def get_protocol_distribution(
    query_api: QueryApi,
    start: datetime,
    stop: datetime,
) -> ProtocolDistributionResponse:
    flux = _base_flux(start, stop)
    flux += '  |> filter(fn: (r) => r.proto != "ALL")\n'
    flux += '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
    flux += '  |> group(columns: ["proto"])\n'
    flux += (
        "  |> reduce(\n"
        "      identity: {bytes_sum: 0.0, packets_sum: 0.0, flows_count: 0.0},\n"
        "      fn: (r, accumulator) => ({\n"
        "          bytes_sum: accumulator.bytes_sum + (if exists r.bytes_sum then float(v: r.bytes_sum) else 0.0),\n"
        "          packets_sum: accumulator.packets_sum + (if exists r.packets_sum then float(v: r.packets_sum) else 0.0),\n"
        "          flows_count: accumulator.flows_count + (if exists r.flows_count then float(v: r.flows_count) else 0.0),\n"
        "      }),\n"
        "  )\n"
    )
    flux += "  |> group()\n"
    flux += '  |> sort(columns: ["bytes_sum"], desc: true)\n'

    tables = query_api.query(flux, org=get_settings().influxdb_org)

    protocols: list[ProtocolBucket] = []
    for table in tables:
        for record in table.records:
            proto = str(record.values.get("proto", ""))
            protocols.append(
                ProtocolBucket(
                    proto=proto,
                    label=PROTO_LABELS.get(proto, f"Proto {proto}"),
                    bytes_sum=float(record.values.get("bytes_sum", 0) or 0),
                    packets_sum=float(record.values.get("packets_sum", 0) or 0),
                    flows_count=float(record.values.get("flows_count", 0) or 0),
                )
            )

    return ProtocolDistributionResponse(start=start, stop=stop, protocols=protocols)


def _split_endpoint(value: str) -> tuple[str, int]:
    ip, _, port = value.rpartition(":")
    if ip:
        try:
            return ip, int(port)
        except ValueError:
            pass
    return value, 0


def _compute_direction(src_ip: str, dst_ip: str) -> str:
    src_private = src_ip.startswith(("192.168.", "10.", "172.16."))
    dst_private = dst_ip.startswith(("192.168.", "10.", "172.16."))
    if src_private and dst_private:
        return "internal"
    if dst_private:
        return "inbound"
    if src_private:
        return "outbound"
    return "external"


_PROTOS_WITH_PORTS = {"6", "17"}


def get_flows(
    query_api: QueryApi,
    start: datetime,
    stop: datetime,
    proto: str | None = None,
    src_ip: str | None = None,
    dst_ip: str | None = None,
    offset: int = 0,
    limit: int = 200,
) -> FlowsResponse:
    flux = (
        f'from(bucket: "{get_settings().influxdb_bucket}")\n'
        f"  |> range(start: {_flux_time(start)}, stop: {_flux_time(stop)})\n"
        '  |> filter(fn: (r) => r._measurement == "flow")\n'
    )

    if proto:
        flux += f'  |> filter(fn: (r) => r.proto == "{proto}")\n'
    if src_ip:
        flux += (
            f'  |> filter(fn: (r) => strings.containsStr(v: r.src_ip, substr: "{src_ip}"))\n'
        )
    if dst_ip:
        flux += (
            f'  |> filter(fn: (r) => strings.containsStr(v: r.dst_ip, substr: "{dst_ip}"))\n'
        )

    if src_ip or dst_ip:
        flux = f'import "strings"\n' + flux

    flux += '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
    flux += '  |> sort(columns: ["_time"], desc: true)\n'
    fetch_n = offset + limit
    flux += f"  |> limit(n: {fetch_n})\n"

    tables = query_api.query(flux, org=get_settings().influxdb_org)

    all_records: list[FlowRecord] = []
    for table in tables:
        for record in table.records:
            raw_src = record.values.get("src_ip", "unknown")
            raw_dst = record.values.get("dst_ip", "unknown")
            p = str(record.values.get("proto", ""))

            if p in _PROTOS_WITH_PORTS:
                src_ip_parsed, src_port = _split_endpoint(raw_src)
                dst_ip_parsed, dst_port = _split_endpoint(raw_dst)
            else:
                src_ip_parsed, src_port = raw_src, 0
                dst_ip_parsed, dst_port = raw_dst, 0

            all_records.append(
                FlowRecord(
                    time=record.get_time(),
                    src_ip=src_ip_parsed,
                    src_port=src_port,
                    dst_ip=dst_ip_parsed,
                    dst_port=dst_port,
                    proto=p,
                    proto_label=PROTO_LABELS.get(p, f"Proto {p}"),
                    bytes=float(record.values.get("bytes", 0) or 0),
                    packets=float(record.values.get("packets", 0) or 0),
                    direction=_compute_direction(src_ip_parsed, dst_ip_parsed),
                )
            )

    page = all_records[offset : offset + limit]
    return FlowsResponse(
        start=start, stop=stop, offset=offset, limit=limit, flows=page,
    )


def get_available_protocols(query_api: QueryApi) -> list[ProtocolOption]:
    flux = (
        f'import "influxdata/influxdb/schema"\n'
        f'schema.tagValues(\n'
        f'    bucket: "{get_settings().influxdb_bucket}",\n'
        f'    tag: "proto",\n'
        f'    predicate: (r) => r._measurement == "traffic_minute",\n'
        f")\n"
    )

    tables = query_api.query(flux, org=get_settings().influxdb_org)

    options: list[ProtocolOption] = []
    for table in tables:
        for record in table.records:
            proto = str(record.get_value())
            if proto == "ALL":
                continue
            label = PROTO_LABELS.get(proto, f"Proto {proto}")
            options.append(ProtocolOption(proto=proto, label=label))

    options.sort(key=lambda o: o.label)
    return options
