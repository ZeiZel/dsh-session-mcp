import type { RequestJournal } from './log.js';
import type { PluginLogger, SessionController } from './types.js';
/** Path the MCP endpoint answers on. */
export declare const MCP_PATH = "/mcp";
/** Description every client receives during `initialize`. */
export declare const SERVER_INSTRUCTIONS: string;
/** A running endpoint. */
export interface RunningEndpoint {
    readonly url: string;
    readonly port: number;
    close(): Promise<void>;
}
/** Options accepted by {@link startEndpoint}. */
export interface StartEndpointOptions {
    readonly controller: SessionController;
    /** Bearer token, or a reader so rotation applies to the running listener. */
    readonly token: string | (() => string);
    readonly host: string;
    readonly port: number;
    readonly version: string;
    readonly logger?: PluginLogger | undefined;
    readonly journal?: RequestJournal | undefined;
    /**
     * Whether a busy port may fall back to an ephemeral one. Startup wants that;
     * an explicit port change from Settings does not, because the user asked for
     * a specific port and a silent random one would be a lie.
     */
    readonly allowFallback?: boolean;
}
/**
 * Build the web-standard MCP handler for one session controller.
 * @param controller - Harness `sessionController` service.
 * @param version - advertised server version.
 * @returns an object exposing `fetch(Request)`.
 */
export declare function buildMcpHandler(controller: SessionController, version: string, journal?: RequestJournal): import("@modelcontextprotocol/server").McpHttpHandler;
/**
 * Start the bearer-authenticated MCP endpoint.
 * @param options - controller, token, host, port, version, logger.
 * @returns the resolved endpoint plus a disposer.
 */
export declare function startEndpoint(options: StartEndpointOptions): Promise<RunningEndpoint>;
