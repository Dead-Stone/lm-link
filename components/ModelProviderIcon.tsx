import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { SvgUri } from "react-native-svg";
import {
  getBrandLogoUri,
  ModelBrandKey,
  resolveModelBrandKey,
} from "../lib/model-provider-logos";
import GoogleColorLogo from "./GoogleColorLogo";

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
  const [failed, setFailed] = useState(false);

  const brandKey =
    brand ?? resolveModelBrandKey(provider, family, modelId);

  if (!brandKey || failed) {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <Ionicons name="cube-outline" size={size} color={color} />
      </View>
    );
  }

  if (brandKey === "google" && !monochrome) {
    return (
      <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
        <GoogleColorLogo size={size} />
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <SvgUri
        uri={
          monochrome
            ? getBrandLogoUri(brandKey, color)
            : getBrandLogoUri(brandKey)
        }
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
