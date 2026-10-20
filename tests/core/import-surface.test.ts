/* eslint-disable behavon-hooks/canonical-api -- test-only probe compares default, namespace, and named export identities as values */
import { describe, expect, it } from "vitest";
import Behave, * as BehaveNamespace from "behavon";
import {
  boundary,
  createId,
  createModel,
  createPort,
  createResource,
  getInterface,
  getSnapshot,
  subscribe,
  SnapshotType,
  StateType,
  SignalType,
  SlotType,
  usePort,
  useCallback,
  useConnect,
  useEffect,
  useExport,
  useMemo,
  useModel,
  useMutable,
  useSignal,
  useSlot,
  useSnapshot,
  useState,
  useLabelState,
  useReducer,
  useFuture,
  useResource,
  useSyncExternalStore,
  transaction,
  futureDiagnostics,
} from "behavon";

describe("React-style Behave import surface", () => {
  it("exposes one frozen default facade over the exact named export functions", () => {
    const named = {
      createId,
      createPort,
      createResource,
      SnapshotType,
      StateType,
      SignalType,
      SlotType,
      useState,
      useLabelState,
      useReducer,
      useFuture,
      useResource,
      useMutable,
      useMemo,
      useCallback,
      useEffect,
      useExport,
      useSyncExternalStore,
      useSignal,
      useSlot,
      useModel,
      boundary,
      usePort,
      useConnect,
      useSnapshot,
      createModel,
      subscribe,
      getSnapshot,
      getInterface,
      transaction,
      futureDiagnostics,
    };

    expect(Object.isFrozen(Behave)).toBe(true);
    expect(Behave).toEqual(named);
    for (const [name, implementation] of Object.entries(named)) {
      expect(Behave[name as keyof typeof Behave]).toBe(implementation);
      expect(BehaveNamespace[name as keyof typeof named]).toBe(implementation);
    }
  });

  it("keeps namespace import compatibility alongside the default facade", () => {
    expect(BehaveNamespace.default).toBe(Behave);
    expect(BehaveNamespace.createModel).toBe(Behave.createModel);
    expect(BehaveNamespace.usePort).toBe(Behave.usePort);
    expect("use" in Behave).toBe(false);
    expect("use" in BehaveNamespace).toBe(false);
  });
});
