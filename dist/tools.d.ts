import type { McpServer } from '@modelcontextprotocol/server';
import type { RequestJournal } from './log.js';
import type { SessionController } from './types.js';
/**
 * Register the session tools on one MCP server instance.
 * @param server - a fresh `McpServer` for one serving unit.
 * @param controller - the Harness `sessionController` service.
 * @param journal - bounded request journal the Settings page reads.
 */
export declare function registerTools(server: McpServer, controller: SessionController, journal?: RequestJournal): void;
