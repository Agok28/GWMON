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
