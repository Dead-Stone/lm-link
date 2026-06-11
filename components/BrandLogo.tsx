import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { brandMarkCornerMask } from "../lib/brand-mark";

const brandMark = require("../assets/lm-studio-android-final.png");
const lmStudioOnly = require("../assets/lm-studio-logo.png");

const SIZES = { sm: 56, md: 80, lg: 104 } as const;

type BrandLogoSize = keyof typeof SIZES | number;

interface BrandLogoProps {
  size?: BrandLogoSize;
  /** @deprecated Mask is always applied — kept for call-site compatibility. */
  rounded?: boolean;
  /** Show the Android badge overlay (default true). Uses full mark vs LM Studio bars only. */
  showLink?: boolean;
  /** Omit drop shadow — for small inline marks (e.g. settings footer). */
  flat?: boolean;
  /** @deprecated Badge is baked into the final mark — kept for call-site compatibility. */
  linkSizeRatio?: number;
}

function resolveBox(size: BrandLogoSize): number {
  return typeof size === "number" ? size : SIZES[size];
}

/** LM Link brand mark — LM Studio logo + android head (bottom-right, -45°). */
export default function BrandLogo({
  size = "md",
  showLink = true,
  flat = false,
}: BrandLogoProps) {
  const box = resolveBox(size);
  const cornerMask = brandMarkCornerMask(box);
  const wrapStyle = flat ? styles.wrapFlat : styles.wrap;
  const source = showLink ? brandMark : lmStudioOnly;

  return (
    <View style={[wrapStyle, styles.shell, { width: box, height: box }]}>
      <Image
        source={source}
        style={[{ width: box, height: box }, showLink ? cornerMask : undefined]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  wrapFlat: {
    position: "relative",
  },
  shell: {
    backgroundColor: "transparent",
  },
});
