import Behavon from "behavon";

const key: keyof typeof Behavon = "createModel";
const computed = Behavon[key];
const { useState } = Behavon;
const extracted = Behavon.useMemo;
const copied = Behavon;
const { ...facadeCopy } = Behavon;
const { ["useState"]: computedKnown } = Behavon;
const runtimeKey = Math.random() > 0.5 ? "useState" : "createModel";
const { [runtimeKey]: computedRuntime } = Behavon;

void computed;
void useState;
void extracted;
void copied;
void facadeCopy;
void computedKnown;
void computedRuntime;
