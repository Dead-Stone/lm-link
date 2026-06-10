import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleProp, View, ViewStyle } from "react-native";
import { ModelBrandKey, resolveModelBrandKey } from "../lib/model-provider-logos";
import BrandLogoMark from "./BrandLogoMark";
import GoogleColorLogo from "./GoogleColorLogo";
import MicrosoftColorLogo from "./MicrosoftColorLogo";
import OpenAIColorLogo from "./OpenAIColorLogo";

type Props = {
  /** Publisher name, e.g. "Meta", "Google" */
  provider?: string | null;
  /** Parsed family, e.g. "Llama", "Mistral" */
  family?: string | null;
  /** Full model id for fallback matching */
  modelId?: string | null;
  /** Explicit brand override */
  brand?: ModelBrandKey | null;
  size?: number;
  color?: string;
  /** Render logo in a single neutral tone (no brand color). */
  monochrome?: boolean;
  style?: StyleProp<ViewStyle>;
};

function UnknownProviderMark({
  label,
  size,
  color,
  style,
}: {
  label: string;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const iconSize = Math.max(7, Math.round(size * 0.56));

  return (
    <View
      accessibilityLabel={label.trim() || "Unknown provider"}
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Ionicons name="cube-outline" size={iconSize} color={color} />
    </View>
  );
}

export default function ModelProviderIcon({
  provider,
  family,
  modelId,
  brand,
  size = 18,
  color = "#888",
  monochrome = false,
  style,
}: Props) {
  const brandKey =
    brand ?? resolveModelBrandKey(provider, family, modelId);

  if (!brandKey) {
    const fallbackLabel = provider ?? family ?? modelId ?? "?";
    return (
      <UnknownProviderMark
        label={fallbackLabel}
        size={size}
        color={color}
        style={style}
      />
    );
  }

  if (brandKey === "google" && !monochrome) {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <GoogleColorLogo size={size} />
      </View>
    );
  }

  if (brandKey === "microsoft" && !monochrome) {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <MicrosoftColorLogo size={size} />
      </View>
    );
  }

  if (brandKey === "openai") {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <OpenAIColorLogo size={size} color={monochrome ? color : "#412991"} />
      </View>
    );
  }

  if (brandKey === "lmstudio" && !monochrome) {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <Image
          source={require("../assets/lm-studio-logo.png")}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (brandKey === "huggingface" && !monochrome) {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <Image
          source={require("../assets/huggingface-logo.png")}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <BrandLogoMark
      brand={brandKey}
      size={size}
      color={color}
      monochrome={monochrome}
      style={style}
    />
  );
}
