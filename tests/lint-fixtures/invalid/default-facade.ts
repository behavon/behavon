import Behave from "behavon";

const key: keyof typeof Behave = "createModel";
const computed = Behave[key];
const { useState } = Behave;
const extracted = Behave.useMemo;
const copied = Behave;
const { ...facadeCopy } = Behave;
const { ["useState"]: computedKnown } = Behave;
const runtimeKey = Math.random() > 0.5 ? "useState" : "createModel";
const { [runtimeKey]: computedRuntime } = Behave;

void computed;
void useState;
void extracted;
void copied;
void facadeCopy;
void computedKnown;
void computedRuntime;
