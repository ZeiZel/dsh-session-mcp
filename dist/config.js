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
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
/** Default loopback port for the MCP endpoint. */
export const DEFAULT_PORT = 7801;
/** Default bind address. Loopback only, on purpose. */
export const DEFAULT_HOST = '127.0.0.1';
/** Name this server advertises to MCP clients. */
export const SERVER_NAME = 'dsh-session-mcp';
/** Key used in generated client configuration snippets. */
export const CLIENT_KEY = 'dsh-sessions';
/**
 * Resolve `$DSH_HOME` the way the launcher does.
 * @returns absolute Harness home.
 */
export function dshHome() {
    const fromEnv = process.env.DSH_HOME;
    if (typeof fromEnv === 'string' && fromEnv.length > 0)
        return fromEnv;
    return join(homedir(), '.dsh');
}
/**
 * Absolute path of the endpoint state file.
 * @returns the file the server writes and clients read.
 */
export function stateFile() {
    return join(dshHome(), 'state', 'dsh-session-mcp.json');
}
/**
 * Create a fresh opaque bearer token.
 * @returns 32 random bytes, base64url encoded.
 */
export function createToken() {
    return randomBytes(32).toString('base64url');
}
/**
 * Read the persisted endpoint state, if any.
 * @returns the stored state, or `undefined` when absent or unreadable.
 */
export function readState() {
    try {
        const parsed = JSON.parse(readFileSync(stateFile(), 'utf8'));
        if (parsed === null || typeof parsed !== 'object')
            return undefined;
        const candidate = parsed;
        if (typeof candidate.token !== 'string' || candidate.token.length < 16)
            return undefined;
        return {
            token: candidate.token,
            ...(typeof candidate.createdAt === 'string' ? { createdAt: candidate.createdAt } : {}),
        };
    }
    catch {
        return undefined;
    }
}
/**
 * Persist the endpoint state with owner-only permissions.
 * @param state - resolved endpoint facts and the client snippet.
 * @returns the file path written.
 */
export function writeState(state) {
    mkdirSync(join(dshHome(), 'state'), { recursive: true });
    const file = stateFile();
    writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
        chmodSync(file, 0o600);
    }
    catch {
        /* A pre-existing file keeps its mode; the token is local-only either way. */
    }
    return file;
}
/**
 * Constant-time bearer comparison.
 * @param expected - the stored token.
 * @param header - the raw `Authorization` header value.
 * @returns true only for exactly `Bearer <expected>`.
 */
export function bearerMatches(expected, header) {
    if (typeof header !== 'string')
        return false;
    const match = /^Bearer\s+(\S+)$/iu.exec(header.trim());
    if (match === null)
        return false;
    const presented = match[1];
    if (presented === undefined)
        return false;
    const actual = Buffer.from(presented, 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    if (actual.byteLength !== wanted.byteLength)
        return false;
    return timingSafeEqual(actual, wanted);
}
/**
 * Build the copy-paste client configuration for this endpoint.
 * @param url - full MCP endpoint URL.
 * @param token - bearer token.
 * @returns an `mcpServers` fragment accepted by most MCP clients.
 */
export function clientConfig(url, token) {
    return {
        mcpServers: {
            [CLIENT_KEY]: {
                type: 'http',
                url,
                headers: { Authorization: `Bearer ${token}` },
            },
        },
    };
}
/** Path of the authenticated config route the Settings page reads. */
export const CONFIG_ROUTE_PATH = '/api/dsh-session-mcp/config';
/**
 * Render the copy-paste snippets for one endpoint.
 * @param url - full MCP endpoint URL.
 * @param token - bearer token.
 * @returns the three snippets the Settings page shows.
 */
export function snippetsFor(url, token) {
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
    };
}
