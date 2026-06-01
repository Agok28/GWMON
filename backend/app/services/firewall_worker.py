"""Periodic background task that runs auto-block + expiration sweeps."""

from __future__ import annotations

import asyncio
import logging

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.firewall_service import expire_due_rules, run_auto_block_scan

logger = logging.getLogger(__name__)


async def _tick() -> None:
    db = SessionLocal()
    try:
        try:
            expired = expire_due_rules(db)
            if expired:
                logger.info("firewall worker: expired %d rule(s)", expired)
        except Exception:
            logger.exception("firewall worker: expire_due_rules failed")

        try:
            created = run_auto_block_scan(db)
            if created:
                logger.info("firewall worker: auto-blocked %d new IP(s)", created)
        except Exception:
            logger.exception("firewall worker: run_auto_block_scan failed")
    finally:
        db.close()


async def firewall_worker_loop() -> None:
    settings = get_settings()
    interval = max(5, int(settings.firewall_worker_interval_seconds))
    logger.info(
        "firewall worker started (interval=%ss, enabled=%s)",
        interval,
        settings.firewall_worker_enabled,
    )
    try:
        while True:
            if settings.firewall_worker_enabled:
                await _tick()
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("firewall worker cancelled, exiting")
        raise
