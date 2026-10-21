/** What a supplier sent back. */
export type QuoteAnswer =
  | { readonly kind: "offer"; readonly supplier: string; readonly unitPrice: number; readonly total: number }
  | { readonly kind: "declined"; readonly supplier: string }
  | { readonly kind: "failed"; readonly supplier: string; readonly message: string };

/** One round of quotes. Every supplier answers through `reply`. */
export interface QuoteRequest {
  readonly round: number;
  readonly item: string;
  readonly quantity: number;
  reply(answer: QuoteAnswer): void;
}
