// Extracts the example code blocks from docs/ into tests/docs/.generated/ as modules.
// API pages contribute the blocks under "## 예제"; intro pages contribute every block, grouped by section.
// Each module gets `import Behavon from "behavon"` when missing and exports its top-level values,
// so tests/docs can import and check exactly what the documentation shows.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");
const out = path.join(root, "tests/docs/.generated");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const pages = [
  ...readdirSync(docs).filter((name) => name.endsWith(".md")).map((name) => path.join(docs, name)),
  ...readdirSync(path.join(docs, "api")).map((name) => path.join(docs, "api", name)),
];

function blocks(text) {
  const result = [];
  let section = "";
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith("#")) section = lines[index];
    const fence = /^```(ts|tsx)$/.exec(lines[index]);
    if (!fence) continue;
    const body = [];
    for (index += 1; lines[index] !== "```"; index += 1) body.push(lines[index]);
    result.push({ section, language: fence[1], code: body.join("\n") });
  }
  return result;
}

function topLevelValues(code, language) {
  const ast = parse(code, { sourceType: "module", plugins: ["typescript", ...(language === "tsx" ? ["jsx"] : [])] });
  const names = [];
  for (const statement of ast.program.body) {
    if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations) if (declaration.id.type === "Identifier") names.push(declaration.id.name);
    }
    if ((statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") && statement.id) names.push(statement.id.name);
    if (statement.type === "ExportNamedDeclaration") {
      const declaration = statement.declaration;
      if (declaration?.type === "VariableDeclaration") {
        for (const item of declaration.declarations) if (item.id.type === "Identifier") names.push(`!${item.id.name}`);
      }
      if ((declaration?.type === "FunctionDeclaration" || declaration?.type === "ClassDeclaration") && declaration.id) names.push(`!${declaration.id.name}`);
    }
  }
  // Names already exported by the example itself are marked with "!" and skipped.
  return names.filter((name) => !name.startsWith("!"));
}

const written = [];
for (const page of pages) {
  const relative = path.relative(docs, page).replaceAll("\\", "/");
  const isApi = relative.startsWith("api/");
  const groups = new Map();
  for (const block of blocks(readFileSync(page, "utf8"))) {
    if (isApi && !block.section.startsWith("## 예제")) continue;
    // core-concepts builds one example across its sections.
    const key = relative === "core-concepts.md" ? "all" : block.section;
    const group = groups.get(key) ?? { language: "ts", code: [] };
    if (block.language === "tsx") group.language = "tsx";
    group.code.push(block.code);
    groups.set(key, group);
  }
  let index = 0;
  for (const group of groups.values()) {
    index += 1;
    let code = group.code.join("\n\n");
    if (!/import Behavon\b/.test(code)) code = `import Behavon from "behavon";\n${code}`;
    const names = topLevelValues(code, group.language);
    const name = `${relative.replace(/\.md$/, "").replaceAll("/", "-")}-${index}.${group.language}`;
    const exports = names.length > 0 ? `\nexport { ${names.join(", ")} };\n` : "\n";
    writeFileSync(path.join(out, name), `// Generated from docs/${relative}. Do not edit.\n${code}\n${exports}`);
    written.push(name);
  }
}
console.log(`Extracted ${written.length} documentation examples into tests/docs/.generated`);
