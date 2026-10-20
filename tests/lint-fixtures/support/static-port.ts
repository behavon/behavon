import Behavon from "behavon";
import type { PortDescriptor, Signal } from "behavon";

export interface ImportedPort {
  fire: Signal;
  reset: Signal;
}

export const importedPort = Behavon.createPort<ImportedPort>({
  fire: Behavon.SignalType(),
  reset: Behavon.SignalType(),
});

export function useImportedPort(port: PortDescriptor<ImportedPort>): void {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(port, "fire", fire);
}
