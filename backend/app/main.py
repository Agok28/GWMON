import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.firewall import router as firewall_router
from app.api.traffic import router as traffic_router
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.influxdb import close_influxdb_client
from app.models.alert import Alert  # noqa: F401 — ensure model is registered
from app.models.firewall import (  # noqa: F401 — ensure models are registered
    FirewallAuditLog,
    FirewallRule,
    FirewallSettings,
    TrustedIp,
)
from app.models.user import User  # noqa: F401 — ensure model is registered
from app.services.firewall_service import seed_defaults
from app.services.firewall_worker import firewall_worker_loop

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_defaults(db)
    except Exception:
        logger.exception("firewall: seed_defaults failed")
    finally:
        db.close()

    worker_task = asyncio.create_task(firewall_worker_loop())
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
        close_influxdb_client()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(traffic_router)
app.include_router(alerts_router)
app.include_router(firewall_router)


@app.get("/health")
def health():
    return {"status": "ok"}
