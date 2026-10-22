import Behavon, { type Model, type Slot } from "behavon";
import type { QuoteRequest } from "./quote";

/** The supplier's price list. `undefined` means it cannot supply the item. */
export type PriceSource = (item: string, quantity: number) => Promise<number | undefined>;

export interface SupplierInput {
  readonly name: string;
  readonly priceOf: PriceSource;
}

export interface SupplierPort {
  quote: Slot<[request: QuoteRequest]>;
}

const supplierPort = Behavon.createPort<SupplierPort>({ quote: Behavon.SlotType() });

/** Looks up its price and answers the request when the price arrives. */
export const Supplier: Model<SupplierInput, undefined, SupplierPort> = (input) => {
  const { name, priceOf } = input;
  const quote = Behavon.useCallback(async (request: QuoteRequest) => {
    let unitPrice: number | undefined;
    try {
      unitPrice = await priceOf(request.item, request.quantity);
    } catch (reason) {
      request.reply({ kind: "failed", supplier: name, message: reason instanceof Error ? reason.message : String(reason) });
      return;
    }
    request.reply(
      unitPrice === undefined
        ? { kind: "declined", supplier: name }
        : { kind: "offer", supplier: name, unitPrice, total: unitPrice * request.quantity },
    );
  }, [name, priceOf]);
  Behavon.useSlot(supplierPort, "quote", quote);
  return undefined;
};
