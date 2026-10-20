import Behave from "behavon";
import type { PortDescriptor, Signal } from "behavon";

export interface ImportedPort {
  fire: Signal;
  reset: Signal;
}

export const importedPort = Behave.createPort<ImportedPort>({
  fire: Behave.SignalType(),
  reset: Behave.SignalType(),
});

export function useImportedPort(port: PortDescriptor<ImportedPort>): void {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(port, "fire", fire);
}
