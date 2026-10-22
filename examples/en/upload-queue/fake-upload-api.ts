import type { UploadApi } from "./upload-queue";

interface PendingUpload {
  readonly name: string;
  readonly signal: AbortSignal;
  finish(): void;
  fail(message: string): void;
}

/** An upload server whose uploads the caller finishes by hand. */
export function createFakeUploadApi() {
  const uploads: PendingUpload[] = [];
  const api: UploadApi = {
    upload(name, signal) {
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        uploads.push({ name, signal, finish: () => resolve(), fail: (message) => reject(new Error(message)) });
      });
    },
  };
  return {
    api,
    /** The names the server has been asked to upload, in order. */
    started: () => uploads.map((upload) => upload.name),
    upload(name: string): PendingUpload {
      const found = uploads.find((upload) => upload.name === name);
      if (found === undefined) throw new Error(`${name} has not started`);
      return found;
    },
  };
}
