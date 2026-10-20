export { createPort as exportedCreatePort } from "behavon";

const behaveModule = "behavon" as const;
const behaveTemplate = `behavon`;

async function loadPortFactories(): Promise<void> {
  const dynamicDefault = (await import("behavon")).default;
  const { createPort: dynamicDestructured } = await import("behavon");
  const dynamicMember = (await import("behavon")).createPort;

  const requiredFacade = require("behavon");
  const { createPort: requiredDestructured } = require("behavon");
  const requiredMember = require("behavon").createPort;
  const aliasedDynamic = await import(behaveModule);
  const templateDynamic = await import(behaveTemplate);

  void dynamicDefault;
  void dynamicDestructured;
  void dynamicMember;
  void requiredFacade;
  void requiredDestructured;
  void requiredMember;
  void aliasedDynamic;
  void templateDynamic;
}

void loadPortFactories;
