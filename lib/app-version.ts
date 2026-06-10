import Constants from "expo-constants";

export function appVersion(): string {
  return Constants.expoConfig?.version ?? "1.0.0";
}
