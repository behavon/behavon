import Behavon from "behavon";

export function InvalidWebSocketModel(): WebSocket {
  // eslint-disable-next-line behavon-hooks/canonical-api -- invalid fixture uses the Hook only to establish Model evaluation
  const [value] = Behavon.useState(0);
  void value;
  return new WebSocket("wss://example.invalid");
}
