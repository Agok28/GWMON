from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "GWMON API"
    debug: bool = False

    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = ""
    influxdb_org: str = "gwmon"
    influxdb_bucket: str = "traffic"

    database_url: str = "postgresql://postgres:postgres@localhost:5432/gwmon"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    cors_origins: list[str] = ["http://localhost:5173"]

    gateway_firewall_url: str = "http://192.168.56.101:8090"
    gateway_firewall_token: str = "RAGOCI"
    gateway_firewall_timeout: float = 5.0

    firewall_worker_interval_seconds: int = 30
    firewall_worker_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
