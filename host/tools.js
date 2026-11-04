/**
 * The MCP tool surface over a DeepSeek Harness session controller.
 *
 * Every tool answers from `ctx.sessionController` in-process, as the owner, so
 * a prompt lands in the live conversation instead of opening a second writer on
 * the session log (which is what a `dsh --profile sdk`/`acp` resume of a live
 * session would collide with).
 *
 * @module dsh-session-mcp/tools
 */
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

/** Longest single message body returned to a client. */
const MAX_TEXT_CHARS = 4000

/** A signal that never aborts; the controller only needs a cancellation handle. */
function never() {
  return new AbortController().signal
}

/** Collapse one content-block array into readable text. */
function blocksToText(blocks) {
  if (typeof blocks === 'string') return blocks
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block.type === 'tool-call') parts.push(`[tool ${block.name ?? '?'} ${String(block.arguments ?? '').slice(0, 400)}]`)
    else if (block.type === 'image') parts.push('[image]')
  }
  return parts.join('\n').trim()
}

/**
 * Reduce one durable Session event to a compact message.
 * @param record - `{ type: 'event', event }` as returned by `sessionController.page`.
 * @returns a message, or `null` for events without conversational content.
 */
function reduceRecord(record) {
  const event = record?.event ?? record
  if (event === null || typeof event !== 'object') return null
  const data = event.data ?? {}
  const out = { seq: event.seq, type: event.type }
  if (event.time !== undefined) out.time = event.time

  if (event.type === 'user/message' || event.type === 'assistant/message') {
    out.role = data.message?.role ?? (event.type === 'user/message' ? 'user' : 'assistant')
    out.text = blocksToText(data.message?.content)
  } else if (event.type === 'tool/call') {
    out.role = 'tool'
    out.name = data.name
    out.text = String(data.arguments ?? '')
  } else if (event.type === 'tool/result') {
    out.role = 'tool'
    out.text = blocksToText(data.message?.content)
  } else {
    return null
  }
  if (typeof out.text === 'string' && out.text.length > MAX_TEXT_CHARS) {
    out.text = `${out.text.slice(0, MAX_TEXT_CHARS)}… [truncated]`
  }
  return out
}

/** Wrap one value as an MCP text result. */
function ok(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

/** Wrap one failure as an MCP error result. */
function fail(error) {
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text', text: message }], isError: true }
}

/**
 * Register the session tools on one MCP server instance.
 * @param server - a fresh `McpServer` for one serving unit.
 * @param controller - the Harness `sessionController` service.
 */
export function registerTools(server, controller) {
  server.registerTool(
    'sessions_list',
    {
      title: 'List conversations',
      description:
        'List DeepSeek Harness conversations with id, title, working directory, running state and token usage. Call this first to discover the sessionId to read or prompt.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(500).optional().describe('Maximum rows, newest first. Default 50.'),
      }),
    },
    async ({ limit }) => {
      try {
        const value = await controller.list({}, never())
        const rows = (value?.items ?? [])
          .slice()
          .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          .slice(0, limit ?? 50)
          .map((item) => ({
            sessionId: item.sessionId,
            title: item.projections?.values?.title ?? null,
            cwd: item.cwd ?? null,
            updatedAt: item.updatedAt !== undefined ? new Date(item.updatedAt).toISOString() : null,
            running: item.running === true,
            blank: item.blank === true,
            agentAvailable: item.agentAvailable === true,
            tokens: item.projections?.values?.tokenUsage ?? null,
          }))
        return ok({ count: rows.length, sessions: rows })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'session_read',
    {
      title: 'Read conversation history',
      description:
        'Read durable history of one conversation (user, assistant and tool messages). Use beforeSeq to page further back.',
      inputSchema: z.object({
        sessionId: z.string().min(1).describe('Conversation id from sessions_list.'),
        maxMessages: z.number().int().min(1).max(200).optional().describe('Roughly how many messages. Default 20.'),
        beforeSeq: z.number().int().min(0).optional().describe('Only return events before this sequence number.'),
      }),
    },
    async ({ sessionId, maxMessages, beforeSeq }) => {
      try {
        const rows = await controller.list({}, never())
        const cut = (rows?.items ?? []).find((item) => item.sessionId === sessionId)?.projections?.asOfSeq
        const throughSeq = typeof cut === 'number' ? cut : (await controller.projections({ sessionId }, never()))?.asOfSeq
        if (typeof throughSeq !== 'number') throw new Error(`Session ${sessionId} has no readable log cut`)
        const request = { address: { kind: 'session', sessionId }, throughSeq, maxMessages: maxMessages ?? 20 }
        if (beforeSeq !== undefined) request.beforeSeq = beforeSeq
        const page = await controller.page(request, never())
        const messages = (page?.records ?? []).map(reduceRecord).filter((entry) => entry !== null)
        return ok({ sessionId, throughSeq, hasMore: page?.hasMore === true, messages })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'session_send',
    {
      title: 'Send a message into a conversation',
      description:
        'Send a user message into an existing conversation. The message joins the live chat a human sees and starts a model turn. mode=queue waits for the current turn, mode=steer interrupts into it.',
      inputSchema: z.object({
        sessionId: z.string().min(1).describe('Conversation id from sessions_list.'),
        text: z.string().min(1).describe('Message text to deliver.'),
        mode: z.enum(['queue', 'steer']).optional().describe('Delivery mode. Default queue.'),
      }),
    },
    async ({ sessionId, text, mode }) => {
      try {
        if (text.trim().length === 0) throw new Error('text must contain non-whitespace content')
        const requestId = randomUUID()
        const value = await controller.prompt(
          {
            requestId,
            sessionId,
            mode: mode ?? 'queue',
            content: [{ type: 'text', text }],
          },
          never(),
        )
        return ok({ sessionId, requestId, mode: mode ?? 'queue', accepted: value?.accepted === true })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'session_create',
    {
      title: 'Open a new conversation',
      description:
        'Open a new blank conversation in the Harness and return its id. Combine with session_send to start work in a fresh chat.',
      inputSchema: z.object({
        cwd: z.string().min(1).optional().describe('Absolute directory the conversation works in.'),
        agentPreset: z.string().min(1).optional().describe('Agent preset name. Omit for the configured default.'),
      }),
    },
    async ({ cwd, agentPreset }) => {
      try {
        const request = {}
        if (cwd !== undefined) request.cwd = cwd
        if (agentPreset !== undefined) request.agentPreset = agentPreset
        const value = await controller.create(request)
        return ok({ sessionId: value?.sessionId, agentPreset: value?.agentPreset ?? null })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'session_search',
    {
      title: 'Search conversations',
      description:
        'Full-text search across conversations. Works only when the Harness has the session-query index enabled; otherwise the Host reports that search is disabled.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search text.'),
      }),
    },
    async ({ query }) => {
      try {
        const value = await controller.search({ query }, never())
        return ok({ items: value?.items ?? [], hasMore: value?.hasMore === true })
      } catch (error) {
        return fail(error)
      }
    },
  )
}
