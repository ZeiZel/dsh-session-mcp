import type { McpServer } from '@modelcontextprotocol/server';
import type { SessionController } from './types.js';
/**
 * Register the session tools on one MCP server instance.
 * @param server - a fresh `McpServer` for one serving unit.
 * @param controller - the Harness `sessionController` service.
 */
export declare function registerTools(server: McpServer, controller: SessionController): void;
