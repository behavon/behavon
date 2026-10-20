import Behave from "behavon";

function useCounter(): number {
  const [value] = Behave.useState(0);
  return value;
}

export function CustomHookTryModel(): number {
  try {
    return useCounter();
  } catch {
    return 0;
  }
}
