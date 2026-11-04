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
 * The Settings page can move the listener to another port and rotate the bearer
 * token over the authenticated `/api` channel; both choices are persisted here.
 *
 * @module dsh-session-mcp
 */
import { readFileSync } from 'node:fs';
import { clientConfig, CONFIG_ROUTE_PATH, createToken, DEFAULT_HOST, DEFAULT_PORT, PORT_RANGE, PORT_ROUTE_PATH, readState, SERVER_NAME, snippetsFor, TOKEN_ROUTE_PATH, writeState, } from './config.js';
import { RequestJournal } from './log.js';
import { startEndpoint } from './server.js';
/** Stable Cordis plugin name. */
export const name = 'dsh-session-mcp';
/** The session controller is the only capability this plugin needs. */
export const inject = ['sessionController'];
/**
 * Read this package's version without assuming a checkout layout.
 * @returns the `version` field of the package manifest.
 */
function packageVersion() {
    try {
        const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
        if (manifest !== null && typeof manifest === 'object') {
            const version = manifest.version;
            if (typeof version === 'string')
                return version;
        }
    }
    catch {
        /* A missing manifest only affects the advertised version string. */
    }
    return '0.0.0';
}
/**
 * Resolve the row config with defaults and type checks.
 * @param config - raw Loader row config.
 * @returns the effective `{ port, host }`.
 */
function settingsOf(config) {
    const port = config?.port ?? DEFAULT_PORT;
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new RangeError(`dsh-session-mcp: port ${String(port)} is out of range`);
    }
    const host = config?.host !== undefined && config.host.length > 0 ? config.host : DEFAULT_HOST;
    return { port, host };
}
/** One JSON response on the authenticated channel. */
function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
}
/**
 * Mount the endpoint.
 * @param ctx - Host context carrying `sessionController`.
 * @param config - Loader row config: `{ port?, host? }`.
 */
export async function apply(ctx, config) {
    const { port: configuredPort, host } = settingsOf(config);
    const version = packageVersion();
    const stored = readState();
    let token = stored?.token ?? createToken();
    const createdAt = stored?.createdAt ?? new Date().toISOString();
    const journal = new RequestJournal();
    /** Port the user last chose; it wins over the row config on restart. */
    let preferredPort = stored?.preferredPort ?? configuredPort;
    let endpoint = await startEndpoint({
        controller: ctx.sessionController,
        token: () => token,
        host,
        port: preferredPort,
        version,
        logger: ctx.logger,
        journal,
    });
    /** Persist the current facts and the chosen port. */
    const persist = () => {
        const state = {
            version: 1,
            name: SERVER_NAME,
            url: endpoint.url,
            host,
            port: endpoint.port,
            preferredPort,
            token,
            createdAt,
            updatedAt: new Date().toISOString(),
            client: clientConfig(endpoint.url, token),
        };
        return writeState(state);
    };
    let file = persist();
    ctx.logger?.info?.(`dsh-session-mcp: MCP endpoint listening at ${endpoint.url}`);
    ctx.logger?.info?.(`dsh-session-mcp: bearer token and client config in ${file}`);
    console.log(`dsh-session-mcp: ${endpoint.url} (bearer in ${file})`);
    console.log(JSON.stringify(clientConfig(endpoint.url, token), null, 2));
    /** Resolve conversation titles for the journalled calls, best effort. */
    const titlesFor = async (ids) => {
        const titles = new Map();
        if (ids.length === 0)
            return titles;
        try {
            const rows = await ctx.sessionController.list({}, new AbortController().signal);
            for (const row of rows?.items ?? []) {
                if (ids.includes(row.sessionId))
                    titles.set(row.sessionId, row.projections?.values?.title ?? null);
            }
        }
        catch {
            /* Titles decorate the log; a failed lookup must not fail the page. */
        }
        return titles;
    };
    /** Build the Settings payload fresh on every read. */
    const buildPayload = async () => {
        const records = journal.snapshot();
        const ids = [...new Set(records.map((entry) => entry.sessionId).filter((id) => id !== null))];
        const titles = await titlesFor(ids);
        const log = records.map((entry) => ({
            ...entry,
            sessionTitle: entry.sessionId === null ? null : (titles.get(entry.sessionId) ?? null),
        }));
        return {
            name: SERVER_NAME,
            url: endpoint.url,
            host,
            port: endpoint.port,
            token,
            updatedAt: new Date().toISOString(),
            snippets: snippetsFor(endpoint.url, token),
            status: {
                state: 'listening',
                version,
                startedAt: journal.startedAtIso,
                uptimeMs: Date.now() - Date.parse(journal.startedAtIso),
                totalCalls: journal.totalCalls,
                lastFailure: journal.lastFailure,
            },
            log,
        };
    };
    /**
     * Move the listener to another port, restoring the old one when the new port
     * cannot be bound.
     * @param port - requested loopback port.
     */
    const moveTo = async (port) => {
        const previousPort = endpoint.port;
        await endpoint.close();
        try {
            endpoint = await startEndpoint({
                controller: ctx.sessionController,
                token: () => token,
                host,
                port,
                version,
                logger: ctx.logger,
                journal,
                // The user named a port: never silently bind a random one instead.
                allowFallback: false,
            });
        }
        catch (error) {
            endpoint = await startEndpoint({
                controller: ctx.sessionController,
                token: () => token,
                host,
                port: previousPort,
                version,
                logger: ctx.logger,
                journal,
            });
            throw error;
        }
    };
    // The Settings page reads and mutates the live config over the authenticated
    // `/api` channel, so the token never enters the served HTML.
    ctx.inject(['connection'], (connectionCtx) => {
        const register = connectionCtx.connection.fetch.register;
        register({
            path: CONFIG_ROUTE_PATH,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => jsonResponse(await buildPayload()),
        });
        register({
            path: PORT_ROUTE_PATH,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: async (request) => {
                let body;
                try {
                    body = await request.json();
                }
                catch {
                    return jsonResponse({ error: 'invalid_body', message: 'expected a JSON body' }, 400);
                }
                const requested = Number(body?.port);
                if (!Number.isInteger(requested) || requested < PORT_RANGE.min || requested > PORT_RANGE.max) {
                    return jsonResponse({
                        error: 'invalid_port',
                        message: `port must be an integer between ${String(PORT_RANGE.min)} and ${String(PORT_RANGE.max)}`,
                    }, 400);
                }
                try {
                    await moveTo(requested);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger?.warn?.(`dsh-session-mcp: could not move to port ${String(requested)}: ${message}`);
                    return jsonResponse({ error: 'port_unavailable', message }, 409);
                }
                preferredPort = requested;
                file = persist();
                ctx.logger?.info?.(`dsh-session-mcp: moved to ${endpoint.url}`);
                return jsonResponse(await buildPayload());
            },
        });
        register({
            path: TOKEN_ROUTE_PATH,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: async () => {
                token = createToken();
                file = persist();
                ctx.logger?.info?.('dsh-session-mcp: bearer token rotated');
                return jsonResponse(await buildPayload());
            },
        });
    });
    ctx.effect(() => () => {
        void endpoint.close();
    }, 'dsh-session-mcp: endpoint lifetime');
}
