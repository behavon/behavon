import type { IncomingMessage, ServerResponse } from "node:http";
import type { TypedModelRef } from "behavon";
import { isApiFailure, type ApiFailure, type ApiRequest, type GatewayPort } from "./contracts";

const MAX_BODY_BYTES = 16 * 1024;

export interface HandlerOptions {
  /** How long to wait for the service to answer. */
  readonly timeoutMs?: number;
}

/**
 * Calls one gateway Signal and waits for the first `reply` or `reject`.
 * A Slot that throws while the Signal runs also ends the wait, so one broken handler answers 500
 * instead of taking the server down. Answers after the first, or after the timeout, are ignored.
 */
function dispatch<Input, Output>(send: (request: ApiRequest<Input, Output>) => void, input: Input, timeoutMs: number): Promise<Output> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      settle();
    };
    const timer = setTimeout(() => finish(() => reject(failure(503, "TIMEOUT", "응답 시간이 지났습니다"))), timeoutMs);
    try {
      send({
        input,
        reply: (output) => finish(() => resolve(output)),
        reject: (reason) => finish(() => reject(reason)),
      });
    } catch (reason) {
      finish(() => reject(reason));
    }
  });
}

function failure(status: ApiFailure["status"], code: string, message: string): ApiFailure {
  return { status, code, message };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw failure(400, "BODY_TOO_LARGE", "요청 본문이 너무 큽니다");
    chunks.push(chunk);
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw failure(400, "INVALID_JSON", "JSON 형식이 아닙니다");
  }
}

function bearer(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

/** Turns HTTP requests into gateway Signal calls. */
export function createHandler(gateway: TypedModelRef<GatewayPort>, options: HandlerOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const route = async (request: IncomingMessage): Promise<readonly [status: number, body: unknown]> => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const key = `${request.method} ${path}`;
    switch (key) {
      case "GET /health":
        return [200, { status: "ok" }];
      case "POST /users":
        return [201, await dispatch(gateway.register, await readJson(request), timeoutMs)];
      case "POST /sessions":
        return [200, await dispatch(gateway.login, await readJson(request), timeoutMs)];
      case "GET /me":
        return [200, await dispatch(gateway.me, { token: bearer(request) }, timeoutMs)];
      default:
        return [404, { error: { code: "NOT_FOUND", message: "없는 경로입니다" } }];
    }
  };
  return (request: IncomingMessage, response: ServerResponse) => {
    route(request).then(
      ([status, body]) => send(response, status, body),
      (reason: unknown) => {
        const { status, code, message } = isApiFailure(reason) ? reason : failure(500, "INTERNAL", "요청을 처리하지 못했습니다");
        send(response, status, { error: { code, message } });
      },
    );
  };
}
