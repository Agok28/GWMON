"""GWMON firewall agent.

Small FastAPI service that runs on the Gateway VM and is the *only*
component allowed to invoke ``iptables``. Exposes three endpoints on
port 8090:

    GET  /health            - liveness probe.
    POST /block             - inserts DROP rules on INPUT and FORWARD
                              chains for the given IPv4 address.
    POST /unblock           - removes the corresponding DROP rules.

Every write endpoint requires a shared token, read from the
FIREWALL_API_TOKEN environment variable, matching the value configured
in the backend's GATEWAY_FIREWALL_TOKEN setting.
"""

import os
import subprocess
import ipaddress

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

API_TOKEN = os.getenv("FIREWALL_API_TOKEN", "<FIREWALL_API_TOKEN>")

TRUSTED_IPS = {
    "127.0.0.1",
    "192.168.100.1",
}


class RuleRequest(BaseModel):
    ip: str
    token: str


def validate_ip(ip: str) -> str:
    try:
        ip = str(ipaddress.ip_address(ip))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address")

    if ip in TRUSTED_IPS:
        raise HTTPException(status_code=400, detail="Trusted IP cannot be blocked")

    return ip


def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)
    return result.stdout


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/block")
def block_ip(req: RuleRequest):
    if req.token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    ip = validate_ip(req.ip)

    run_cmd(["sudo", "iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"])
    run_cmd(["sudo", "iptables", "-I", "FORWARD", "-s", ip, "-j", "DROP"])

    return {"status": "blocked", "ip": ip}


@app.post("/unblock")
def unblock_ip(req: RuleRequest):
    if req.token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    ip = validate_ip(req.ip)

    subprocess.run(["sudo", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"], capture_output=True, text=True)
    subprocess.run(["sudo", "iptables", "-D", "FORWARD", "-s", ip, "-j", "DROP"], capture_output=True, text=True)

    return {"status": "unblocked", "ip": ip}
