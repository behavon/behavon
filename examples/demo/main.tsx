import { demoCases } from "./cases";
import { createDemoHost } from "./demo-host";

const picker = document.querySelector<HTMLSelectElement>("#case")!;
const host = createDemoHost(document.querySelector("#app")!, demoCases);

for (const item of demoCases) picker.append(new Option(item.label, item.id));

const showHash = () => {
  picker.value = host.show(location.hash.slice(1)).id;
};
picker.addEventListener("change", () => {
  location.hash = picker.value;
});
window.addEventListener("hashchange", showHash);
window.addEventListener("pagehide", () => host.dispose(), { once: true });
showHash();
