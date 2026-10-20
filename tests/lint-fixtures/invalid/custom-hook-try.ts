import Behavon from "behavon";

function useCounter(): number {
  const [value] = Behavon.useState(0);
  return value;
}

export function CustomHookTryModel(): number {
  try {
    return useCounter();
  } catch {
    return 0;
  }
}
