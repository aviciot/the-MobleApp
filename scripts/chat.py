#!/usr/bin/env python3
"""
chat.py — Interactive CLI chat with any A2A agent endpoint.

Usage:
    python scripts/chat.py
    python scripts/chat.py --base-url http://10.55.125.43:8088
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_BASE = "http://10.55.125.43:8088"
TOKEN = "XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k"

ENDPOINTS = [
    {"appSlug": "freddy", "epSlug": "a2a-1",  "label": "Freddy"},
    {"appSlug": "stream", "epSlug": "a2a-2",  "label": "Agent Sandbox (stream)"},
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_agent_card(base, app_slug, ep_slug):
    url = f"{base}/a2a/{app_slug}/{ep_slug}/.well-known/agent.json"
    try:
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {TOKEN}")
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def _post(url, body_dict, token, timeout=60):
    """Raw POST helper — returns (status, body_bytes)."""
    data = json.dumps(body_dict).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "text/event-stream")
    req.add_header("Accept-Encoding", "identity")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        body = b""
        try: body = e.read()
        except: pass
        return e.code, body
    except Exception as e:
        return None, str(e).encode()


def _parse_sse(raw_text):
    """Parse SSE body into (full_text, context_id, artifacts, error_msg)."""
    full_text = ""
    new_ctx = None
    artifacts = []
    event_lines = []

    for line in raw_text.splitlines():
        line = line.rstrip("\r")
        if line == "":
            if event_lines:
                data = "\n".join(l[5:].lstrip() for l in event_lines if l.startswith("data:"))
                event_lines = []
                if not data:
                    continue
                try:
                    ev = json.loads(data).get("params", {}).get("event", {})
                except:
                    continue
                kind = ev.get("kind")
                if kind == "run-started":
                    new_ctx = ev.get("contextId")
                elif kind == "message-delta":
                    for p in ev.get("parts", []):
                        full_text += p.get("text", "")
                elif kind == "artifact-update":
                    artifacts.append(ev.get("parts", []))
                elif kind == "task-status-update":
                    if ev.get("status", {}).get("state") == "completed":
                        for p in ev.get("status", {}).get("message", {}).get("parts", []):
                            if p.get("text") and not full_text:
                                full_text = p["text"]
                elif kind == "error":
                    return None, new_ctx, [], ev.get("message", "Stream error")
        else:
            event_lines.append(line)

    return full_text, new_ctx, artifacts, None


def send_message(base, app_slug, ep_slug, text, context_id):
    """Try message/stream first; fall back to message/send if not supported."""
    url = f"{base}/a2a/{app_slug}/{ep_slug}"
    msg = {
        "role": "user",
        "parts": [{"text": text}],
        **({"contextId": context_id} if context_id else {}),
    }

    # ── Try streaming ─────────────────────────────────────────────────────────
    status, body = _post(url, {"jsonrpc": "2.0", "id": "1", "method": "message/stream", "params": {"message": msg}}, TOKEN)
    if status is None:
        return None, context_id, [], f"Network error: {body.decode()}"

    body_text = body.decode("utf-8", errors="replace")

    # Check if it's a JSON-RPC error (method not found → fall back to send)
    try:
        as_json = json.loads(body_text)
        if "error" in as_json:
            if as_json["error"].get("code") == -32601:
                # method/stream not supported — fall back to message/send
                status2, body2 = _post(url, {"jsonrpc": "2.0", "id": "1", "method": "message/send", "params": {"message": msg}}, TOKEN)
                if status2 != 200:
                    return None, context_id, [], f"HTTP {status2}: {body2.decode()[:120]}"
                resp = json.loads(body2.decode())
                if "error" in resp:
                    return None, context_id, [], resp["error"].get("message", "A2A error")
                result = resp.get("result", {})
                new_ctx = result.get("contextId") or context_id
                parts = result.get("message", {}).get("parts", [])
                reply = next((p.get("text") for p in parts if p.get("text")), "")
                artifacts_raw = result.get("artifacts", [])
                artifacts = [a.get("parts", []) for a in artifacts_raw]
                return reply, new_ctx, artifacts, None
            return None, context_id, [], as_json["error"].get("message", "A2A error")
    except (json.JSONDecodeError, KeyError):
        pass  # not JSON → it's SSE

    # Parse SSE
    reply, new_ctx, artifacts, err = _parse_sse(body_text)
    if err:
        return None, context_id, [], err
    return reply, new_ctx or context_id, artifacts, None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Interactive A2A chat CLI")
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    print(f"\n{'━'*52}")
    print(f"  the-M  A2A Chat")
    print(f"  Gateway: {base}")
    print(f"{'━'*52}\n")

    # ── Select endpoint ───────────────────────────────────────────────────────
    print("Available agents:\n")
    cards = {}
    for i, ep in enumerate(ENDPOINTS, 1):
        card = fetch_agent_card(base, ep["appSlug"], ep["epSlug"])
        cards[i] = card
        name = card.get("name", ep["label"]) if card else ep["label"]
        desc = card.get("description", "") if card else ""
        streaming = card.get("capabilities", {}).get("streaming", False) if card else False
        badge = "  [SSE]" if streaming else ""
        print(f"  [{i}] {name}{badge}")
        if desc:
            print(f"       {desc}")
        skills = card.get("skills", []) if card else []
        if skills:
            print(f"       Skills: {', '.join(s.get('name','?') for s in skills)}")
        print()

    while True:
        try:
            choice = input("Select agent [1]: ").strip() or "1"
            idx = int(choice)
            if 1 <= idx <= len(ENDPOINTS):
                break
            print(f"  Enter a number between 1 and {len(ENDPOINTS)}")
        except ValueError:
            print("  Enter a number")

    ep = ENDPOINTS[idx - 1]
    card = cards.get(idx)
    agent_name = card.get("name", ep["label"]) if card else ep["label"]

    print(f"\nConnected to: {agent_name}  ({base}/a2a/{ep['appSlug']}/{ep['epSlug']})")
    print("Type your message. Enter 'quit' or Ctrl+C to exit.\n")

    context_id = None

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nBye.")
            sys.exit(0)

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("Bye.")
            sys.exit(0)

        print(f"\n{agent_name}: ", end="", flush=True)

        reply, new_ctx, artifacts, err = send_message(base, ep["appSlug"], ep["epSlug"], user_input, context_id)

        if err:
            print(f"\n[ERROR] {err}\n")
            continue

        context_id = new_ctx

        if reply:
            print(reply.strip())
        else:
            print("[no text reply]")

        if artifacts:
            print(f"\n  [{len(artifacts)} artifact(s) received]")
            for i, parts in enumerate(artifacts, 1):
                for p in parts:
                    if p.get("url"):
                        print(f"    Artifact {i}: {p.get('filename', 'file')}  ({p.get('mediaType','?')})  → {p['url']}")
                    elif p.get("raw"):
                        print(f"    Artifact {i}: {p.get('filename', 'file')}  ({p.get('mediaType','?')})  [inline base64]")
                    elif p.get("text"):
                        print(f"    Artifact {i} [text]: {p['text'][:120]}")
                    elif p.get("data") is not None:
                        print(f"    Artifact {i} [data]: {json.dumps(p['data'])[:120]}")

        print()


if __name__ == "__main__":
    main()
