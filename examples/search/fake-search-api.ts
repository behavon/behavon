import type { SearchApi } from "./search";

interface PendingSearch {
  readonly query: string;
  readonly signal: AbortSignal;
  respond(results: readonly string[]): void;
  fail(message: string): void;
}

/** A search server whose answers the caller sends by hand, so the order of events is visible. */
export function createFakeSearchApi() {
  const requests: PendingSearch[] = [];
  const api: SearchApi = {
    search(query, signal) {
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        requests.push({
          query,
          signal,
          respond: resolve,
          fail: (message) => reject(new Error(message)),
        });
      });
    },
  };
  return {
    api,
    requests,
    /** The latest request for `query`. */
    request(query: string): PendingSearch {
      const found = requests.findLast((item) => item.query === query);
      if (found === undefined) throw new Error(`no request for ${query}`);
      return found;
    },
  };
}
