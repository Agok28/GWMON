from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from influxdb_client.client.query_api import QueryApi

from app.core.influxdb import get_query_api
from app.models.traffic import (
    FlowsResponse,
    ProtocolDistributionResponse,
    ProtocolOption,
    TopEndpointsResponse,
    TrafficSummaryResponse,
)
from app.models.user import User
from app.services import traffic_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/traffic", tags=["traffic"])

QueryAPIDep = Annotated[QueryApi, Depends(get_query_api)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _default_start() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)


def _default_stop() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/summary", response_model=TrafficSummaryResponse)
def traffic_summary(
    query_api: QueryAPIDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
    proto: str | None = Query(None, description="Protocol number filter (6, 17, 1)"),
    src_ip: str | None = Query(None, description="Source IP filter"),
    dst_ip: str | None = Query(None, description="Destination IP filter"),
):
    try:
        return traffic_service.get_traffic_summary(
            query_api=query_api,
            start=start or _default_start(),
            stop=stop or _default_stop(),
            proto=proto,
            src_ip=src_ip,
            dst_ip=dst_ip,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InfluxDB query failed: {exc}")


@router.get("/top-sources", response_model=TopEndpointsResponse)
def top_sources(
    query_api: QueryAPIDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
    limit: int = Query(10, ge=1, le=100, description="Number of results"),
):
    try:
        return traffic_service.get_top_sources(
            query_api=query_api,
            start=start or _default_start(),
            stop=stop or _default_stop(),
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InfluxDB query failed: {exc}")


@router.get("/top-destinations", response_model=TopEndpointsResponse)
def top_destinations(
    query_api: QueryAPIDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
    limit: int = Query(10, ge=1, le=100, description="Number of results"),
):
    try:
        return traffic_service.get_top_destinations(
            query_api=query_api,
            start=start or _default_start(),
            stop=stop or _default_stop(),
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InfluxDB query failed: {exc}")


@router.get("/flows", response_model=FlowsResponse)
def list_flows(
    query_api: QueryAPIDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
    proto: str | None = Query(None, description="Protocol number filter"),
    src_ip: str | None = Query(None, description="Source IP filter"),
    dst_ip: str | None = Query(None, description="Destination IP filter"),
    src_port: int | None = Query(None, ge=0, le=65535, description="Source port filter"),
    dst_port: int | None = Query(None, ge=0, le=65535, description="Destination port filter"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(200, ge=1, le=1000, description="Max rows to return"),
):
    try:
        return traffic_service.get_flows(
            query_api=query_api,
            start=start or _default_start(),
            stop=stop or _default_stop(),
            proto=proto,
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            offset=offset,
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InfluxDB query failed: {exc}")


@router.get("/protocols", response_model=list[ProtocolOption])
def available_protocols(query_api: QueryAPIDep, _user: CurrentUser):
    try:
        return traffic_service.get_available_protocols(query_api=query_api)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InfluxDB query failed: {exc}")


@router.get("/protocol-distribution", response_model=ProtocolDistributionResponse)
def protocol_distribution(
    query_api: QueryAPIDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
):
    try:
        return traffic_service.get_protocol_distribution(
            query_api=query_api,
            start=start or _default_start(),
            stop=stop or _default_stop(),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InfluxDB query failed: {exc}")
