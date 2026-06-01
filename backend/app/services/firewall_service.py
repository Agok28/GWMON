"""Business logic for the firewall / Access Rules feature."""

from __future__ import annotations

import ipaddress
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.core.gateway_firewall import GatewayFirewallError, block_ip, unblock_ip
from app.models.alert import Alert
from app.models.firewall import (
    FirewallAuditEntry,
    FirewallAuditLog,
    FirewallAuditResponse,
    FirewallRule,
    FirewallRuleOut,
    FirewallRulesResponse,
    FirewallSettings,
    FirewallSettingsOut,
    FirewallSettingsUpdate,
    TrustedIp,
    TrustedIpOut,
    TrustedIpsResponse,
)

logger = logging.getLogger(__name__)


# Default trusted IPs seeded on first startup.
DEFAULT_TRUSTED_IPS: list[tuple[str, str]] = [
    ("192.168.100.1", "Gateway LAN IP"),
    ("192.168.56.101", "Gateway management IP"),
    ("192.168.56.1", "Host laptop / VirtualBox host-only IP"),
    ("127.0.0.1", "Localhost"),
]


class FirewallError(Exception):
    """Raised for user-facing firewall errors (returned as HTTP 400/409)."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_ip(ip: str) -> str:
    try:
        addr = ipaddress.ip_address(ip.strip())
    except ValueError as exc:
        raise FirewallError(f"Invalid IP address: {ip}") from exc
    return str(addr)


def is_trusted_ip(db: Session, ip: str) -> bool:
    row = db.execute(
        select(TrustedIp.ip_address).where(TrustedIp.ip_address == ip)
    ).first()
    return row is not None


def _active_rule_for(db: Session, ip: str) -> FirewallRule | None:
    return db.execute(
        select(FirewallRule).where(
            and_(FirewallRule.ip_address == ip, FirewallRule.status == "ACTIVE")
        )
    ).scalar_one_or_none()


def _audit(
    db: Session,
    *,
    ip: str | None,
    action: str,
    status: str,
    source: str | None = None,
    rule_id: int | None = None,
    message: str | None = None,
    actor: str | None = None,
) -> None:
    entry = FirewallAuditLog(
        ip_address=ip,
        action=action,
        status=status,
        source=source,
        rule_id=rule_id,
        message=message,
        actor=actor,
    )
    db.add(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------


def seed_defaults(db: Session) -> None:
    """Insert default settings row and trusted IPs if missing. Idempotent."""

    settings = db.execute(select(FirewallSettings).limit(1)).scalar_one_or_none()
    if settings is None:
        db.add(
            FirewallSettings(
                auto_block_enabled=False,
                alert_threshold=10,
                time_window_minutes=5,
                block_duration_minutes=30,
            )
        )
        db.commit()

    for ip, description in DEFAULT_TRUSTED_IPS:
        exists = db.execute(
            select(TrustedIp.ip_address).where(TrustedIp.ip_address == ip)
        ).first()
        if not exists:
            db.add(TrustedIp(ip_address=ip, description=description))
    db.commit()


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


def _get_settings_row(db: Session) -> FirewallSettings:
    row = db.execute(select(FirewallSettings).limit(1)).scalar_one_or_none()
    if row is None:
        row = FirewallSettings()
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_settings(db: Session) -> FirewallSettingsOut:
    return FirewallSettingsOut.model_validate(_get_settings_row(db))


def update_settings(
    db: Session, payload: FirewallSettingsUpdate, actor: str | None = None
) -> FirewallSettingsOut:
    row = _get_settings_row(db)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    _audit(
        db,
        ip=None,
        action="SETTINGS_UPDATE",
        status="OK",
        message=str(data),
        actor=actor,
    )
    return FirewallSettingsOut.model_validate(row)


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


def list_rules(
    db: Session, *, status: str | None = None, limit: int = 500
) -> FirewallRulesResponse:
    stmt = select(FirewallRule).order_by(desc(FirewallRule.created_at)).limit(limit)
    if status:
        stmt = (
            select(FirewallRule)
            .where(FirewallRule.status == status)
            .order_by(desc(FirewallRule.created_at))
            .limit(limit)
        )
    rows = db.execute(stmt).scalars().all()
    return FirewallRulesResponse(
        rules=[FirewallRuleOut.model_validate(r) for r in rows]
    )


def list_trusted_ips(db: Session) -> TrustedIpsResponse:
    rows = (
        db.execute(select(TrustedIp).order_by(TrustedIp.ip_address)).scalars().all()
    )
    return TrustedIpsResponse(
        trusted_ips=[TrustedIpOut.model_validate(r) for r in rows]
    )


def list_audit(db: Session, *, limit: int = 200) -> FirewallAuditResponse:
    rows = (
        db.execute(
            select(FirewallAuditLog)
            .order_by(desc(FirewallAuditLog.created_at))
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return FirewallAuditResponse(
        entries=[FirewallAuditEntry.model_validate(r) for r in rows]
    )


# ---------------------------------------------------------------------------
# Manual block / unblock
# ---------------------------------------------------------------------------


def manual_block(
    db: Session,
    *,
    ip_address: str,
    duration_minutes: int,
    reason: str | None,
    actor: str | None = None,
) -> FirewallRuleOut:
    ip = _validate_ip(ip_address)

    if is_trusted_ip(db, ip):
        _audit(
            db,
            ip=ip,
            action="BLOCK_REJECTED",
            status="TRUSTED",
            source="MANUAL",
            message="Trusted/protected IP cannot be blocked.",
            actor=actor,
        )
        raise FirewallError(
            "This IP is trusted/protected and cannot be blocked.", status_code=400
        )

    if _active_rule_for(db, ip):
        raise FirewallError(
            f"An active block rule already exists for {ip}.", status_code=409
        )

    expires = _utcnow() + timedelta(minutes=duration_minutes)
    rule = FirewallRule(
        ip_address=ip,
        action="BLOCK",
        source="MANUAL",
        reason=reason,
        status="PENDING",
        expires_at=expires,
        created_by=actor,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    try:
        block_ip(ip)
    except GatewayFirewallError as exc:
        rule.status = "FAILED"
        db.commit()
        _audit(
            db,
            ip=ip,
            action="BLOCK",
            status="FAILED",
            source="MANUAL",
            rule_id=rule.id,
            message=str(exc),
            actor=actor,
        )
        raise FirewallError(f"Gateway error: {exc}", status_code=502) from exc

    rule.status = "ACTIVE"
    db.commit()
    db.refresh(rule)

    _audit(
        db,
        ip=ip,
        action="BLOCK",
        status="ACTIVE",
        source="MANUAL",
        rule_id=rule.id,
        message=reason,
        actor=actor,
    )
    return FirewallRuleOut.model_validate(rule)


def manual_unblock(
    db: Session, *, rule_id: int, actor: str | None = None
) -> FirewallRuleOut:
    rule = db.get(FirewallRule, rule_id)
    if rule is None:
        raise FirewallError("Rule not found.", status_code=404)
    if rule.status != "ACTIVE":
        raise FirewallError(
            f"Rule is not ACTIVE (current status: {rule.status}).", status_code=409
        )

    try:
        unblock_ip(rule.ip_address)
    except GatewayFirewallError as exc:
        _audit(
            db,
            ip=rule.ip_address,
            action="UNBLOCK",
            status="FAILED",
            source=rule.source,
            rule_id=rule.id,
            message=str(exc),
            actor=actor,
        )
        raise FirewallError(f"Gateway error: {exc}", status_code=502) from exc

    rule.status = "REMOVED"
    rule.removed_at = _utcnow()
    db.commit()
    db.refresh(rule)

    _audit(
        db,
        ip=rule.ip_address,
        action="UNBLOCK",
        status="REMOVED",
        source=rule.source,
        rule_id=rule.id,
        message="Manual unblock",
        actor=actor,
    )
    return FirewallRuleOut.model_validate(rule)


# ---------------------------------------------------------------------------
# Background worker logic
# ---------------------------------------------------------------------------


def expire_due_rules(db: Session) -> int:
    """Find ACTIVE rules whose expires_at has passed and unblock them on the gateway.

    Returns the count of rules processed.
    """

    now = _utcnow()
    due = (
        db.execute(
            select(FirewallRule).where(
                and_(
                    FirewallRule.status == "ACTIVE",
                    FirewallRule.expires_at.is_not(None),
                    FirewallRule.expires_at <= now,
                )
            )
        )
        .scalars()
        .all()
    )

    processed = 0
    for rule in due:
        try:
            unblock_ip(rule.ip_address)
        except GatewayFirewallError as exc:
            _audit(
                db,
                ip=rule.ip_address,
                action="EXPIRE",
                status="FAILED",
                source=rule.source,
                rule_id=rule.id,
                message=str(exc),
            )
            continue

        rule.status = "EXPIRED"
        rule.removed_at = _utcnow()
        db.commit()
        _audit(
            db,
            ip=rule.ip_address,
            action="EXPIRE",
            status="EXPIRED",
            source=rule.source,
            rule_id=rule.id,
            message="Rule expired",
        )
        processed += 1

    return processed


def run_auto_block_scan(db: Session) -> int:
    """If auto-blocking is enabled, scan recent IDS alerts and create block rules
    for offending source IPs (excluding trusted IPs and already-active rules).

    Returns the count of new rules created.
    """

    cfg = _get_settings_row(db)
    if not cfg.auto_block_enabled:
        return 0

    window_start = _utcnow() - timedelta(minutes=cfg.time_window_minutes)
    threshold = cfg.alert_threshold

    rows = db.execute(
        select(Alert.src_ip, func.count().label("hits"))
        .where(
            and_(
                Alert.timestamp >= window_start,
                Alert.src_ip.is_not(None),
                Alert.src_ip.notin_(select(TrustedIp.ip_address)),
            )
        )
        .group_by(Alert.src_ip)
        .having(func.count() >= threshold)
        .order_by(desc(func.count()))
    ).all()

    created = 0
    for src_ip, hits in rows:
        if not src_ip:
            continue
        if is_trusted_ip(db, src_ip):
            continue
        if _active_rule_for(db, src_ip):
            continue

        expires = _utcnow() + timedelta(minutes=cfg.block_duration_minutes)
        rule = FirewallRule(
            ip_address=src_ip,
            action="BLOCK",
            source="AUTOMATIC",
            reason=(
                f"Automatic block: {int(hits)} IDS hits in last "
                f"{cfg.time_window_minutes}m (threshold {threshold})"
            ),
            status="PENDING",
            expires_at=expires,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        try:
            block_ip(src_ip)
        except GatewayFirewallError as exc:
            rule.status = "FAILED"
            db.commit()
            _audit(
                db,
                ip=src_ip,
                action="BLOCK",
                status="FAILED",
                source="AUTOMATIC",
                rule_id=rule.id,
                message=str(exc),
            )
            continue

        rule.status = "ACTIVE"
        db.commit()
        _audit(
            db,
            ip=src_ip,
            action="BLOCK",
            status="ACTIVE",
            source="AUTOMATIC",
            rule_id=rule.id,
            message=rule.reason,
        )
        created += 1

    return created
