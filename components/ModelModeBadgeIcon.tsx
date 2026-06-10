import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { CATALOG_SOURCE_LOGOS } from "../lib/catalog-source-logos";
import { platformShellIcon, platformShellLayout, resolveModelPlatform } from "../lib/model-platform";
import { LibraryDownloadSource } from "../lib/remote-model-library";
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
  /** Full-color brand logo inside the shell (model library lists). */
  colorfulLogo?: boolean;
  /** Grey provider logo inside the shell (empty / placeholder states). */
  monochrome?: boolean;
  /** LM Studio / Hugging Face badge on the shell corner. */
  catalogSource?: LibraryDownloadSource | null;
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
  colorfulLogo = false,
  monochrome = false,
  catalogSource = null,
}: Props) {
  const logoMonochrome = colorfulLogo ? false : monochrome;
  const resolvedPlatform =
    platform ?? (mode ? resolveModelPlatform(mode, baseUrl) : "pc");
  const parsed = modelId ? parseModelName(modelId) : null;
  const shellIcon = platformShellIcon(resolvedPlatform);
  const { logoScale, logoTop } = platformShellLayout(resolvedPlatform, size);
  const logoSize = Math.max(8, Math.round(size * logoScale));
  const sourceBadgeSize = Math.max(9, Math.round(size * 0.4));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Ionicons name={shellIcon} size={size} color={color} />
      <View style={[styles.logo, { top: logoTop, width: size, height: logoSize }]}>
        <ModelProviderIcon
          provider={provider ?? parsed?.family ?? label}
          family={parsed?.family}
          modelId={modelId ?? label}
          size={logoSize}
          color={color}
          monochrome={logoMonochrome}
        />
      </View>
      {catalogSource ? (
        <View
          style={[
            styles.sourceBadge,
            {
              width: sourceBadgeSize,
              height: sourceBadgeSize,
              borderRadius: sourceBadgeSize / 2,
              right: -Math.round(size * 0.06),
              bottom: -Math.round(size * 0.05),
            },
          ]}
        >
          <Image
            source={CATALOG_SOURCE_LOGOS[catalogSource]}
            style={{ width: sourceBadgeSize, height: sourceBadgeSize }}
            resizeMode="cover"
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
    overflow: "visible",
  },
  logo: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceBadge: {
    position: "absolute",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
});
