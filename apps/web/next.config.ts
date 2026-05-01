import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const cwd = process.cwd();
let merged: Record<string, string> = {};
for (const p of [
  resolve(cwd, "../../.env"),
  resolve(cwd, "../../.env.local"),
  resolve(cwd, ".env"),
  resolve(cwd, ".env.local"),
]) {
  merged = { ...merged, ...parseEnvFile(p) };
}
for (const [k, v] of Object.entries(merged)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
