const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Polyfill punycode (required by markdown-it, removed from Node 22+)
config.resolver = config.resolver ?? {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  punycode: path.resolve(__dirname, "node_modules/punycode"),
};

module.exports = config;
