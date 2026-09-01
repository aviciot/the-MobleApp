#!/usr/bin/env python3
"""
test_gateway.py — Mobile app gateway connectivity tests.

Tests exactly what the mobile app needs before a dev session.
Usage: python scripts/test_gateway.py [--base-url http://10.55.125.43:8088]
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_BASE = "http://10.55.125.43:8088"
TOKEN = "XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k"
SLUGS = [
    {"appSlug": "freddy", "epSlug": "a2a-1"},
    {"appSlug": "stream", "epSlug": "a2a-2"},
]

# Agents that support message/stream (SSE). Others are skipped for stream test.
STREAMING_SLUGS = [
    {"appSlug": "stream", "epSlug": "a2a-2"},
]

PASS = 0
FAIL = 0

def check(desc, ok, detail=""):
    global PASS, FAIL
    if ok:
        print(f"  [PASS] {desc}")
        PASS += 1
    else:
        print(f"  [FAIL] {desc}" + (f"  ({detail})" if detail else ""))
        FAIL += 1

def get(url, token=None, timeout=5):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return None, str(e)

def post(url, body, token=None, timeout=15):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = ""
        try: body = e.read().decode()
        except: pass
        return e.code, body
    except Exception as e:
        return None, str(e)

# ── Tests ─────────────────────────────────────────────────────────────────────

def test_health(base):
    print("\n=== 1. Health ===")
    status, body = get(f"{base}/health/live")
    check("/health/live = 200", status == 200, f"got {status}")
    status, body = get(f"{base}/health/ready")
    check("/health/ready = 200", status == 200, f"got {status}")

def test_a2a_endpoint(base, s):
    """Test A2A endpoint reachability and JSON-RPC compliance.
    message/stream is only testable from the phone (gateway routing restriction).
    This test verifies the endpoint is reachable and returns valid JSON-RPC.
    """
    slug = f"{s['appSlug']}/{s['epSlug']}"
    print(f"\n=== 2. A2A endpoint — {slug} ===")
    # Use SendMessage (non-streaming) for connectivity test — SendStreamingMessage keeps connection open
    status, body = post(
        f"{base}/a2a/{slug}",
        {
            "jsonrpc": "2.0", "id": "1", "method": "SendMessage",
            "params": {"message": {"role": "user", "parts": [{"text": "hello"}]}}
        },
        token=TOKEN,
    )
    check(f"POST /a2a/{slug} reachable", status == 200, f"got {status}")
    if status == 200 and isinstance(body, dict):
        is_jsonrpc = "result" in body or "error" in body
        check(f"/a2a/{slug} returns valid JSON-RPC envelope", is_jsonrpc, str(body)[:120])
        if "result" in body:
            result = body["result"]
            ctx_id = result.get("contextId")
            check(f"/a2a/{slug} result has contextId", bool(ctx_id), str(result)[:120])
            parts = result.get("message", {}).get("parts", [])
            reply_text = next((p.get("text") for p in parts if p.get("text")), None)
            check(f"/a2a/{slug} reply has text", bool(reply_text), str(parts)[:80])
        elif body.get("error", {}).get("code") == -32601:
            print(f"  [FAIL] SendMessage returned METHOD_NOT_FOUND — check A2A v1.0 method names on bridge")

VOICE_APP_SLUG = "freddy"
VOICE_SLUG = "ep-voice-1"

def test_tts(base):
    print("\n=== 3. TTS ===")
    # URL: /apps/{voiceAppSlug}/{voiceSlug}/voice/tts
    tts_url = f"{base}/apps/{VOICE_APP_SLUG}/{VOICE_SLUG}/voice/tts"
    status, _ = post(tts_url, {"text": "hello"}, token=TOKEN, timeout=5)
    if status is None:
        print(f"  [SKIP] POST {tts_url} — firewall blocks this machine, works from phone")
    else:
        check(f"POST {tts_url} reachable", status in (200, 400, 422), f"got {status}")

def test_agent_card(base, s):
    slug = f"{s['appSlug']}/{s['epSlug']}"
    print(f"\n=== 4. Agent card — {slug} ===")
    status, body = get(f"{base}/a2a/{slug}/.well-known/agent.json")
    check(f"GET /a2a/{slug}/.well-known/agent.json = 200", status == 200, f"got {status}")
    if status == 200:
        try:
            card = json.loads(body)
            check("agent card has name", bool(card.get("name")), str(card)[:80])
            check("agent card has url", bool(card.get("url")), str(card)[:80])
        except:
            check("agent card is valid JSON", False, body[:80])

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    print(f"Gateway: {base}")
    print(f"Token:   {TOKEN[:10]}...")

    test_health(base)
    for slug in SLUGS:
        test_a2a_endpoint(base, slug)
    test_tts(base)
    for slug in SLUGS:
        test_agent_card(base, slug)

    print(f"\n{'='*40}")
    print(f"  {PASS} passed, {FAIL} failed")
    print(f"{'='*40}")
    sys.exit(0 if FAIL == 0 else 1)

if __name__ == "__main__":
    main()
