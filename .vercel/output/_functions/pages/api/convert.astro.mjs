import { loadZodSchema, convertZodToPydantic, convertZodToTypescript } from 'schemabridge';
import { mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
export { renderers } from '../../renderers.mjs';

const MAX_CODE_SIZE = 100 * 1024;
const MAX_SCHEMAS = 10;
const prerender = false;
function sanitizeErrorMessage(message) {
  if (!message) return "Unknown error";
  return message.replace(/\/var\/folders\/[^\s]+/g, "[temp]").replace(/\/private\/var\/folders\/[^\s]+/g, "[temp]").replace(/\/tmp\/[^\s]+/g, "[temp]").replace(/\/Users\/[^\s]+/g, "[path]").replace(/[A-Za-z]:\\[^\s]+/g, "[path]").replace(/file:\/\/[^\s]+/g, "[file]");
}
function findExportedSchemas(code) {
  const matches = Array.from(code.matchAll(/export\s+(?:const|let|var)\s+(\w+)\s*=\s*z\./g));
  const uniqueNames = [];
  const seen = /* @__PURE__ */ new Set();
  const duplicateSet = /* @__PURE__ */ new Set();
  for (const match of matches) {
    const name = match[1];
    if (seen.has(name)) {
      duplicateSet.add(name);
      continue;
    }
    seen.add(name);
    uniqueNames.push(name);
  }
  return { names: uniqueNames, duplicates: Array.from(duplicateSet) };
}
function findNonExportedSchemas(code, exported) {
  const matches = Array.from(code.matchAll(/const\s+(\w+)\s*=\s*z\./g));
  return matches.map((match) => match[1]).filter((name) => !exported.has(name));
}
function extractImportsAndBody(output, isPython) {
  const lines = output.split("\n");
  const imports = [];
  const bodyLines = [];
  let inImports = true;
  for (const line of lines) {
    const trimmed = line.trim();
    const isImport = isPython ? trimmed.startsWith("from ") || trimmed.startsWith("import ") : trimmed.startsWith("import ");
    if (inImports && isImport) {
      imports.push(line);
    } else {
      inImports = false;
      bodyLines.push(line);
    }
  }
  const body = bodyLines.join("\n").replace(/\n+$/, "");
  return { imports, body };
}
function extractEnums(body, isPython) {
  const lines = body.split("\n");
  const enums = [];
  const remaining = [];
  let currentEnum = null;
  let enumIndent = 0;
  const enumStartPattern = isPython ? /^class\s+\w+Enum\(str,\s*Enum\):/ : /^enum\s+\w+\s*\{/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    if (trimmed.match(enumStartPattern)) {
      if (currentEnum) {
        enums.push(currentEnum.join("\n"));
      }
      currentEnum = [line];
      enumIndent = indent;
      continue;
    }
    if (currentEnum) {
      if (isPython) {
        const enumEnded = trimmed && indent <= enumIndent && !trimmed.match(/^\w+\s*=\s*["'`]/);
        if (enumEnded) {
          enums.push(currentEnum.join("\n"));
          currentEnum = null;
          i--;
          continue;
        }
        currentEnum.push(line);
        continue;
      } else {
        currentEnum.push(line);
        if (trimmed === "}") {
          enums.push(currentEnum.join("\n"));
          currentEnum = null;
        }
        continue;
      }
    }
    remaining.push(line);
  }
  if (currentEnum) {
    enums.push(currentEnum.join("\n"));
  }
  return { enums, bodyWithoutEnums: remaining.join("\n") };
}
function deduplicateImports(importGroups) {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const imports of importGroups) {
    for (const line of imports) {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        merged.push(line);
      }
    }
  }
  return merged;
}
function findNodeModules() {
  let currentDir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(currentDir, "node_modules");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }
  throw new Error("Could not find node_modules directory");
}
const POST = async ({ request }) => {
  const tempDir = join(
    tmpdir(),
    `schemabridge-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const tempFile = join(tempDir, "schema.ts");
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: `Invalid JSON body: ${sanitizeErrorMessage(error?.message)}`
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const { schemaCode, targetLanguage, zodVersion } = body ?? {};
    if (typeof schemaCode !== "string" || schemaCode.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "schemaCode must be a non-empty string."
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (typeof schemaCode !== "string" || Buffer.byteLength(schemaCode, "utf-8") > MAX_CODE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Schema code too large. Maximum ${MAX_CODE_SIZE} bytes allowed.`
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!["pydantic", "typescript"].includes(targetLanguage)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid targetLanguage. Supported values: "pydantic", "typescript".'
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!["3", "4"].includes(zodVersion)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid zodVersion. Supported values: "3", "4".'
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { names: exportNames, duplicates } = findExportedSchemas(schemaCode);
    if (exportNames.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No exported Zod schemas found. Export schemas with: export const mySchema = z.object(...)."
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (exportNames.length > MAX_SCHEMAS) {
      return new Response(
        JSON.stringify({
          error: `Too many schema exports. Maximum ${MAX_SCHEMAS} allowed, found ${exportNames.length}.`
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (duplicates.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Duplicate schema export names detected: ${duplicates.join(", ")}`
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const nonExported = findNonExportedSchemas(schemaCode, new Set(exportNames));
    const isPython = targetLanguage === "pydantic";
    await mkdir(tempDir, { recursive: true });
    const tempNodeModules = join(tempDir, "node_modules");
    await mkdir(tempNodeModules, { recursive: true });
    const nodeModulesRoot = findNodeModules();
    const zodPackageName = `zod-v${zodVersion}`;
    const zodSourcePath = join(nodeModulesRoot, zodPackageName);
    const zodLinkPath = join(tempNodeModules, zodPackageName);
    if (!existsSync(zodSourcePath)) {
      return new Response(
        JSON.stringify({
          error: `Zod v${zodVersion} is not available on the server.`
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!existsSync(zodLinkPath)) {
      await symlink(zodSourcePath, zodLinkPath, "dir");
    }
    const codeWithVersion = schemaCode.replace(/from\s+['"]zod['"]/g, `from '${zodPackageName}'`).replace(/require\((['"])zod\1\)/g, `require('${zodPackageName}')`);
    await writeFile(tempFile, codeWithVersion, "utf-8");
    const allImports = [];
    const allEnums = [];
    const bodyOutputs = [];
    const processedSchemas = /* @__PURE__ */ new Set();
    const seenErrors = /* @__PURE__ */ new Set();
    for (const exportName of exportNames) {
      if (processedSchemas.has(exportName)) continue;
      processedSchemas.add(exportName);
      try {
        const { schema } = await loadZodSchema({
          file: tempFile,
          exportName,
          registerTsLoader: true,
          allowUnresolved: false
        });
        const output = isPython ? convertZodToPydantic(schema, {
          name: exportName,
          enumStyle: "enum",
          enumBaseType: "str"
        }) : convertZodToTypescript(schema, { name: exportName });
        const { imports, body: body2 } = extractImportsAndBody(output, isPython);
        allImports.push(imports);
        const { enums, bodyWithoutEnums } = extractEnums(body2, isPython);
        allEnums.push(...enums.filter((block) => block.trim().length > 0));
        const cleanedBody = bodyWithoutEnums.replace(/^\s*\n+/g, "").replace(/\n+$/, "").trimEnd();
        if (cleanedBody) {
          bodyOutputs.push(cleanedBody);
        }
      } catch (error) {
        const sanitized = sanitizeErrorMessage(error?.message);
        const prefix = isPython ? "#" : "//";
        const concise = sanitized.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? sanitized;
        const key = `${exportName}:${concise}`;
        if (!seenErrors.has(key)) {
          seenErrors.add(key);
          bodyOutputs.push(`${prefix} Error converting '${exportName}': ${concise}`);
        }
        allImports.push([]);
      }
    }
    const mergedImports = deduplicateImports(allImports);
    const mergedEnums = Array.from(
      new Map(
        allEnums.filter((block) => block.trim().length > 0).map((block) => [block.trim(), block])
      ).values()
    );
    const seenBodies = /* @__PURE__ */ new Set();
    const uniqueBodyOutputs = bodyOutputs.filter((body2) => {
      const normalized = body2.trim();
      if (!normalized || seenBodies.has(normalized)) {
        return false;
      }
      seenBodies.add(normalized);
      return true;
    });
    const resultSections = [];
    if (mergedImports.length > 0) {
      resultSections.push(mergedImports.join("\n"));
    }
    if (mergedEnums.length > 0) {
      resultSections.push(mergedEnums.join("\n\n"));
    }
    if (uniqueBodyOutputs.length > 0) {
      resultSections.push(uniqueBodyOutputs.join("\n\n"));
    }
    if (nonExported.length > 0) {
      const prefix = isPython ? "#" : "//";
      resultSections.push(
        `${prefix} Note: Detected but not converted (not exported): ${nonExported.join(", ")}`
      );
    }
    return new Response(JSON.stringify({ output: resultSections.join("\n\n") }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error?.message);
    return new Response(JSON.stringify({ error: sanitized }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
    }
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
