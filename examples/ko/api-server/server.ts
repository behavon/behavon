import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApplication } from "./application";
import { createHandler, type HandlerOptions } from "./http";

export interface ServerOptions extends HandlerOptions {
  /** 0 picks a free port. */
  readonly port?: number;
  readonly host?: string;
}

/**
 * Starts the HTTP server. `stop` first stops taking requests and waits for the ones in progress,
 * then releases the Models and the store, so no request reaches a released Model.
 */
export async function startServer(options: ServerOptions = {}) {
  const application = createApplication();
  const server = createServer(createHandler(application.gateway, options));
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port ?? 3000, options.host ?? "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (reason) {
    application.dispose();
    throw reason;
  }
  const { address, port } = server.address() as AddressInfo;
  let stopping: Promise<void> | undefined;
  return {
    url: `http://${address}:${port}`,
    stop(): Promise<void> {
      stopping ??= new Promise<void>((resolve, reject) => {
        server.close((error) => {
          application.dispose();
          if (error === undefined) resolve();
          else reject(error);
        });
      });
      return stopping;
    },
  };
}
