/**
 * Bounded request journal for the MCP endpoint.
 *
 * Only the last few tool calls are kept: enough for the Settings page to answer
 * "what just happened, and which conversation did it touch", without turning the
 * plugin into a log store.
 *
 * @module dsh-session-mcp/log
 */

/** How many calls the journal keeps. */
export const MAX_RECORDS = 5

/** One completed tool call. */
export interface RequestRecord {
  /** Monotonic id, so the page can key rows. */
  readonly id: number
  /** Wire tool name, for example `session_send`. */
  readonly tool: string
  /** ISO timestamp of completion. */
  readonly at: string
  /** Conversation the call addressed, when it addressed one. */
  readonly sessionId: string | null
  /** Whether the tool answered without `isError`. */
  readonly ok: boolean
  /** Wall-clock duration in milliseconds. */
  readonly ms: number
  /** Failure text for a failed call. */
  readonly error?: string
}

/** The failure the page surfaces in its status card. */
export interface LastFailure {
  readonly at: string
  readonly tool: string
  readonly message: string
}

/** The journal itself. */
export class RequestJournal {
  private readonly records: RequestRecord[] = []
  private total = 0
  private failure: LastFailure | null = null
  private readonly startedAt = new Date().toISOString()

  /**
   * Append one completed call, dropping the oldest beyond {@link MAX_RECORDS}.
   * @param entry - everything but the id, which this method assigns.
   */
  record(entry: Omit<RequestRecord, 'id'>): void {
    this.total += 1
    this.records.unshift({ id: this.total, ...entry })
    if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS
    if (!entry.ok) {
      this.failure = {
        at: entry.at,
        tool: entry.tool,
        message: entry.error ?? 'the tool reported an error',
      }
    }
  }

  /** @returns the newest-first snapshot the Settings page renders. */
  snapshot(): readonly RequestRecord[] {
    return [...this.records]
  }

  /** @returns how many calls this endpoint served since it started. */
  get totalCalls(): number {
    return this.total
  }

  /** @returns the most recent failure, or `null` when everything succeeded. */
  get lastFailure(): LastFailure | null {
    return this.failure
  }

  /** @returns the ISO timestamp this endpoint started listening. */
  get startedAtIso(): string {
    return this.startedAt
  }
}
