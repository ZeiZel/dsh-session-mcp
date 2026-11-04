import type { PluginContext } from './types.js';
/** Stable Cordis plugin name. */
export declare const name = "dsh-session-mcp";
/** The session controller is the only capability this plugin needs. */
export declare const inject: readonly ['sessionController'];
/** Row configuration accepted by the bundle patch. */
export interface Config {
    /** Preferred loopback port; an ephemeral one is used when it is taken. */
    readonly port?: number;
    /** Bind address. Defaults to `127.0.0.1`. */
    readonly host?: string;
}
/**
 * Mount the endpoint.
 * @param ctx - Host context carrying `sessionController`.
 * @param config - Loader row config: `{ port?, host? }`.
 */
export declare function apply(ctx: PluginContext, config?: Config): Promise<void>;
