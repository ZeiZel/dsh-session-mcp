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
export {};
