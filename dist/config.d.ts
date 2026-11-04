/** Default loopback port for the MCP endpoint. */
export declare const DEFAULT_PORT = 7801;
/** Default bind address. Loopback only, on purpose. */
export declare const DEFAULT_HOST = "127.0.0.1";
/** Name this server advertises to MCP clients. */
export declare const SERVER_NAME = "dsh-session-mcp";
/** Key used in generated client configuration snippets. */
export declare const CLIENT_KEY = "dsh-sessions";
/** One `mcpServers` entry as most MCP clients accept it. */
export interface ClientEntry {
    readonly type: 'http';
    readonly url: string;
    readonly headers: {
        readonly Authorization: string;
    };
}
/** The copy-paste fragment written to the endpoint file. */
export interface ClientConfig {
    readonly mcpServers: Record<string, ClientEntry>;
}
/** Persisted endpoint state. */
export interface EndpointState {
    readonly version: 1;
    readonly name: string;
    readonly url: string;
    readonly host: string;
    /** Port the listener actually bound. */
    readonly port: number;
    /** Port the Settings page asked for; tried first on the next start. */
    readonly preferredPort: number;
    readonly token: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly client: ClientConfig;
}
/** The subset of stored state read back on restart. */
export interface StoredState {
    readonly token: string;
    readonly createdAt?: string;
    /** Port the user last chose; the listener tries it before the row config. */
    readonly preferredPort?: number;
}
/**
 * Resolve `$DSH_HOME` the way the launcher does.
 * @returns absolute Harness home.
 */
export declare function dshHome(): string;
/**
 * Absolute path of the endpoint state file.
 * @returns the file the server writes and clients read.
 */
export declare function stateFile(): string;
/**
 * Create a fresh opaque bearer token.
 * @returns 32 random bytes, base64url encoded.
 */
export declare function createToken(): string;
/**
 * Read the persisted endpoint state, if any.
 * @returns the stored state, or `undefined` when absent or unreadable.
 */
export declare function readState(): StoredState | undefined;
/**
 * Persist the endpoint state with owner-only permissions.
 * @param state - resolved endpoint facts and the client snippet.
 * @returns the file path written.
 */
export declare function writeState(state: EndpointState): string;
/**
 * Constant-time bearer comparison.
 * @param expected - the stored token.
 * @param header - the raw `Authorization` header value.
 * @returns true only for exactly `Bearer <expected>`.
 */
export declare function bearerMatches(expected: string, header: string | undefined): boolean;
/**
 * Build the copy-paste client configuration for this endpoint.
 * @param url - full MCP endpoint URL.
 * @param token - bearer token.
 * @returns an `mcpServers` fragment accepted by most MCP clients.
 */
export declare function clientConfig(url: string, token: string): ClientConfig;
/** Path of the authenticated config route the Settings page reads. */
export declare const CONFIG_ROUTE_PATH = "/api/dsh-session-mcp/config";
/** Path that moves the listener to another port. */
export declare const PORT_ROUTE_PATH = "/api/dsh-session-mcp/port";
/** Path that replaces the bearer token. */
export declare const TOKEN_ROUTE_PATH = "/api/dsh-session-mcp/token";
/** Lowest and highest port the Settings page accepts. */
export declare const PORT_RANGE: {
    readonly min: 1;
    readonly max: 65535;
};
/** Every snippet the Settings page offers for copying. */
export interface ConfigSnippets {
    /** `mcpServers` JSON for Claude Desktop, Cursor and other JSON clients. */
    readonly json: string;
    /** `~/.codex/config.toml` block. */
    readonly codexToml: string;
    /** One `claude mcp add` command. */
    readonly claudeCode: string;
}
/**
 * Render the copy-paste snippets for one endpoint.
 * @param url - full MCP endpoint URL.
 * @param token - bearer token.
 * @returns the three snippets the Settings page shows.
 */
export declare function snippetsFor(url: string, token: string): ConfigSnippets;
/** Live health of the MCP endpoint, as the Settings page shows it. */
export interface StatusPayload {
    /** `listening` while the plugin serves; the page never renders a dead endpoint as healthy. */
    readonly state: 'listening';
    readonly version: string;
    readonly startedAt: string;
    readonly uptimeMs: number;
    readonly totalCalls: number;
    readonly lastFailure: {
        readonly at: string;
        readonly tool: string;
        readonly message: string;
    } | null;
}
/** One journalled call with the conversation title resolved for display. */
export interface LogEntry {
    readonly id: number;
    readonly tool: string;
    readonly at: string;
    readonly sessionId: string | null;
    readonly sessionTitle: string | null;
    readonly ok: boolean;
    readonly ms: number;
    readonly error?: string;
}
/** What the Settings page receives from the Host. */
export interface ConfigPayload {
    readonly name: string;
    readonly url: string;
    readonly host: string;
    readonly port: number;
    readonly token: string;
    readonly updatedAt: string;
    readonly snippets: ConfigSnippets;
    readonly status: StatusPayload;
    readonly log: readonly LogEntry[];
}
