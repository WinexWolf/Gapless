"""LLM helpers. Every call: 6s timeout + deterministic fallback by the caller.
The LLM only phrases text or extracts fields; it never decides money."""
import os
import re
import json
import uuid
import asyncio
import logging

log = logging.getLogger("gapless.llm")


async def llm_text(system, prompt, force_fail=False, timeout=6.0):
    if force_fail:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY", ""), session_id=str(uuid.uuid4()),
                       system_message=system).with_model("openai", "gpt-4.1-mini")
        out = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=timeout)
        return (out or "").strip() or None
    except Exception as e:  # timeout, network, key
        log.warning("LLM fallback: %s", e)
        return None


def extract_json(text):
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None
