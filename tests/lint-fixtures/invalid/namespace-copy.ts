import * as Behave from "behavon";

const B = Behave;
const C = Behave as typeof Behave;
let D: typeof Behave;
D = Behave as typeof Behave;
const E = Behave!;
const F = Behave satisfies typeof Behave;
function consume(_value: unknown): void {}
consume(Behave);
function returnNamespace(): typeof Behave {
  return Behave;
}
const stored = { Behave };
void C;
void D;
void E;
void F;
void returnNamespace;
void stored;

export function NamespaceCopyModel(): number {
  const [value] = B.useState(0);
  return value;
}
