import Behavon, { type Model, type Slot } from "behavon";
import type { ApiFailure, ApiRequest, Authenticated, LoginResult, PublicUser } from "./contracts";
import { isApiFailure } from "./contracts";
import { createToken, hashPassword, verifyPassword } from "./security";
import { DuplicateEmailError, type StoredUser, type UserStore } from "./user-store";

export interface UserServicePort {
  register: Slot<[request: ApiRequest<unknown, PublicUser>]>;
  login: Slot<[request: ApiRequest<unknown, LoginResult>]>;
  me: Slot<[request: ApiRequest<Authenticated, PublicUser>]>;
}

const userServicePort = Behavon.createPort<UserServicePort>({
  register: Behavon.SlotType(),
  login: Behavon.SlotType(),
  me: Behavon.SlotType(),
});

const fail = (status: ApiFailure["status"], code: string, message: string): ApiFailure => ({ status, code, message });
const invalidCredentials = fail(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않습니다");
const unauthorized = fail(401, "UNAUTHORIZED", "로그인이 필요합니다");

function field(body: unknown, name: string): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

const normalizeEmail = (value: string | undefined) => value?.trim().toLowerCase();
const isEmail = (value: string | undefined): value is string => value !== undefined && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const toPublicUser = ({ id, email, name }: StoredUser): PublicUser => ({ id, email, name });

/** Answers with the failure it was given, and with a 500 for anything unexpected. */
function rejectWith(request: ApiRequest<unknown, unknown>, reason: unknown) {
  if (reason instanceof DuplicateEmailError) return request.reject(fail(409, "EMAIL_EXISTS", "이미 가입한 이메일입니다"));
  request.reject(isApiFailure(reason) ? reason : fail(500, "INTERNAL", "요청을 처리하지 못했습니다"));
}

/** Registration, login, and the current user. Every request is answered through its `reply` or `reject`. */
export const UserService: Model<UserStore, undefined, UserServicePort> = (store) => {
  const register = Behavon.useCallback((request: ApiRequest<unknown, PublicUser>) => {
    const email = normalizeEmail(field(request.input, "email"));
    const password = field(request.input, "password");
    const name = field(request.input, "name")?.trim();
    if (!isEmail(email) || password === undefined || password.length < 8 || name === undefined || name === "") {
      return request.reject(fail(400, "VALIDATION", "이메일, 이름, 8자 이상의 비밀번호가 필요합니다"));
    }
    hashPassword(password)
      .then((credentials) => request.reply(toPublicUser(store.createUser({ email, name, ...credentials }))))
      .catch((reason: unknown) => rejectWith(request, reason));
  }, [store]);
  Behavon.useSlot(userServicePort, "register", register);

  const login = Behavon.useCallback((request: ApiRequest<unknown, LoginResult>) => {
    const email = normalizeEmail(field(request.input, "email"));
    const password = field(request.input, "password");
    const user = email === undefined ? undefined : store.findByEmail(email);
    if (password === undefined || user === undefined) return request.reject(invalidCredentials);
    verifyPassword(password, user).then((verified) => {
      if (!verified) return request.reject(invalidCredentials);
      const token = createToken();
      store.createSession(token, user.id);
      request.reply({ token, user: toPublicUser(user) });
    }).catch((reason: unknown) => rejectWith(request, reason));
  }, [store]);
  Behavon.useSlot(userServicePort, "login", login);

  const me = Behavon.useCallback((request: ApiRequest<Authenticated, PublicUser>) => {
    const userId = request.input.token === undefined ? undefined : store.findSession(request.input.token);
    const user = userId === undefined ? undefined : store.findById(userId);
    if (user === undefined) return request.reject(unauthorized);
    request.reply(toPublicUser(user));
  }, [store]);
  Behavon.useSlot(userServicePort, "me", me);

  return undefined;
};
