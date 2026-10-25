"""Emergent-managed email (Resend) — best-effort transactional sends.
Recipients come from server-side records and bodies from server-side templates
(never caller input). Sends never crash the calling request."""
import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("gapless.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"  # constant on purpose (survives deploy)


def _key():
    return os.environ.get("EMERGENT_EMAIL_KEY", "")


def _from_name():
    return os.environ.get("EMAIL_FROM_NAME", "Gapless")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


def enabled() -> bool:
    return bool(_key())


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    """Best-effort send. Returns the message id, or None on any failure (logged)."""
    if not _key() or not to:
        return None
    try:
        _assert_safe_email(subject, html)
        payload = {"to": [to], "subject": subject, "html": html, "from_name": _from_name()}
        reply_to = os.environ.get("EMAIL_REPLY_TO")
        if reply_to:
            payload["contact_email"] = reply_to
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": _key()}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:  # never crash the calling request
        logger.warning(f"email send skipped/failed to {to}: {e}")
        return None


def _wrap(inner_html: str) -> str:
    return (f'<table role="presentation" width="100%" style="max-width:520px"><tr><td '
            f'style="padding:24px;font-family:Arial,sans-serif;color:#10211F">{inner_html}'
            f'<p style="font-size:12px;color:#889">Sent by {escape(_from_name())}. '
            f'We never ask for your password or card details by email.</p></td></tr></table>')


def notify_html(greeting: str, lines: list, cta_label: str | None, cta_url: str | None) -> str:
    body = f'<p>{escape(greeting)}</p>'
    for ln in lines:
        body += f'<p>{escape(ln)}</p>'
    if cta_label and cta_url and cta_url.lower().startswith("https://"):
        body += (f'<p><a href="{escape(cta_url)}" style="display:inline-block;background:#0E7C74;'
                 f'color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">{escape(cta_label)}</a></p>')
    return _wrap(body)
