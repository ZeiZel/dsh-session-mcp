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
/** One reasoning effort a model route accepts. */
export interface ModelEffort {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
}
/** One selectable model inside a provider group. */
export interface CatalogModel {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly reasoning?: {
        readonly efforts?: readonly ModelEffort[];
        readonly defaultEffort?: string;
    };
}
/** One provider with its loaded catalog. */
export interface CatalogProvider {
    readonly id: string;
    readonly name: string;
    readonly models: readonly CatalogModel[];
}
/** One provider whose catalog lookup failed. */
export interface CatalogFailure {
    readonly id: string;
    readonly name: string;
    readonly message: string;
}
/** The Host-generation model catalog. */
export interface ModelCatalog {
    readonly default?: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: string;
    };
    readonly routableProviders?: readonly string[];
    readonly groups?: readonly CatalogProvider[];
    readonly failures?: readonly CatalogFailure[];
}
/** One durable Session projection read. */
export interface Projections {
    readonly kind?: string;
    readonly asOfSeq?: number;
    readonly values?: Record<string, unknown>;
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
    }, signal: AbortSignal): Promise<Projections | null>;
    rename(request: {
        sessionId: string;
        title: string;
    }): Promise<{
        title?: string;
        seq?: number;
    }>;
    fork(request: {
        sessionId: string;
        atSeq?: number;
        allowMigration?: boolean;
    }): Promise<{
        sessionId?: string;
    }>;
    cancel(request: {
        sessionId: string;
    }): {
        accepted?: boolean;
    };
    modelCatalog(): Promise<ModelCatalog>;
    selectModel(request: {
        sessionId: string;
        provider: string;
        model: string;
        reasoningEffort?: string;
    }): Promise<{
        selected?: {
            provider?: string;
            model?: string;
            reasoningEffort?: string;
        };
    }>;
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
    inject(deps: readonly string[], callback: (ctx: ConnectionContext) => void): void;
}
/** One exact Fetch route on the authenticated `/api` channel. */
export interface FetchRoute {
    readonly path: string;
    readonly methods: readonly string[];
    readonly requestBody: 'buffered' | 'streaming';
    readonly fetch: (request: Request) => Promise<Response>;
}
/** The slice of the Client Connection service a Host plugin can use. */
export interface ConnectionContext {
    readonly connection: {
        readonly fetch: {
            register(route: FetchRoute): unknown;
        };
    };
}
