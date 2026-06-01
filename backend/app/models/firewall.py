from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


RuleAction = Literal["BLOCK", "UNBLOCK"]
RuleSource = Literal["MANUAL", "AUTOMATIC"]
RuleStatus = Literal["ACTIVE", "EXPIRED", "REMOVED", "FAILED", "PENDING"]


class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ip_address: Mapped[str] = mapped_column(String(45), index=True)
    action: Mapped[str] = mapped_column(String(16), default="BLOCK")
    source: Mapped[str] = mapped_column(String(16), default="MANUAL")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    removed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)


class FirewallSettings(Base):
    __tablename__ = "firewall_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auto_block_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    alert_threshold: Mapped[int] = mapped_column(Integer, default=10)
    time_window_minutes: Mapped[int] = mapped_column(Integer, default=5)
    block_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FirewallAuditLog(Base):
    __tablename__ = "firewall_audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True, index=True)
    action: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    rule_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor: Mapped[str | None] = mapped_column(String(100), nullable=True)


class TrustedIp(Base):
    __tablename__ = "trusted_ips"

    ip_address: Mapped[str] = mapped_column(String(45), primary_key=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class FirewallRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_address: str
    action: str
    source: str
    reason: str | None = None
    status: str
    created_at: datetime
    expires_at: datetime | None = None
    removed_at: datetime | None = None
    created_by: str | None = None


class FirewallRulesResponse(BaseModel):
    rules: list[FirewallRuleOut] = Field(default_factory=list)


class FirewallSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    auto_block_enabled: bool
    alert_threshold: int
    time_window_minutes: int
    block_duration_minutes: int
    updated_at: datetime | None = None


class FirewallSettingsUpdate(BaseModel):
    auto_block_enabled: bool | None = None
    alert_threshold: int | None = Field(default=None, ge=1, le=10_000)
    time_window_minutes: int | None = Field(default=None, ge=1, le=10_080)
    block_duration_minutes: int | None = Field(default=None, ge=1, le=10_080)


class ManualBlockRequest(BaseModel):
    ip_address: str
    duration_minutes: int = Field(ge=1, le=10_080)
    reason: str | None = None


class FirewallAuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    ip_address: str | None = None
    action: str | None = None
    status: str | None = None
    source: str | None = None
    rule_id: int | None = None
    message: str | None = None
    actor: str | None = None


class FirewallAuditResponse(BaseModel):
    entries: list[FirewallAuditEntry] = Field(default_factory=list)


class TrustedIpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ip_address: str
    description: str | None = None
    created_at: datetime


class TrustedIpsResponse(BaseModel):
    trusted_ips: list[TrustedIpOut] = Field(default_factory=list)
