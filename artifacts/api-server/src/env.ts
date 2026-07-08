process.env.NODE_ENV = process.env.NODE_ENV || "development";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const searchDirs = [
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
];

console.log("[ENV LOADER] Searching for .env file in:", searchDirs);

let found = false;
for (const dir of searchDirs) {
  const envPath = path.resolve(dir, ".env");
  console.log(`[ENV LOADER] Checking ${envPath}...`);
  if (fs.existsSync(envPath)) {
    console.log(`[ENV LOADER] Found .env at ${envPath}`);
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIdx = trimmed.indexOf("=");
      if (separatorIdx > 0) {
        const key = trimmed.substring(0, separatorIdx).trim();
        const val = trimmed.substring(separatorIdx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
          console.log(`[ENV LOADER] Loaded ${key}`);
        }
      }
    }
    found = true;
    break;
  }
}

if (!found) {
  console.log("[ENV LOADER] No .env file found!");
}

