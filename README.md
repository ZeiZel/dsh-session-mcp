# dsh-session-mcp

**MCP server for DeepSeek Harness sessions.** Let Claude, Codex, Cursor — or another
DeepSeek Harness — list, read and prompt the conversations running in your harness.

The plugin starts a bearer-authenticated MCP endpoint together with the harness and writes
you a ready-to-paste client config. There is no separate process to babysit, no port to
guess, and no second writer on the session log.

```
┌──────────────────┐   Bearer token    ┌─────────────────────────────┐
│  Claude / Codex  │ ────────────────► │  http://127.0.0.1:7801/mcp  │
│  Cursor / other  │ ◄──────────────── │  inside the Harness process │
└──────────────────┘   MCP over HTTP   └──────────────┬──────────────┘
                                                     │ in-process
                                                     ▼
                                          ┌─────────────────────┐
                                          │  sessionController  │
                                          │  list / page / …    │
                                          └─────────────────────┘
```

## Why

DeepSeek Harness keeps its conversations behind a writer lock: a second `dsh` process that
tries to resume a live session is rejected, and its own HTTP API authenticates with a
launch token that lives only in memory. This plugin solves both by serving MCP **inside**
the harness process, where the session controller is already available, and by giving
clients a stable bearer token instead of a launch secret.

`session_send` therefore delivers into the conversation a human is looking at, not into a
copy of it.

## Install

```bash
# in your harness profile
dsh plugin --profile desktop add dsh-session-mcp
```

or from a checkout:

```bash
bun install
dsh plugin --profile desktop add /absolute/path/to/dsh-session-mcp
```

Restart the harness (or reload the profile) and the endpoint starts with it.

## Get your config

The harness writes everything to:

```
$DSH_HOME/state/dsh-session-mcp.json
```

```json
{
  "url": "http://127.0.0.1:7801/mcp",
  "token": "…",
  "client": {
    "mcpServers": {
      "dsh-sessions": {
        "type": "http",
        "url": "http://127.0.0.1:7801/mcp",
        "headers": { "Authorization": "Bearer …" }
      }
    }
  }
}
```

Copy the `client` block into your MCP client. Per client:

**Claude Code**

```bash
claude mcp add --transport http dsh-sessions http://127.0.0.1:7801/mcp \
  --header "Authorization: Bearer <token>"
```

**Claude Desktop / Cursor / generic `mcpServers`**

```json
{
  "mcpServers": {
    "dsh-sessions": {
      "type": "http",
      "url": "http://127.0.0.1:7801/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

**Codex**

```toml
[mcp_servers.dsh-sessions]
url = "http://127.0.0.1:7801/mcp"
http_headers = { Authorization = "Bearer <token>" }
```

Older clients that only speak the 2025 revisions still work: the endpoint serves the modern
revision and falls back to stateless serving for 2025-era traffic.

## Tools

| Tool | Description |
|---|---|
| `sessions_list` | Conversations with id, title, working directory, running state, token usage |
| `session_read` | Durable history (user / assistant / tool), pageable back with `beforeSeq` |
| `session_send` | Deliver a user message into a conversation (`queue` or `steer`) |
| `session_create` | Open a new blank conversation and return its id |
| `session_search` | Full-text search — only when the harness enables the session-query index |

## Security

- Binds **loopback only** (`127.0.0.1`) and rejects non-loopback `Host` headers.
- Every request needs `Authorization: Bearer <token>`; the check is constant-time.
- The token is 32 random bytes, generated once, stored `0600` at
  `$DSH_HOME/state/dsh-session-mcp.json`, and reused across restarts so pasted client
  configs keep working.
- **Rotate** by deleting that file and restarting the harness. Every client then needs the
  new token.
- Never expose this endpoint through a proxy or a tunnel: the bearer is the only thing
  between a client and every conversation you have.

## Configuration

The plugin row accepts two options (`cordis.patch.yml`):

| Option | Default | Meaning |
|---|---|---|
| `port` | `7801` | Preferred loopback port. If taken, an ephemeral port is used and the state file is republished with the real URL. |
| `host` | `127.0.0.1` | Bind address. |

## How it works

- `host/index.js` — Cordis plugin. Reads/creates the bearer, starts the listener, publishes
  the state file, closes the listener on unload.
- `host/server.js` — `node:http` listener with the bearer gate in front of the official
  SDK's `createMcpHandler` + `toNodeHandler`.
- `host/tools.js` — the five tools, backed directly by `ctx.sessionController`.
- `host/config.js` — token persistence, constant-time bearer comparison, client snippet.

## Development

```bash
bun install
node --check host/*.js
```

Requires Node ≥ 20. Dependencies: `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `zod`.

## License

MIT © ZeiZel
