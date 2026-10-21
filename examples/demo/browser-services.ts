import type { Connection, DatabaseDriver, Row } from "../db-session/db-session";
import type { PriceSource } from "../quote-request/supplier";
import type { SearchApi } from "../search/search";
import type { UploadApi } from "../upload-queue/upload-queue";

/** Resolves after `ms`, or rejects with the signal's reason when it aborts first. */
function after<Value>(ms: number, signal: AbortSignal | undefined, produce: () => Value): Promise<Value> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      try {
        resolve(produce());
      } catch (reason) {
        reject(reason);
      }
    }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const fruits = ["사과", "배", "포도", "복숭아", "자두", "수박", "참외", "딸기", "블루베리", "바나나"];

/** Answers after 300ms. Searching for "느림" takes 2 seconds, so a newer search cancels it. */
export const searchApi: SearchApi = {
  search: (query, signal) =>
    after(query.includes("느림") ? 2_000 : 300, signal, () => fruits.filter((fruit) => fruit.includes(query))),
};

/** Each upload takes a second. A name containing "실패" fails. */
export const uploadApi: UploadApi = {
  upload: (name, signal) =>
    after(1_000, signal, () => {
      if (name.includes("실패")) throw new Error("서버가 거부했습니다");
    }),
};

const orders: readonly Row[] = [
  { id: 1, customer: "김", total: 12_000 },
  { id: 2, customer: "이", total: 48_000 },
  { id: 3, customer: "박", total: 7_500 },
  { id: 4, customer: "최", total: 91_000 },
];

/** Connects in 500ms. A query takes 2 seconds, so there is time to cancel it. */
export const databaseDriver: DatabaseDriver = {
  connect: (_url, signal) =>
    after(500, signal, (): Connection => ({
      query: (_sql, params, querySignal) =>
        after(2_000, querySignal, () =>
          orders.filter((row) => Number(row.total) >= Number(params[0])).toSorted((a, b) => Number(b.total) - Number(a.total))),
      close: () => after(200, undefined, () => undefined),
      destroy: () => undefined,
    })),
};

/** A supplier that answers after `delay` with `base` per unit, or cannot supply items containing `missing`. */
export function priceSource(delay: number, base: number, missing: string): PriceSource {
  return (item, quantity) => after(delay, undefined, () => (item.includes(missing) ? undefined : base - Math.min(quantity, 50)));
}
