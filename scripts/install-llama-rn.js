#!/usr/bin/env node

/**
 * Downloads llama.rn native artifacts with retries.
 * Used on EAS Build after RNLLAMA_SKIP_POSTINSTALL=1 skips the flaky postinstall.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DOWNLOAD_SCRIPT = path.join(
  __dirname,
  "../node_modules/llama.rn/install/download-native-artifacts.js"
);

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000, 60_000];

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy-wait so we don't need extra deps in CI.
  }
}

function main() {
  if (!fs.existsSync(DOWNLOAD_SCRIPT)) {
    console.log("install-llama-rn: llama.rn not installed, skipping");
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`install-llama-rn: download attempt ${attempt}/${MAX_ATTEMPTS}`);

    const result = spawnSync(process.execPath, [DOWNLOAD_SCRIPT], {
      stdio: "inherit",
      env: {
        ...process.env,
        RNLLAMA_SKIP_POSTINSTALL: "0",
      },
    });

    if (result.status === 0) {
      console.log("install-llama-rn: native artifacts ready");
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 60_000;
      console.warn(
        `install-llama-rn: download failed, retrying in ${Math.round(delay / 1000)}s…`
      );
      sleep(delay);
    }
  }

  console.error("install-llama-rn: failed to download native artifacts after retries");
  process.exit(1);
}

main();
