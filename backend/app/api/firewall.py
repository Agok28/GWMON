from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.gateway_firewall import ping_gateway
from app.models.firewall import (
    FirewallAuditResponse,
    FirewallRuleOut,
    FirewallRulesResponse,
    FirewallSettingsOut,
    FirewallSettingsUpdate,
    ManualBlockRequest,
    TrustedIpsResponse,
)
from app.models.user import User
from app.services import firewall_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/firewall", tags=["firewall"])

DBDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


@router.get("/rules", response_model=FirewallRulesResponse)
def list_rules(
    db: DBDep,
    _user: CurrentUser,
    status: str | None = Query(
        None,
        description="Filter by rule status (ACTIVE, EXPIRED, REMOVED, FAILED, PENDING)",
    ),
    limit: int = Query(500, ge=1, le=2000),
):
    return firewall_service.list_rules(db, status=status, limit=limit)


@router.post("/block", response_model=FirewallRuleOut, status_code=201)
def manual_block(body: ManualBlockRequest, db: DBDep, user: CurrentUser):
    try:
        return firewall_service.manual_block(
            db,
            ip_address=body.ip_address,
            duration_minutes=body.duration_minutes,
            reason=body.reason,
            actor=user.username,
        )
    except firewall_service.FirewallError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/unblock/{rule_id}", response_model=FirewallRuleOut)
def manual_unblock(rule_id: int, db: DBDep, user: CurrentUser):
    try:
        return firewall_service.manual_unblock(
            db, rule_id=rule_id, actor=user.username
        )
    except firewall_service.FirewallError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.delete("/rules/{rule_id}", response_model=FirewallRuleOut)
def remove_rule(rule_id: int, db: DBDep, user: CurrentUser):
    """Alias for unblock (matches the REST-style DELETE used in the spec)."""

    try:
        return firewall_service.manual_unblock(
            db, rule_id=rule_id, actor=user.username
        )
    except firewall_service.FirewallError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@router.get("/settings", response_model=FirewallSettingsOut)
def get_settings(db: DBDep, _user: CurrentUser):
    return firewall_service.get_settings(db)


@router.put("/settings", response_model=FirewallSettingsOut)
def update_settings(
    body: FirewallSettingsUpdate, db: DBDep, user: CurrentUser
):
    return firewall_service.update_settings(db, body, actor=user.username)


# ---------------------------------------------------------------------------
# Trusted IPs + audit + status
# ---------------------------------------------------------------------------


@router.get("/trusted-ips", response_model=TrustedIpsResponse)
def trusted_ips(db: DBDep, _user: CurrentUser):
    return firewall_service.list_trusted_ips(db)


@router.get("/audit", response_model=FirewallAuditResponse)
def audit(
    db: DBDep,
    _user: CurrentUser,
    limit: int = Query(200, ge=1, le=2000),
):
    return firewall_service.list_audit(db, limit=limit)


@router.get("/gateway-status")
def gateway_status(_user: CurrentUser):
    return {"reachable": ping_gateway()}
