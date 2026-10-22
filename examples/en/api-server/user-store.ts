import { randomUUID } from "node:crypto";

export interface StoredUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly passwordSalt: string;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("email already registered");
    this.name = "DuplicateEmailError";
  }
}

/** Users and sessions kept in memory. A real server would put a database here. */
export function createUserStore() {
  const users = new Map<string, StoredUser>();
  const idsByEmail = new Map<string, string>();
  const sessions = new Map<string, string>();
  let closed = false;
  const open = () => {
    if (closed) throw new Error("user store is closed");
  };
  return {
    createUser(user: Omit<StoredUser, "id">): StoredUser {
      open();
      if (idsByEmail.has(user.email)) throw new DuplicateEmailError();
      const stored = { ...user, id: randomUUID() };
      users.set(stored.id, stored);
      idsByEmail.set(stored.email, stored.id);
      return stored;
    },
    findByEmail(email: string): StoredUser | undefined {
      open();
      const id = idsByEmail.get(email);
      return id === undefined ? undefined : users.get(id);
    },
    findById(id: string): StoredUser | undefined {
      open();
      return users.get(id);
    },
    createSession(token: string, userId: string): void {
      open();
      sessions.set(token, userId);
    },
    findSession(token: string): string | undefined {
      open();
      return sessions.get(token);
    },
    close(): void {
      closed = true;
    },
  };
}

export type UserStore = ReturnType<typeof createUserStore>;
