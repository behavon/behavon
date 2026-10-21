import Behavon, { type Model, type TypedModelRef } from "behavon";
import type { ApiRequest, Authenticated, GatewayPort, LoginResult, PublicUser } from "./contracts";
import { UserService, type UserServicePort } from "./user-service";
import { createUserStore } from "./user-store";

const gatewayPort = Behavon.createPort<GatewayPort>({
  register: Behavon.SignalType(),
  login: Behavon.SignalType(),
  me: Behavon.SignalType(),
});

/** The entry the HTTP adapter calls. It only sends; the connected service answers. */
export const Gateway: Model<undefined, undefined, GatewayPort> = () => {
  const register = Behavon.useCallback((_request: ApiRequest<unknown, PublicUser>) => undefined, []);
  Behavon.useSignal(gatewayPort, "register", register);
  Behavon.useExport(gatewayPort, "register");
  const login = Behavon.useCallback((_request: ApiRequest<unknown, LoginResult>) => undefined, []);
  Behavon.useSignal(gatewayPort, "login", login);
  Behavon.useExport(gatewayPort, "login");
  const me = Behavon.useCallback((_request: ApiRequest<Authenticated, PublicUser>) => undefined, []);
  Behavon.useSignal(gatewayPort, "me", me);
  Behavon.useExport(gatewayPort, "me");
  return undefined;
};

export interface RoutesInput {
  readonly gateway: TypedModelRef<GatewayPort>;
  readonly service: TypedModelRef<UserServicePort>;
}

/** Connects each gateway Signal to exactly one service Slot, so every request gets one answer. */
export const Routes: Model<RoutesInput, undefined> = (input) => {
  const gateway = Behavon.usePort(input.gateway);
  const service = Behavon.usePort(input.service);
  Behavon.useConnect(gateway.register, service.register);
  Behavon.useConnect(gateway.login, service.login);
  Behavon.useConnect(gateway.me, service.me);
  return undefined;
};

/** Creates the store, the service, the gateway, and the routes. `dispose` releases them in reverse order. */
export function createApplication() {
  const store = createUserStore();
  const service = Behavon.createModel(UserService, store);
  const gateway = Behavon.createModel(Gateway, undefined);
  const routes = Behavon.createModel(Routes, { gateway, service });
  const entry: TypedModelRef<GatewayPort> = gateway;
  return {
    gateway: entry,
    dispose() {
      routes.dispose();
      gateway.dispose();
      service.dispose();
      store.close();
    },
  };
}
