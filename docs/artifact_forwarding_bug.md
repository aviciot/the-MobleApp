# Bug: artifact-update events not forwarded to SSE client

When the orchestrator calls `a2a_stream` as a sub-agent, it receives 2 file artifacts (`Stream Report`, `Stream Output`) internally — confirmed in run logs. However, none of these artifacts are forwarded to the SSE stream consumed by the client.

The client receives only `message-delta` text events describing the files in prose. The `artifact-update` SSE event is never emitted.

## Expected behavior

For every artifact received from a sub-agent, emit an `artifact-update` event on the parent SSE stream before the `task-status-update(completed)` terminal event:

```json
{
  "jsonrpc": "2.0",
  "method": "stream/event",
  "params": {
    "event": {
      "kind": "artifact-update",
      "parts": [
        {
          "url": "<file url or omit if inline>",
          "raw": "<base64 bytes if inline>",
          "mediaType": "application/pdf",
          "filename": "Stream Report"
        }
      ]
    }
  }
}
```

## Verified facts

- `a2a_stream` streams 2 file artifacts in ~990ms consistently across 3 runs
- Orchestrator run completes with `state: completed`
- Client SSE dump shows zero `artifact-update` events — only `message-delta` and `task-status-update`
- Client app is fully wired to receive and render `artifact-update` parts — `url`/`raw` → file card, `image/*` mediaType → image card

## What to fix in the orchestrator

Wherever it awaits the sub-agent response and extracts artifacts, add a loop that emits each artifact as an `artifact-update` SSE event before closing the stream.
