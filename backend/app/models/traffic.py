from datetime import datetime
from pydantic import BaseModel, Field


class TrafficPoint(BaseModel):
    time: datetime
    bytes_sum: float = 0.0
    packets_sum: float = 0.0
    flows_count: float = 0.0
    proto: str | None = None


class TrafficSummaryResponse(BaseModel):
    start: datetime
    stop: datetime
    total_bytes: float = 0.0
    total_packets: float = 0.0
    total_flows: float = 0.0
    points: list[TrafficPoint] = Field(default_factory=list)


class TopEndpoint(BaseModel):
    ip: str
    bytes_sum: float = 0.0
    packets_sum: float = 0.0
    flows_count: float = 0.0


class TopEndpointsResponse(BaseModel):
    start: datetime
    stop: datetime
    endpoints: list[TopEndpoint] = Field(default_factory=list)


class ProtocolOption(BaseModel):
    proto: str
    label: str


class ProtocolBucket(BaseModel):
    proto: str
    label: str
    bytes_sum: float = 0.0
    packets_sum: float = 0.0
    flows_count: float = 0.0


class ProtocolDistributionResponse(BaseModel):
    start: datetime
    stop: datetime
    protocols: list[ProtocolBucket] = Field(default_factory=list)


class FlowRecord(BaseModel):
    time: datetime
    src_ip: str
    src_port: int = 0
    dst_ip: str
    dst_port: int = 0
    proto: str
    proto_label: str
    bytes: float = 0.0
    packets: float = 0.0
    direction: str


class FlowsResponse(BaseModel):
    start: datetime
    stop: datetime
    offset: int
    limit: int
    flows: list[FlowRecord] = Field(default_factory=list)
