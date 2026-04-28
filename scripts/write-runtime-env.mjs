import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.cwd(), "src");
const outFile = resolve(outDir, "runtime-env.js");
const debug = String(process.env.DEBUG || "").toLowerCase() === "true";

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `export const DEBUG = ${debug};\n`, "utf8");

console.log(`[runtime-env] DEBUG=${debug}`);
