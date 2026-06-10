import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { BRAND_MARK_BADGE_INSET_RATIO, brandMarkCornerMask } from "../lib/brand-mark";
import {
  LINK_BADGE_SIZE_RATIO,
  linkBadgeInsetPx,
  linkBadgePx,
} from "../lib/link-badge-art";

const androidBadge = require("../assets/android-badge.png");

const SIZES = { sm: 56, md: 80, lg: 104 } as const;

type BrandLogoSize = keyof typeof SIZES | number;

interface BrandLogoProps {
  size?: BrandLogoSize;
  /** @deprecated Mask is always applied — kept for call-site compatibility. */
  rounded?: boolean;
  /** Show the Android badge overlay (default true). */
  showLink?: boolean;
  /** Omit drop shadow — for small inline marks (e.g. settings footer). */
  flat?: boolean;
  /** Android badge size relative to logo canvas (default matches launcher icon). */
  linkSizeRatio?: number;
}

function resolveBox(size: BrandLogoSize): number {
  return typeof size === "number" ? size : SIZES[size];
}

/** LM Link brand mark — LM Studio logo, 3 curved + 1 sharp corner, Android badge bottom-right. */
export default function BrandLogo({
  size = "md",
  showLink = true,
  flat = false,
  linkSizeRatio = LINK_BADGE_SIZE_RATIO,
}: BrandLogoProps) {
  const box = resolveBox(size);
  const cornerMask = brandMarkCornerMask(box);
  const linkSize = linkBadgePx(box, linkSizeRatio);
  const inset = linkBadgeInsetPx(box, BRAND_MARK_BADGE_INSET_RATIO);
  const wrapStyle = flat ? styles.wrapFlat : styles.wrap;

  const logo = (
    <Image
      source={require("../assets/lm-studio-logo.png")}
      style={[{ width: box, height: box }, cornerMask]}
      resizeMode="cover"
    />
  );

  const androidHead = showLink ? (
    <View
      style={[
        styles.androidBadgeSlot,
        { width: linkSize, height: linkSize, right: inset, bottom: inset },
      ]}
    >
      <Image
        source={androidBadge}
        style={{ width: linkSize, height: linkSize }}
        resizeMode="contain"
      />
    </View>
  ) : null;

  return (
    <View style={[wrapStyle, styles.shell, { width: box, height: box }, cornerMask]}>
      <View style={[styles.clip, { width: box, height: box }, cornerMask]}>{logo}</View>
      {androidHead}
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
  clip: {
    overflow: "hidden",
  },
  androidBadgeSlot: {
    position: "absolute",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
});
