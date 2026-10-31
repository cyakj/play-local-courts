// Pure. Decides whether the response of an async fetch may still be applied.
// A response is applied only if (a) nothing has reset the ledger since the request started (account / community changed) and
// (b) no newer request for the same key has started since. This stops an older response from overwriting newer data and a
// response for a previous account from repopulating a cache that was just cleared.
export interface Ticket { epoch: number; seq: number; keys: string[] }

export class RequestLedger {
  private epoch = 0;
  private seq = 0;
  private latest = new Map<string, number>();

  /** Invalidate every outstanding request (call when the account or community changes). */
  reset(): void { this.epoch += 1; this.latest.clear(); }

  begin(keys: string[]): Ticket {
    const seq = ++this.seq;
    for (const k of keys) this.latest.set(k, seq);
    return { epoch: this.epoch, seq, keys: [...keys] };
  }

  /** The subset of the ticket's keys whose result may still be applied (empty when the whole ticket is stale). */
  live(t: Ticket): string[] {
    if (t.epoch !== this.epoch) return [];
    return t.keys.filter((k) => this.latest.get(k) === t.seq);
  }
}
