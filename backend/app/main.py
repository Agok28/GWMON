from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.traffic import router as traffic_router
from app.core.config import get_settings
from app.core.influxdb import close_influxdb_client


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
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

app.include_router(traffic_router)


@app.get("/health")
def health():
    return {"status": "ok"}
