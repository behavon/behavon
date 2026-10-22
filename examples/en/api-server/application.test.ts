import { describe, expect, it } from "vitest";
import type { ApiFailure, ApiRequest } from "./contracts";
import { createApplication } from "./application";

type Answer<Output> = { readonly ok: true; readonly value: Output } | { readonly ok: false; readonly failure: ApiFailure };

/** Sends one request and collects every answer, to check that exactly one arrives. */
async function ask<Input, Output>(send: (request: ApiRequest<Input, Output>) => void, input: Input) {
  const answers: Answer<Output>[] = [];
  await new Promise<void>((resolve) => {
    send({
      input,
      reply: (value) => { answers.push({ ok: true, value }); resolve(); },
      reject: (failure) => { answers.push({ ok: false, failure }); resolve(); },
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(answers).toHaveLength(1);
  return answers[0];
}

const kim = { email: " Kim@Example.com ", password: "correct horse", name: "Kim" };

describe("api-server application", () => {
  it("registers, logs in, and reads the current user", async () => {
    const { gateway, dispose } = createApplication();
    const registered = await ask(gateway.register, kim);
    expect(registered).toEqual({ ok: true, value: { id: expect.any(String), email: "kim@example.com", name: "Kim" } });

    const login = await ask(gateway.login, { email: "kim@example.com", password: "correct horse" });
    if (!login.ok) throw new Error("login failed");
    expect(login.value.user).toEqual(registered.ok ? registered.value : undefined);

    expect(await ask(gateway.me, { token: login.value.token })).toEqual(registered);
    dispose();
  });

  it("refuses a second registration with the same email", async () => {
    const { gateway, dispose } = createApplication();
    await ask(gateway.register, kim);
    expect(await ask(gateway.register, { ...kim, email: "kim@example.com" })).toMatchObject({
      ok: false,
      failure: { status: 409, code: "EMAIL_EXISTS" },
    });
    dispose();
  });

  it("refuses invalid registrations", async () => {
    const { gateway, dispose } = createApplication();
    for (const input of [undefined, "text", { ...kim, email: "kim" }, { ...kim, password: "short" }, { ...kim, name: " " }]) {
      expect(await ask(gateway.register, input)).toMatchObject({ ok: false, failure: { status: 400, code: "VALIDATION" } });
    }
    dispose();
  });

  it("answers a wrong password and an unknown email the same way", async () => {
    const { gateway, dispose } = createApplication();
    await ask(gateway.register, kim);
    const wrong = await ask(gateway.login, { email: "kim@example.com", password: "wrong password" });
    const unknown = await ask(gateway.login, { email: "lee@example.com", password: "correct horse" });
    expect(wrong).toEqual({ ok: false, failure: { status: 401, code: "INVALID_CREDENTIALS", message: expect.any(String) } });
    expect(unknown).toEqual(wrong);
    dispose();
  });

  it("requires a valid token for the current user", async () => {
    const { gateway, dispose } = createApplication();
    expect(await ask(gateway.me, { token: undefined })).toMatchObject({ ok: false, failure: { status: 401, code: "UNAUTHORIZED" } });
    expect(await ask(gateway.me, { token: "made-up" })).toMatchObject({ ok: false, failure: { status: 401, code: "UNAUTHORIZED" } });
    dispose();
  });
});
