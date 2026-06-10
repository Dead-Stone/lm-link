const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

/** Allow HTTP to LM Studio on the local network (required for release Android builds). */
function withLocalNetworkAccess(config) {
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$["android:usesCleartextTraffic"] = "true";
    }
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSLocalNetworkUsageDescription =
      cfg.modResults.NSLocalNetworkUsageDescription ??
      "LM Link for Android searches your local network to find and connect to LM Studio servers.";

    cfg.modResults.NSBonjourServices = [
      "_lmstudio._tcp",
      "_lmstudio-server._tcp",
      "_http._tcp",
    ];

    if (!cfg.modResults.NSAppTransportSecurity) {
      cfg.modResults.NSAppTransportSecurity = {};
    }
    cfg.modResults.NSAppTransportSecurity.NSAllowsLocalNetworking = true;

    return cfg;
  });

  return config;
}

module.exports = withLocalNetworkAccess;
