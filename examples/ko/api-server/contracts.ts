import type { Signal } from "behavon";

export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface LoginResult {
  readonly token: string;
  readonly user: PublicUser;
}

/** A failure the client may see. `status` is the HTTP status. */
export interface ApiFailure {
  readonly status: 400 | 401 | 409 | 500 | 503;
  readonly code: string;
  readonly message: string;
}

export function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === "object" && value !== null && "status" in value && "code" in value && "message" in value;
}

/** One HTTP request. The service answers with `reply` or `reject`; only the first answer counts. */
export interface ApiRequest<Input, Output> {
  readonly input: Input;
  reply(output: Output): void;
  reject(failure: ApiFailure): void;
}

export interface Authenticated {
  readonly token: string | undefined;
}

/** What the HTTP adapter calls. Each Signal is connected to exactly one service Slot. */
export interface GatewayPort {
  register: Signal<[request: ApiRequest<unknown, PublicUser>]>;
  login: Signal<[request: ApiRequest<unknown, LoginResult>]>;
  me: Signal<[request: ApiRequest<Authenticated, PublicUser>]>;
}
