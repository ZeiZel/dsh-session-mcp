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
export const MAX_RECORDS = 5;
/** The journal itself. */
export class RequestJournal {
    records = [];
    total = 0;
    failure = null;
    startedAt = new Date().toISOString();
    /**
     * Append one completed call, dropping the oldest beyond {@link MAX_RECORDS}.
     * @param entry - everything but the id, which this method assigns.
     */
    record(entry) {
        this.total += 1;
        this.records.unshift({ id: this.total, ...entry });
        if (this.records.length > MAX_RECORDS)
            this.records.length = MAX_RECORDS;
        if (!entry.ok) {
            this.failure = {
                at: entry.at,
                tool: entry.tool,
                message: entry.error ?? 'the tool reported an error',
            };
        }
    }
    /** @returns the newest-first snapshot the Settings page renders. */
    snapshot() {
        return [...this.records];
    }
    /** @returns how many calls this endpoint served since it started. */
    get totalCalls() {
        return this.total;
    }
    /** @returns the most recent failure, or `null` when everything succeeded. */
    get lastFailure() {
        return this.failure;
    }
    /** @returns the ISO timestamp this endpoint started listening. */
    get startedAtIso() {
        return this.startedAt;
    }
}
