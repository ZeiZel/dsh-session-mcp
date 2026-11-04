/**
 * dsh-session-mcp — Host plugin.
 *
 * Starting this plugin starts the MCP endpoint with the Harness: it binds a
 * loopback listener, requires the bearer token stored for this Harness home,
 * and serves the session tools in-process through `ctx.sessionController`.
 *
 * The bearer token is generated once and reused, so a client configuration the
 * user pasted into Claude/Codex/Cursor keeps working across restarts. The
 * resolved endpoint and a ready `mcpServers` fragment are written to
 * `$DSH_HOME/state/dsh-session-mcp.json` on every start.
 *
 * @module dsh-session-mcp
 */
import { readFileSync } from 'node:fs'
import {
  clientConfig,
  createToken,
  DEFAULT_HOST,
  DEFAULT_PORT,
  readState,
  SERVER_NAME,
  writeState,
} from './config.js'
import { startEndpoint } from './server.js'

/** Stable Cordis plugin name. */
export const name = 'dsh-session-mcp'

/** The session controller is the only capability this plugin needs. */
export const inject = ['sessionController']

/** Read this package's version without assuming a checkout layout. */
function packageVersion() {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Resolve the row config with defaults and type checks.
 * @param config - raw Loader row config.
 * @returns `{ port, host }`.
 */
function settingsOf(config) {
  const port = Number.isInteger(config?.port) ? config.port : DEFAULT_PORT
  if (port < 0 || port > 65535) throw new RangeError(`dsh-session-mcp: port ${port} is out of range`)
  const host = typeof config?.host === 'string' && config.host.length > 0 ? config.host : DEFAULT_HOST
  return { port, host }
}

/**
 * Mount the endpoint.
 * @param ctx - Host context carrying `sessionController`.
 * @param config - Loader row config: `{ port?, host? }`.
 */
export async function apply(ctx, config) {
  const { port, host } = settingsOf(config)
  const version = packageVersion()

  const stored = readState()
  const token = stored?.token ?? createToken()
  const createdAt = stored?.createdAt ?? new Date().toISOString()

  const endpoint = await startEndpoint({
    controller: ctx.sessionController,
    token,
    host,
    port,
    version,
    logger: ctx.logger,
  })

  const state = {
    version: 1,
    name: SERVER_NAME,
    url: endpoint.url,
    host,
    port: endpoint.port,
    token,
    createdAt,
    updatedAt: new Date().toISOString(),
    client: clientConfig(endpoint.url, token),
  }

  const file = writeState(state)
  const snippet = JSON.stringify(state.client, null, 2)

  ctx.logger?.info?.(`dsh-session-mcp: MCP endpoint listening at ${endpoint.url}`)
  ctx.logger?.info?.(`dsh-session-mcp: bearer token and client config in ${file}`)
  console.log(`dsh-session-mcp: ${endpoint.url} (bearer in ${file})`)
  console.log(snippet)

  ctx.effect(
    () => () => {
      void endpoint.close()
    },
    'dsh-session-mcp: endpoint lifetime',
  )
}
