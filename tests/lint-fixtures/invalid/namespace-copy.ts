import * as Behavon from "behavon";

const B = Behavon;
const C = Behavon as typeof Behavon;
let D: typeof Behavon;
D = Behavon as typeof Behavon;
const E = Behavon!;
const F = Behavon satisfies typeof Behavon;
function consume(_value: unknown): void {}
consume(Behavon);
function returnNamespace(): typeof Behavon {
  return Behavon;
}
const stored = { Behavon };
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
