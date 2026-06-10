#!/usr/bin/env node
/**
 * Start Expo through a user-owned ngrok tunnel (reliable alternative to Expo's shared exp.direct token).
 *
 * Set NGROK_AUTHTOKEN in .env.local — free at https://dashboard.ngrok.com/get-started/your-authtoken
 */
import { spawn } from "child_process";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const ngrok = require("@expo/ngrok");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const token = process.env.NGROK_AUTHTOKEN?.trim();
if (!token) {
  console.error(`
NGROK_AUTHTOKEN is required for tunnel mode.

1. Sign up (free): https://ngrok.com
2. Copy your token: https://dashboard.ngrok.com/get-started/your-authtoken
3. Create .env.local in the project root:

   NGROK_AUTHTOKEN=your_token_here

Then run: npm run start:tunnel
`);
  process.exit(1);
}

const port = Number(process.env.RCT_METRO_PORT || process.env.EXPO_DEV_SERVER_PORT || 8081);
const expoArgs = ["expo", "start", "--lan", ...process.argv.slice(2)];

let expoProc = null;

async function cleanup() {
  try {
    await ngrok.kill();
  } catch {
    // ignore
  }
  if (expoProc && !expoProc.killed) {
    expoProc.kill("SIGTERM");
  }
}

async function main() {
  console.log("Starting ngrok tunnel…");
  const tunnelUrl = await ngrok.connect({
    authtoken: token,
    port,
    proto: "http",
    host_header: "localhost",
  });
  const proxyUrl = tunnelUrl.replace(/\/$/, "");
  console.log(`Tunnel ready: ${proxyUrl}`);

  expoProc = spawn("npx", expoArgs, {
    cwd: root,
    env: {
      ...process.env,
      EXPO_PACKAGER_PROXY_URL: proxyUrl,
    },
    stdio: "inherit",
    shell: true,
  });

  expoProc.on("exit", (code) => {
    cleanup().finally(() => process.exit(code ?? 0));
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
}

main().catch(async (err) => {
  console.error("Tunnel failed:", err.message || err);
  await cleanup();
  process.exit(1);
});
