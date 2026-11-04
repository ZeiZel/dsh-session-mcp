import type { PluginLogger, SessionController } from './types.js';
/** Path the MCP endpoint answers on. */
export declare const MCP_PATH = "/mcp";
/** A running endpoint. */
export interface RunningEndpoint {
    readonly url: string;
    readonly port: number;
    close(): Promise<void>;
}
/** Options accepted by {@link startEndpoint}. */
export interface StartEndpointOptions {
    readonly controller: SessionController;
    readonly token: string;
    readonly host: string;
    readonly port: number;
    readonly version: string;
    readonly logger?: PluginLogger | undefined;
}
/**
 * Build the web-standard MCP handler for one session controller.
 * @param controller - Harness `sessionController` service.
 * @param version - advertised server version.
 * @returns an object exposing `fetch(Request)`.
 */
export declare function buildMcpHandler(controller: SessionController, version: string): import("@modelcontextprotocol/server").McpHttpHandler;
/**
 * Start the bearer-authenticated MCP endpoint.
 * @param options - controller, token, host, port, version, logger.
 * @returns the resolved endpoint plus a disposer.
 */
export declare function startEndpoint(options: StartEndpointOptions): Promise<RunningEndpoint>;
