"""Suricata alert ingest service.

Tails /var/log/suricata/eve.json (path is configurable via the
SURICATA_EVE_PATH environment variable) and inserts every event of
type ``alert`` into the PostgreSQL table ``ids_alerts`` used by the
GWMON backend.

Database credentials are read from environment variables so that no
secret is committed to the repository:

    POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,
    POSTGRES_USER, POSTGRES_PASSWORD
"""

import json
import os
import time
import psycopg2

EVE_PATH = os.getenv("SURICATA_EVE_PATH", "/var/log/suricata/eve.json")

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "<POSTGRES_HOST>"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "dbname": os.getenv("POSTGRES_DB", "<DATABASE_NAME>"),
    "user": os.getenv("POSTGRES_USER", "<DATABASE_USER>"),
    "password": os.getenv("POSTGRES_PASSWORD", "<DATABASE_PASSWORD>")
}


def insert_alert(conn, event):
    alert = event.get("alert", {})

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO ids_alerts (
                timestamp, flow_id, in_iface,
                src_ip, src_port, dest_ip, dest_port, proto,
                signature, signature_id, category, severity,
                action, direction, raw
            )
            VALUES (
                %(timestamp)s, %(flow_id)s, %(in_iface)s,
                %(src_ip)s, %(src_port)s, %(dest_ip)s, %(dest_port)s, %(proto)s,
                %(signature)s, %(signature_id)s, %(category)s, %(severity)s,
                %(action)s, %(direction)s, %(raw)s
            );
        """, {
            "timestamp": event.get("timestamp"),
            "flow_id": event.get("flow_id"),
            "in_iface": event.get("in_iface"),
            "src_ip": event.get("src_ip"),
            "src_port": event.get("src_port"),
            "dest_ip": event.get("dest_ip"),
            "dest_port": event.get("dest_port"),
            "proto": event.get("proto"),
            "signature": alert.get("signature"),
            "signature_id": alert.get("signature_id"),
            "category": alert.get("category"),
            "severity": alert.get("severity"),
            "action": alert.get("action"),
            "direction": event.get("direction"),
            "raw": json.dumps(event)
        })
    conn.commit()


def follow_file(path):
    with open(path, "r") as f:
        f.seek(0, 2)
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.5)
                continue
            yield line


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    print("Connected to PostgreSQL. Watching Suricata eve.json...")

    for line in follow_file(EVE_PATH):
        try:
            event = json.loads(line)
            if event.get("event_type") == "alert":
                insert_alert(conn, event)
                print(
                    f"Inserted alert: {event.get('src_ip')} -> "
                    f"{event.get('dest_ip')} | "
                    f"{event.get('alert', {}).get('signature')}"
                )
        except Exception as e:
            print(f"Error: {e}")
            try:
                conn.rollback()
            except Exception:
                pass


if __name__ == "__main__":
    main()
