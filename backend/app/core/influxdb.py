from influxdb_client import InfluxDBClient
from influxdb_client.client.query_api import QueryApi

from app.core.config import Settings, get_settings

_client: InfluxDBClient | None = None


def get_influxdb_client(settings: Settings | None = None) -> InfluxDBClient:
    global _client
    if _client is None:
        if settings is None:
            settings = get_settings()
        _client = InfluxDBClient(
            url=settings.influxdb_url,
            token=settings.influxdb_token,
            org=settings.influxdb_org,
        )
    return _client


def get_query_api(settings: Settings | None = None) -> QueryApi:
    return get_influxdb_client(settings).query_api()


def close_influxdb_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
