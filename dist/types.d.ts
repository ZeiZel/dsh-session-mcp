/**
 * The narrow slice of DeepSeek Harness types this package depends on.
 *
 * The plugin ships as a standalone npm package, so it does not import the
 * harness's own type packages (which resolve only inside a Harness profile).
 * These structural declarations mirror the parts of `ctx.sessionController`
 * and the Cordis plugin context the bridge actually uses.
 *
 * @module dsh-session-mcp/types
 */
/** One conversation row as `sessionController.list` reports it. */
export interface SessionSummary {
    readonly sessionId: string;
    readonly updatedAt?: number;
    readonly cwd?: string;
    readonly running?: boolean;
    readonly blank?: boolean;
    readonly agentAvailable?: boolean;
    readonly projections?: {
        readonly asOfSeq?: number;
        readonly values?: {
            readonly title?: string | null;
            readonly tokenUsage?: unknown;
        };
    };
}
/** A durable conversation event envelope. */
export interface SessionEventRecord {
    readonly type?: string;
    readonly event?: {
        readonly type?: string;
        readonly seq?: number;
        readonly time?: number;
        readonly data?: Record<string, unknown>;
    };
}
/** One page of durable history. */
export interface SessionPage {
    readonly records?: readonly SessionEventRecord[];
    readonly hasMore?: boolean;
}
/** One message part accepted by `prompt`. */
export interface PromptContentPart {
    readonly type: 'text';
    readonly text: string;
}
/** The controller surface used by the MCP tools. */
export interface SessionController {
    list(request: Record<string, never>, signal: AbortSignal): Promise<{
        items?: readonly SessionSummary[];
    }>;
    page(request: Record<string, unknown>, signal: AbortSignal): Promise<SessionPage>;
    prompt(request: Record<string, unknown>, signal: AbortSignal): Promise<{
        accepted?: boolean;
    }>;
    create(request: Record<string, unknown>): Promise<{
        sessionId?: string;
        agentPreset?: string;
    }>;
    search(request: {
        query: string;
    }, signal: AbortSignal): Promise<{
        items?: unknown[];
        hasMore?: boolean;
    }>;
    projections(request: {
        sessionId: string;
    }, signal: AbortSignal): Promise<{
        asOfSeq?: number;
    } | null>;
}
/** Minimal logger surface shared by Cordis and this package's tests. */
export interface PluginLogger {
    info?(message: string): void;
    warn?(message: string): void;
}
/** Minimal Cordis plugin context used by {@link apply}. */
export interface PluginContext {
    readonly sessionController: SessionController;
    readonly logger?: PluginLogger;
    effect(setup: () => () => void, label?: string): void;
}
