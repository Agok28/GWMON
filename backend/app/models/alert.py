from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import BigInteger, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Alert(Base):
    __tablename__ = "ids_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    flow_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    in_iface: Mapped[str | None] = mapped_column(Text, nullable=True)
    src_ip: Mapped[str | None] = mapped_column(Text, nullable=True)
    src_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dest_ip: Mapped[str | None] = mapped_column(Text, nullable=True)
    dest_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proto: Mapped[str | None] = mapped_column(Text, nullable=True)
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    signature_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str | None] = mapped_column(Text, nullable=True)
    direction: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    src_ip: str | None = None
    src_port: int | None = None
    dest_ip: str | None = None
    dest_port: int | None = None
    proto: str | None = None
    signature: str | None = None
    signature_id: int | None = None
    category: str | None = None
    severity: int | None = None
    action: str | None = None
    direction: str | None = None


class AlertDetail(AlertOut):
    flow_id: int | None = None
    in_iface: str | None = None
    raw: dict[str, Any] | None = None


class AlertsResponse(BaseModel):
    offset: int
    limit: int
    total: int
    alerts: list[AlertOut] = Field(default_factory=list)


class AlertsSummary(BaseModel):
    total: int = 0
    critical: int = 0
    medium: int = 0
    low: int = 0


class TopSignature(BaseModel):
    signature: str
    count: int
    severity: int | None = None
