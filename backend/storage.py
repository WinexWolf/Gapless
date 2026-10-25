"""Emergent Managed Object Storage helper (invoice/receipt images).
Session-scoped storage key, initialized once at startup. DB remains the source of truth;
storage has no delete API (we soft-delete in Mongo)."""
import os
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

log = logging.getLogger("gapless.storage")


def _base():
    b = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
    return b.rstrip("/") + "/objstore/api/v1/storage"


APP_NAME = "gapless"

_storage_key = None


def init_storage(force: bool = False):
    """Call once at startup. Returns a reusable session-scoped storage key."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{_base()}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    try:
        resp = requests.put(f"{_base()}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code == 404:  # stale/dead key -> remint once
            key = init_storage(force=True)
            resp = requests.put(f"{_base()}/objects/{path}",
                                headers={"X-Storage-Key": key, "Content-Type": content_type},
                                data=data, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.warning("put_object failed: %s", e)
        raise


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{_base()}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{_base()}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
              "webp": "image/webp", "pdf": "application/pdf"}
