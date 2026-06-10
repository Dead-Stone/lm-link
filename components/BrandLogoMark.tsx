import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LETTER_MARK_BRANDS } from "../lib/custom-brand-logos";
import { BUNDLED_BRAND_LOGOS } from "../lib/brand-logo-paths";
import {
  BRAND_DISPLAY_COLORS,
  ModelBrandKey,
} from "../lib/model-provider-logos";

type Props = {
  brand: ModelBrandKey;
  size?: number;
  color?: string;
  monochrome?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Tinted letter mark when no bundled SVG exists or path is too heavy. */
export function StandardProviderMark({
  brand,
  size = 18,
  color = "#888",
  monochrome = false,
  style,
}: Props) {
  const accent = BRAND_DISPLAY_COLORS[brand] ?? color;
  const glyphColor = monochrome ? color : accent;
  const LABELS: Partial<Record<ModelBrandKey, string>> = {
    huggingface: "H",
    cohere: "C",
    alibaba: "A",
  };
  const label = LABELS[brand] ?? brand.charAt(0).toUpperCase();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          backgroundColor: monochrome ? "transparent" : `${accent}22`,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: Math.round(size * 0.52),
          fontWeight: "800",
          color: glyphColor,
          lineHeight: Math.round(size * 0.58),
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function BrandLogoMark({
  brand,
  size = 18,
  color = "#888",
  monochrome = false,
  style,
}: Props) {
  if (LETTER_MARK_BRANDS.has(brand)) {
    return (
      <StandardProviderMark
        brand={brand}
        size={size}
        color={color}
        monochrome={monochrome}
        style={style}
      />
    );
  }

  const bundled = BUNDLED_BRAND_LOGOS[brand];
  if (!bundled) {
    return (
      <StandardProviderMark
        brand={brand}
        size={size}
        color={color}
        monochrome={monochrome}
        style={style}
      />
    );
  }

  const fill = monochrome ? color : `#${bundled.hex}`;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={bundled.path} fill={fill} />
      </Svg>
    </View>
  );
}
