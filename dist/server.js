/**
 * Bearer-authenticated HTTP MCP endpoint.
 *
 * The MCP protocol work is the official SDK's: `createMcpHandler` serves the
 * modern revision from a per-request server factory and falls back to stateless
 * serving for 2025-era clients, so older MCP clients keep working. This module
 * owns only what the SDK deliberately leaves to the caller: the loopback
 * listener, the path, and the bearer check.
 *
 * @module dsh-session-mcp/server
 */
import { createServer } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { bearerMatches, SERVER_NAME } from './config.js';
import { registerTools } from './tools.js';
/** Path the MCP endpoint answers on. */
export const MCP_PATH = '/mcp';
/** Loopback hostnames accepted in the Host header. */
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost', '[::1]']);
/**
 * Build the web-standard MCP handler for one session controller.
 * @param controller - Harness `sessionController` service.
 * @param version - advertised server version.
 * @returns an object exposing `fetch(Request)`.
 */
export function buildMcpHandler(controller, version) {
    return createMcpHandler(() => {
        const server = new McpServer({ name: SERVER_NAME, version });
        registerTools(server, controller);
        return server;
    });
}
/**
 * Whether a request's Host header names this machine.
 * @param req - incoming request.
 * @returns false for anything that is not loopback.
 */
function hostIsLoopback(req) {
    const header = req.headers.host;
    if (typeof header !== 'string')
        return false;
    const name = header.replace(/:\d+$/u, '');
    return LOOPBACK.has(name.toLowerCase());
}
/**
 * Write one small JSON response.
 * @param res - node response.
 * @param status - HTTP status.
 * @param body - JSON-serializable body.
 * @param headers - extra headers.
 */
function json(res, status, body, headers = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload),
        'cache-control': 'no-store',
        ...headers,
    });
    res.end(payload);
}
/**
 * Bind a listener, falling back to an ephemeral port when the wanted one is taken.
 * @param server - node http server.
 * @param port - preferred port, `0` for ephemeral.
 * @param host - bind address.
 * @returns the bound port and whether the fallback ran.
 */
async function bind(server, port, host) {
    const attempt = (wanted) => new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            const address = server.address();
            if (address === null || typeof address === 'string') {
                reject(new Error('dsh-session-mcp: the listener bound without an address'));
                return;
            }
            resolve(address.port);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(wanted, host);
    });
    try {
        return { port: await attempt(port), fellBack: false };
    }
    catch (error) {
        const code = error?.code;
        if (port === 0 || code !== 'EADDRINUSE')
            throw error;
        return { port: await attempt(0), fellBack: true };
    }
}
/**
 * Start the bearer-authenticated MCP endpoint.
 * @param options - controller, token, host, port, version, logger.
 * @returns the resolved endpoint plus a disposer.
 */
export async function startEndpoint(options) {
    const { controller, token, host, port, version, logger } = options;
    const handler = buildMcpHandler(controller, version);
    const nodeHandler = toNodeHandler(handler);
    const server = createServer((req, res) => {
        if (!hostIsLoopback(req)) {
            json(res, 403, { error: 'forbidden', message: 'this endpoint accepts loopback hosts only' });
            return;
        }
        if (!bearerMatches(token, req.headers.authorization)) {
            json(res, 401, { error: 'unauthorized', message: 'send Authorization: Bearer <token> from the Harness endpoint file' }, { 'www-authenticate': `Bearer realm="${SERVER_NAME}"` });
            return;
        }
        const path = (req.url ?? '').split('?')[0];
        if (path !== MCP_PATH && path !== `${MCP_PATH}/`) {
            json(res, 404, { error: 'not_found', message: `the MCP endpoint lives at ${MCP_PATH}` });
            return;
        }
        void nodeHandler(req, res);
    });
    const bound = await bind(server, port, host);
    if (bound.fellBack) {
        logger?.warn?.(`dsh-session-mcp: port ${port} is in use; bound an ephemeral port ${bound.port} instead`);
    }
    const url = `http://${host === '::1' ? '[::1]' : host}:${bound.port}${MCP_PATH}`;
    return {
        url,
        port: bound.port,
        async close() {
            await new Promise((resolve) => {
                server.close(() => resolve());
                server.closeAllConnections?.();
            });
        },
    };
}
