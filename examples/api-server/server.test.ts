import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import Behavon, { type Model } from "behavon";
import { Gateway, Routes } from "./application";
import type { ApiRequest, Authenticated, LoginResult, PublicUser } from "./contracts";
import { createHandler } from "./http";
import { startServer } from "./server";
import type { UserServicePort } from "./user-service";

const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** A service whose `me` misbehaves, to see what the HTTP adapter does with it. */
const brokenServicePort = Behavon.createPort<UserServicePort>({
  register: Behavon.SlotType(),
  login: Behavon.SlotType(),
  me: Behavon.SlotType(),
});

const BrokenService: Model<"throws" | "silent" | "twice", undefined, UserServicePort> = (mode) => {
  const register = Behavon.useCallback((_request: ApiRequest<unknown, PublicUser>) => undefined, []);
  Behavon.useSlot(brokenServicePort, "register", register);
  const login = Behavon.useCallback((_request: ApiRequest<unknown, LoginResult>) => undefined, []);
  Behavon.useSlot(brokenServicePort, "login", login);
  const me = Behavon.useCallback((request: ApiRequest<Authenticated, PublicUser>) => {
    if (mode === "throws") throw new Error("bug in me");
    if (mode === "twice") {
      request.reply({ id: "1", email: "first@example.com", name: "처음" });
      request.reply({ id: "2", email: "second@example.com", name: "두 번째" });
      throw new Error("after the answer");
    }
  }, [mode]);
  Behavon.useSlot(brokenServicePort, "me", me);
  return undefined;
};

async function serveBroken(mode: "throws" | "silent" | "twice") {
  const service = Behavon.createModel(BrokenService, mode);
  const gateway = Behavon.createModel(Gateway, undefined);
  const routes = Behavon.createModel(Routes, { gateway, service });
  const server = createServer(createHandler(gateway, { timeoutMs: 50 }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      routes.dispose();
      gateway.dispose();
      service.dispose();
    },
  };
}

describe("api-server over HTTP", () => {
  it("registers, logs in, and reads the current user", async () => {
    const server = await startServer({ port: 0 });
    const registered = await fetch(`${server.url}/users`, json({ email: "kim@example.com", password: "correct horse", name: "김" }));
    expect(registered.status).toBe(201);
    const login = await fetch(`${server.url}/sessions`, json({ email: "kim@example.com", password: "correct horse" }));
    expect(login.status).toBe(200);
    const { token } = await login.json() as LoginResult;
    const me = await fetch(`${server.url}/me`, { headers: { authorization: `Bearer ${token}` } });
    expect(await me.json()).toEqual(await registered.json());
    await server.stop();
  });

  it("answers health, unknown paths, bad JSON, and failures with their status", async () => {
    const server = await startServer({ port: 0 });
    expect((await fetch(`${server.url}/health`)).status).toBe(200);
    expect((await fetch(`${server.url}/nowhere`)).status).toBe(404);
    const bad = await fetch(`${server.url}/users`, { method: "POST", body: "{" });
    expect([bad.status, await bad.json()]).toEqual([400, { error: { code: "INVALID_JSON", message: expect.any(String) } }]);
    const me = await fetch(`${server.url}/me`);
    expect([me.status, await me.json()]).toEqual([401, { error: { code: "UNAUTHORIZED", message: expect.any(String) } }]);
    await server.stop();
  });

  it("answers 500 when a Slot throws, and keeps serving", async () => {
    const server = await serveBroken("throws");
    const first = await fetch(`${server.url}/me`);
    expect([first.status, await first.json()]).toEqual([500, { error: { code: "INTERNAL", message: "요청을 처리하지 못했습니다" } }]);
    expect((await fetch(`${server.url}/health`)).status).toBe(200);
    expect((await fetch(`${server.url}/me`)).status).toBe(500);
    await server.close();
  });

  it("answers 503 when no one answers in time", async () => {
    const server = await serveBroken("silent");
    const response = await fetch(`${server.url}/me`);
    expect([response.status, (await response.json() as { error: { code: string } }).error.code]).toEqual([503, "TIMEOUT"]);
    await server.close();
  });

  it("keeps the first answer and ignores what comes after it", async () => {
    const server = await serveBroken("twice");
    const response = await fetch(`${server.url}/me`);
    expect([response.status, await response.json()]).toEqual([200, { id: "1", email: "first@example.com", name: "처음" }]);
    await server.close();
  });

  it("finishes the requests in progress before releasing the Models on stop", async () => {
    const server = await startServer({ port: 0 });
    const body = JSON.stringify({ email: "kim@example.com", password: "correct horse", name: "김" });
    let stopped: Promise<void> | undefined;
    // "100 Continue" arrives once the server has the request headers, so stop() is called mid-request.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const pending = request(`${server.url}/users`, {
        method: "POST",
        headers: { "content-type": "application/json", expect: "100-continue" },
      }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      pending.on("error", reject);
      pending.on("continue", () => {
        stopped = server.stop();
        pending.end(body);
      });
      pending.flushHeaders();
    });
    expect(status).toBe(201);
    await stopped;
    await expect(fetch(`${server.url}/health`)).rejects.toThrow();
  });
});
