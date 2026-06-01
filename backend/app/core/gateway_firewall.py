"""HTTP client for the on-gateway firewall-agent."""

from __future__ import annotations

import httpx

from app.core.config import get_settings


class GatewayFirewallError(RuntimeError):
    """Raised when the gateway firewall-agent cannot be reached or returns an error."""


def _post(path: str, ip: str) -> dict:
    settings = get_settings()
    url = f"{settings.gateway_firewall_url.rstrip('/')}{path}"
    payload = {"ip": ip, "token": settings.gateway_firewall_token}
    try:
        with httpx.Client(timeout=settings.gateway_firewall_timeout) as client:
            resp = client.post(url, json=payload)
    except httpx.HTTPError as exc:
        raise GatewayFirewallError(f"Gateway unreachable: {exc}") from exc

    if resp.status_code >= 400:
        raise GatewayFirewallError(
            f"Gateway returned HTTP {resp.status_code}: {resp.text.strip()[:200]}"
        )

    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


def block_ip(ip: str) -> dict:
    return _post("/block", ip)


def unblock_ip(ip: str) -> dict:
    return _post("/unblock", ip)


def ping_gateway() -> bool:
    settings = get_settings()
    url = f"{settings.gateway_firewall_url.rstrip('/')}/health"
    try:
        with httpx.Client(timeout=settings.gateway_firewall_timeout) as client:
            resp = client.get(url)
        return resp.status_code < 400
    except httpx.HTTPError:
        return False
