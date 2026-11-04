/**
 * Endpoint state for the DeepSeek Harness session MCP server.
 *
 * The bearer token and the listening URL must survive restarts: a client config
 * the user pasted into Claude/Codex/Cursor keeps working only while both stay
 * stable. The token is therefore generated once, stored with 0600 permissions,
 * and reused; only the URL changes when the port has to fall back.
 *
 * @module dsh-session-mcp/config
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Default loopback port for the MCP endpoint. */
export const DEFAULT_PORT = 7801

/** Default bind address. Loopback only, on purpose. */
export const DEFAULT_HOST = '127.0.0.1'

/** Name this server advertises to MCP clients. */
export const SERVER_NAME = 'dsh-session-mcp'

/** Key used in generated client configuration snippets. */
export const CLIENT_KEY = 'dsh-sessions'

/** One `mcpServers` entry as most MCP clients accept it. */
export interface ClientEntry {
  readonly type: 'http'
  readonly url: string
  readonly headers: { readonly Authorization: string }
}

/** The copy-paste fragment written to the endpoint file. */
export interface ClientConfig {
  readonly mcpServers: Record<string, ClientEntry>
}

/** Persisted endpoint state. */
export interface EndpointState {
  readonly version: 1
  readonly name: string
  readonly url: string
  readonly host: string
  readonly port: number
  readonly token: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly client: ClientConfig
}

/** The subset of stored state read back on restart. */
export interface StoredState {
  readonly token: string
  readonly createdAt?: string
}

/**
 * Resolve `$DSH_HOME` the way the launcher does.
 * @returns absolute Harness home.
 */
export function dshHome(): string {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/**
 * Absolute path of the endpoint state file.
 * @returns the file the server writes and clients read.
 */
export function stateFile(): string {
  return join(dshHome(), 'state', 'dsh-session-mcp.json')
}

/**
 * Create a fresh opaque bearer token.
 * @returns 32 random bytes, base64url encoded.
 */
export function createToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Read the persisted endpoint state, if any.
 * @returns the stored state, or `undefined` when absent or unreadable.
 */
export function readState(): StoredState | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(stateFile(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return undefined
    const candidate = parsed as Partial<EndpointState>
    if (typeof candidate.token !== 'string' || candidate.token.length < 16) return undefined
    return {
      token: candidate.token,
      ...(typeof candidate.createdAt === 'string' ? { createdAt: candidate.createdAt } : {}),
    }
  } catch {
    return undefined
  }
}

/**
 * Persist the endpoint state with owner-only permissions.
 * @param state - resolved endpoint facts and the client snippet.
 * @returns the file path written.
 */
export function writeState(state: EndpointState): string {
  mkdirSync(join(dshHome(), 'state'), { recursive: true })
  const file = stateFile()
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(file, 0o600)
  } catch {
    /* A pre-existing file keeps its mode; the token is local-only either way. */
  }
  return file
}

/**
 * Constant-time bearer comparison.
 * @param expected - the stored token.
 * @param header - the raw `Authorization` header value.
 * @returns true only for exactly `Bearer <expected>`.
 */
export function bearerMatches(expected: string, header: string | undefined): boolean {
  if (typeof header !== 'string') return false
  const match = /^Bearer\s+(\S+)$/iu.exec(header.trim())
  if (match === null) return false
  const presented = match[1]
  if (presented === undefined) return false
  const actual = Buffer.from(presented, 'utf8')
  const wanted = Buffer.from(expected, 'utf8')
  if (actual.byteLength !== wanted.byteLength) return false
  return timingSafeEqual(actual, wanted)
}

/**
 * Build the copy-paste client configuration for this endpoint.
 * @param url - full MCP endpoint URL.
 * @param token - bearer token.
 * @returns an `mcpServers` fragment accepted by most MCP clients.
 */
export function clientConfig(url: string, token: string): ClientConfig {
  return {
    mcpServers: {
      [CLIENT_KEY]: {
        type: 'http',
        url,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  }
}

/** Path of the authenticated config route the Settings page reads. */
export const CONFIG_ROUTE_PATH = '/api/dsh-session-mcp/config'

/** Every snippet the Settings page offers for copying. */
export interface ConfigSnippets {
  /** `mcpServers` JSON for Claude Desktop, Cursor and other JSON clients. */
  readonly json: string
  /** `~/.codex/config.toml` block. */
  readonly codexToml: string
  /** One `claude mcp add` command. */
  readonly claudeCode: string
}

/**
 * Render the copy-paste snippets for one endpoint.
 * @param url - full MCP endpoint URL.
 * @param token - bearer token.
 * @returns the three snippets the Settings page shows.
 */
export function snippetsFor(url: string, token: string): ConfigSnippets {
  return {
    json: JSON.stringify(clientConfig(url, token), null, 2),
    codexToml: [
      `[mcp_servers.${CLIENT_KEY}]`,
      `url = "${url}"`,
      '',
      `[mcp_servers.${CLIENT_KEY}.http_headers]`,
      `Authorization = "Bearer ${token}"`,
    ].join('\n'),
    claudeCode: `claude mcp add --transport http ${CLIENT_KEY} ${url} --header "Authorization: Bearer ${token}"`,
  }
}

/** What the Settings page receives from the Host. */
export interface ConfigPayload {
  readonly name: string
  readonly url: string
  readonly host: string
  readonly port: number
  readonly token: string
  readonly updatedAt: string
  readonly snippets: ConfigSnippets
}

