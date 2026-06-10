import { BlurView } from "expo-blur";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../lib/theme";

const blurProps =
  Platform.OS === "android"
    ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
    : {};

export type ChatImageFrameVariant = "default" | "glass";

interface ChatImageFrameProps {
  uri: string;
  width: number;
  height: number;
  borderRadius: number;
  onPress?: () => void;
  variant?: ChatImageFrameVariant;
}

function fitInside(
  frameW: number,
  frameH: number,
  imgW: number,
  imgH: number
): { width: number; height: number } {
  const scale = Math.min(frameW / imgW, frameH / imgH);
  return {
    width: Math.max(1, Math.round(imgW * scale)),
    height: Math.max(1, Math.round(imgH * scale)),
  };
}

/** Chat image frame: blurred zoom fills letterbox gaps around the fitted image. */
export default function ChatImageFrame({
  uri,
  width,
  height,
  borderRadius,
  onPress,
  variant = "default",
}: ChatImageFrameProps) {
  const { colors, isDark } = useTheme();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const isGlass = variant === "glass";
  const inset = isGlass ? 8 : 0;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setNatural({ w, h });
      },
      () => {
        if (!cancelled) setNatural(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const fitted = useMemo(() => {
    if (!natural) return null;
    return fitInside(innerW, innerH, natural.w, natural.h);
  }, [natural, innerW, innerH]);

  const frostedTint = isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.28)";
  const glassBorder = isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.35)";

  const frame = (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: "hidden",
          borderWidth: isGlass ? 1 : StyleSheet.hairlineWidth,
          borderColor: isGlass ? glassBorder : colors.borderStrong,
        },
        isGlass && styles.glassShadow,
      ]}
    >
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFillObject, { transform: [{ scale: isGlass ? 1.35 : 1.25 }] }]}
        resizeMode="cover"
        blurRadius={Platform.OS === "ios" ? (isGlass ? 28 : 24) : 0}
      />
      {Platform.OS !== "web" && (isGlass || Platform.OS === "android") ? (
        <BlurView
          intensity={isGlass ? (isDark ? 36 : 44) : isDark ? 28 : 32}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFillObject}
          {...blurProps}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: isGlass
              ? frostedTint
              : Platform.OS === "web"
                ? "rgba(255,255,255,0.1)"
                : "transparent",
          },
        ]}
      />
      {fitted ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.foreground,
            isGlass && { padding: inset },
          ]}
        >
          <Image
            source={{ uri }}
            style={[fitted, isGlass && styles.glassImage]}
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{frame}</Pressable>;
  }
  return frame;
}

const styles = StyleSheet.create({
  foreground: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  glassShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
  glassImage: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
});
