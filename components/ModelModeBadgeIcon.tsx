import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { platformShellIcon, platformShellLayout, resolveModelPlatform } from "../lib/model-platform";
import { resolveModelBrandKey } from "../lib/model-provider-logos";
import { ChatModelMode, ModelPlatform } from "../lib/types";
import ModelProviderIcon from "./ModelProviderIcon";
import { parseModelName } from "../lib/model-name";

type Props = {
  platform?: ModelPlatform;
  /** Resolved to a platform when `platform` is omitted. */
  mode?: ChatModelMode;
  /** Used with `mode` to distinguish Hub vs local PC for remote models. */
  baseUrl?: string | null;
  modelId?: string | null;
  provider?: string | null;
  /** Display label fallback for brand matching (e.g. model change divider). */
  label?: string | null;
  size?: number;
  color?: string;
  /** Grey provider logo inside the shell (unselected list rows). */
  monochrome?: boolean;
};

export default function ModelModeBadgeIcon({
  platform,
  mode,
  baseUrl,
  modelId,
  provider,
  label,
  size = 16,
  color = "#888",
  monochrome = false,
}: Props) {
  const resolvedPlatform =
    platform ?? (mode ? resolveModelPlatform(mode, baseUrl) : "pc");
  const parsed = modelId ? parseModelName(modelId) : null;
  const brandKey = resolveModelBrandKey(
    provider,
    parsed?.family,
    modelId ?? label
  );
  const shellIcon = platformShellIcon(resolvedPlatform);
  const { logoScale, logoTop } = platformShellLayout(resolvedPlatform, size);
  const logoSize = Math.max(6, Math.round(size * logoScale));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Ionicons name={shellIcon} size={size} color={color} />
      {brandKey ? (
        <View style={[styles.logo, { top: logoTop, width: size, height: logoSize }]}>
          <ModelProviderIcon
            provider={provider ?? parsed?.family ?? label}
            family={parsed?.family}
            modelId={modelId ?? label}
            size={logoSize}
            color={color}
            monochrome={monochrome}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logo: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
