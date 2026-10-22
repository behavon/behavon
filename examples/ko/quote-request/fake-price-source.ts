import type { PriceSource } from "./supplier";

interface PendingPrice {
  readonly item: string;
  readonly quantity: number;
  answer(unitPrice: number | undefined): void;
  fail(message: string): void;
}

/** A price list whose answers the caller sends by hand, so the arrival order is visible. */
export function createFakePriceSource() {
  const requests: PendingPrice[] = [];
  const priceOf: PriceSource = (item, quantity) =>
    new Promise((resolve, reject) => {
      requests.push({ item, quantity, answer: resolve, fail: (message) => reject(new Error(message)) });
    });
  return {
    priceOf,
    requests,
    /** The latest request. */
    latest(): PendingPrice {
      const found = requests.at(-1);
      if (found === undefined) throw new Error("no price request");
      return found;
    },
  };
}
