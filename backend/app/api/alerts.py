from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.alert import (
    AlertDetail,
    AlertsResponse,
    AlertsSummary,
    TopSignature,
)
from app.models.user import User
from app.services import alerts_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])

DBDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _default_start() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=7)


def _default_stop() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=AlertsResponse)
def list_alerts(
    db: DBDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
    severity: int | None = Query(None, ge=1, le=5, description="Exact severity (1-5)"),
    src_ip: str | None = Query(None, description="Exact source IP"),
    dest_ip: str | None = Query(None, description="Exact destination IP"),
    signature: str | None = Query(None, description="Signature substring (ILIKE)"),
    q: str | None = Query(None, description="Free-text search (signature/category/ips)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(200, ge=1, le=1000, description="Max rows to return"),
):
    try:
        return alerts_service.list_alerts(
            db=db,
            start=start or _default_start(),
            stop=stop or _default_stop(),
            severity=severity,
            src_ip=src_ip,
            dest_ip=dest_ip,
            signature=signature,
            q=q,
            offset=offset,
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Alerts query failed: {exc}")


@router.get("/summary", response_model=AlertsSummary)
def alerts_summary(
    db: DBDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
):
    try:
        return alerts_service.get_alerts_summary(
            db=db,
            start=start or _default_start(),
            stop=stop or _default_stop(),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Alerts query failed: {exc}")


@router.get("/top-signatures", response_model=list[TopSignature])
def top_signatures(
    db: DBDep,
    _user: CurrentUser,
    start: datetime | None = Query(None, description="ISO 8601 start time"),
    stop: datetime | None = Query(None, description="ISO 8601 stop time"),
    limit: int = Query(10, ge=1, le=100, description="Number of results"),
):
    try:
        return alerts_service.get_top_signatures(
            db=db,
            start=start or _default_start(),
            stop=stop or _default_stop(),
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Alerts query failed: {exc}")


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(alert_id: int, db: DBDep, _user: CurrentUser):
    alert = alerts_service.get_alert_by_id(db=db, alert_id=alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
