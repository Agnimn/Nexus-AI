import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

// Load .env file from workspace root or parent
const searchPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];

for (const envPath of searchPaths) {
  if (fs.existsSync(envPath)) {
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
        }
      }
    }
    break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Ensure the database is provisioned.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
