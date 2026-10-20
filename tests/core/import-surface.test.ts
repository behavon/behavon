/* eslint-disable behavon-hooks/canonical-api -- test-only probe compares default, namespace, and named export identities as values */
import { describe, expect, it } from "vitest";
import Behavon, * as BehavonNamespace from "behavon";
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

describe("React-style Behavon import surface", () => {
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

    expect(Object.isFrozen(Behavon)).toBe(true);
    expect(Behavon).toEqual(named);
    for (const [name, implementation] of Object.entries(named)) {
      expect(Behavon[name as keyof typeof Behavon]).toBe(implementation);
      expect(BehavonNamespace[name as keyof typeof named]).toBe(implementation);
    }
  });

  it("keeps namespace import compatibility alongside the default facade", () => {
    expect(BehavonNamespace.default).toBe(Behavon);
    expect(BehavonNamespace.createModel).toBe(Behavon.createModel);
    expect(BehavonNamespace.usePort).toBe(Behavon.usePort);
    expect("use" in Behavon).toBe(false);
    expect("use" in BehavonNamespace).toBe(false);
  });
});
