#!/usr/bin/env node

/**
 * Writes android/local.properties during EAS builds when ANDROID_HOME is set.
 * Gradle accepts either ANDROID_HOME or sdk.dir in local.properties.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const androidDir = path.join(process.cwd(), "android");
if (!fs.existsSync(androidDir)) {
  process.exit(0);
}

const sdkDir =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "Library", "Android", "sdk");

if (!fs.existsSync(sdkDir)) {
  console.warn(
    "write-android-local-properties: SDK not found — set ANDROID_HOME before building"
  );
  process.exit(0);
}

const escaped = sdkDir.replace(/\\/g, "\\\\");
const contents = `sdk.dir=${escaped}\n`;
const target = path.join(androidDir, "local.properties");

fs.writeFileSync(target, contents);
console.log(`write-android-local-properties: wrote ${target}`);
