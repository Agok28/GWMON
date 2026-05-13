from datetime import datetime

from sqlalchemy import and_, case, desc, func, select
from sqlalchemy.orm import Session

from app.models.alert import (
    Alert,
    AlertDetail,
    AlertOut,
    AlertsResponse,
    AlertsSummary,
    TopSignature,
)


def _time_window(start: datetime | None, stop: datetime | None) -> list:
    clauses = []
    if start is not None:
        clauses.append(Alert.timestamp >= start)
    if stop is not None:
        clauses.append(Alert.timestamp <= stop)
    return clauses


def list_alerts(
    db: Session,
    start: datetime | None = None,
    stop: datetime | None = None,
    severity: int | None = None,
    src_ip: str | None = None,
    dest_ip: str | None = None,
    signature: str | None = None,
    q: str | None = None,
    offset: int = 0,
    limit: int = 200,
) -> AlertsResponse:
    clauses = _time_window(start, stop)

    if severity is not None:
        clauses.append(Alert.severity == severity)
    if src_ip:
        clauses.append(Alert.src_ip == src_ip)
    if dest_ip:
        clauses.append(Alert.dest_ip == dest_ip)
    if signature:
        clauses.append(Alert.signature.ilike(f"%{signature}%"))
    if q:
        pattern = f"%{q}%"
        clauses.append(
            (Alert.signature.ilike(pattern))
            | (Alert.category.ilike(pattern))
            | (Alert.src_ip.ilike(pattern))
            | (Alert.dest_ip.ilike(pattern))
        )

    where = and_(*clauses) if clauses else None

    total = db.execute(
        select(func.count()).select_from(Alert).where(where) if where is not None
        else select(func.count()).select_from(Alert)
    ).scalar_one()

    stmt = select(Alert)
    if where is not None:
        stmt = stmt.where(where)
    stmt = stmt.order_by(desc(Alert.timestamp)).offset(offset).limit(limit)

    rows = db.execute(stmt).scalars().all()

    return AlertsResponse(
        offset=offset,
        limit=limit,
        total=int(total or 0),
        alerts=[AlertOut.model_validate(r) for r in rows],
    )


def get_alerts_summary(
    db: Session,
    start: datetime | None = None,
    stop: datetime | None = None,
) -> AlertsSummary:
    clauses = _time_window(start, stop)
    where = and_(*clauses) if clauses else None

    critical_expr = func.coalesce(
        func.sum(case((Alert.severity == 1, 1), else_=0)), 0
    )
    medium_expr = func.coalesce(
        func.sum(case((Alert.severity.in_([2, 3]), 1), else_=0)), 0
    )
    low_expr = func.coalesce(
        func.sum(case((Alert.severity >= 4, 1), else_=0)), 0
    )
    total_expr = func.count()

    stmt = select(total_expr, critical_expr, medium_expr, low_expr)
    if where is not None:
        stmt = stmt.where(where)

    total, critical, medium, low = db.execute(stmt).one()

    return AlertsSummary(
        total=int(total or 0),
        critical=int(critical or 0),
        medium=int(medium or 0),
        low=int(low or 0),
    )


def get_top_signatures(
    db: Session,
    start: datetime | None = None,
    stop: datetime | None = None,
    limit: int = 10,
) -> list[TopSignature]:
    clauses = _time_window(start, stop)
    clauses.append(Alert.signature.is_not(None))
    where = and_(*clauses)

    count_col = func.count().label("count")
    min_sev_col = func.min(Alert.severity).label("severity")

    stmt = (
        select(Alert.signature, count_col, min_sev_col)
        .where(where)
        .group_by(Alert.signature)
        .order_by(desc(count_col))
        .limit(limit)
    )

    rows = db.execute(stmt).all()
    return [
        TopSignature(signature=row[0], count=int(row[1]), severity=row[2])
        for row in rows
    ]


def get_alert_by_id(db: Session, alert_id: int) -> AlertDetail | None:
    row = db.get(Alert, alert_id)
    if row is None:
        return None
    return AlertDetail.model_validate(row)
