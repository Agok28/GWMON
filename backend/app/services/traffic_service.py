from datetime import datetime

from influxdb_client.client.query_api import QueryApi

from app.core.config import get_settings
from app.models.traffic import (
    ProtocolBucket,
    ProtocolDistributionResponse,
    TopEndpoint,
    TopEndpointsResponse,
    TrafficPoint,
    TrafficSummaryResponse,
)

PROTO_LABELS: dict[str, str] = {
    "6": "TCP",
    "17": "UDP",
    "1": "ICMP",
    "ALL": "ALL",
}


def _base_flux(start: datetime, stop: datetime) -> str:
    return (
        f'from(bucket: "{get_settings().influxdb_bucket}")\n'
        f"  |> range(start: {start.isoformat()}Z, stop: {stop.isoformat()}Z)\n"
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
    if src_ip:
        flux += f'  |> filter(fn: (r) => r.src4_addr == "{src_ip}")\n'
    if dst_ip:
        flux += f'  |> filter(fn: (r) => r.dst4_addr == "{dst_ip}")\n'

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
        f"  |> range(start: {start.isoformat()}Z, stop: {stop.isoformat()}Z)\n"
        '  |> filter(fn: (r) => r._measurement == "flow")\n'
        '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
        '  |> group(columns: ["src4_addr"])\n'
        '  |> reduce(\n'
        "      identity: {bytes_sum: 0.0, packets_sum: 0.0, flows_count: 0.0},\n"
        "      fn: (r, accumulator) => ({\n"
        "          bytes_sum: accumulator.bytes_sum + (if exists r.in_bytes then r.in_bytes else 0.0),\n"
        "          packets_sum: accumulator.packets_sum + (if exists r.in_packets then r.in_packets else 0.0),\n"
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
                    ip=record.values.get("src4_addr", "unknown"),
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
        f"  |> range(start: {start.isoformat()}Z, stop: {stop.isoformat()}Z)\n"
        '  |> filter(fn: (r) => r._measurement == "flow")\n'
        '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
        '  |> group(columns: ["dst4_addr"])\n'
        '  |> reduce(\n'
        "      identity: {bytes_sum: 0.0, packets_sum: 0.0, flows_count: 0.0},\n"
        "      fn: (r, accumulator) => ({\n"
        "          bytes_sum: accumulator.bytes_sum + (if exists r.in_bytes then r.in_bytes else 0.0),\n"
        "          packets_sum: accumulator.packets_sum + (if exists r.in_packets then r.in_packets else 0.0),\n"
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
                    ip=record.values.get("dst4_addr", "unknown"),
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
        "          bytes_sum: accumulator.bytes_sum + (if exists r.bytes_sum then r.bytes_sum else 0.0),\n"
        "          packets_sum: accumulator.packets_sum + (if exists r.packets_sum then r.packets_sum else 0.0),\n"
        "          flows_count: accumulator.flows_count + (if exists r.flows_count then r.flows_count else 0.0),\n"
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
