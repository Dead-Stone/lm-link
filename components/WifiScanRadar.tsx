import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { radarBlipColor, radarBlipPosition } from "../lib/scan-device-names";
import { ThemeColors } from "../lib/theme";

const SWEEP_MS = 3200;
const SWEEP_DEG = 72;
const BLIP_SIZE = 44;

export type RadarDevice = {
  url: string;
  displayName: string;
};

type Props = {
  active: boolean;
  size?: number;
  colors: ThemeColors;
  devices?: RadarDevice[];
  onSelectDevice?: (url: string, displayName: string) => void;
};

function sweepPath(cx: number, cy: number, radius: number, sweepDeg: number): string {
  const half = (sweepDeg * Math.PI) / 360;
  const start = -Math.PI / 2 - half;
  const end = -Math.PI / 2 + half;
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export default function WifiScanRadar({
  active,
  size = 280,
  colors,
  devices = [],
  onSelectDevice,
}: Props) {
  const styles = useMemo(() => createStyles(size, colors), [size, colors]);
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2;
  const gridRadii = [radius * 0.33, radius * 0.66, radius];

  useEffect(() => {
    if (!active) {
      sweep.setValue(0);
      pulse.setValue(0);
      return;
    }

    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: SWEEP_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: SWEEP_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    sweepLoop.start();
    pulseLoop.start();

    return () => {
      sweepLoop.stop();
      pulseLoop.stop();
    };
  }, [active, pulse, sweep]);

  const rotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.28],
  });

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.fieldClip}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={colors.primaryLight}
            strokeWidth={1}
            fill={colors.primaryGlow}
            opacity={0.35}
          />
          {gridRadii.map((r, index) => (
            <Circle
              key={`ring-${index}`}
              cx={cx}
              cy={cy}
              r={r}
              stroke={colors.primaryLight}
              strokeWidth={1}
              fill="none"
              opacity={0.18}
            />
          ))}
          <Line
            x1={cx}
            y1={cy - radius}
            x2={cx}
            y2={cy + radius}
            stroke={colors.primaryLight}
            strokeWidth={1}
            opacity={0.16}
          />
          <Line
            x1={cx - radius}
            y1={cy}
            x2={cx + radius}
            y2={cy}
            stroke={colors.primaryLight}
            strokeWidth={1}
            opacity={0.16}
          />
        </Svg>

        {active ? (
          <Animated.View
            style={[
              styles.sweepLayer,
              {
                transform: [{ rotate }],
              },
            ]}
          >
            <Svg width={size} height={size}>
              <Path
                d={sweepPath(cx, cy, radius, SWEEP_DEG)}
                fill={colors.primaryLight}
                opacity={0.22}
              />
            </Svg>
          </Animated.View>
        ) : null}

        {active
          ? gridRadii.map((r, index) => (
              <Animated.View
                key={`pulse-${index}`}
                pointerEvents="none"
                style={[
                  styles.pulseRing,
                  {
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                    left: cx - r,
                    top: cy - r,
                    opacity: ringOpacity,
                  },
                ]}
              />
            ))
          : null}
      </View>

      <View pointerEvents="none" style={styles.core}>
        <Ionicons name="wifi" size={24} color={colors.primaryLight} />
      </View>

      {devices.map((device, index) => {
        const { x, y } = radarBlipPosition(device.url, size, index);
        const blipColor = radarBlipColor(device.url);
        const label = device.displayName.length > 14
          ? `${device.displayName.slice(0, 13)}…`
          : device.displayName;

        return (
          <Pressable
            key={device.url}
            style={({ pressed }) => [
              styles.blip,
              {
                left: x - BLIP_SIZE / 2,
                top: y - BLIP_SIZE / 2,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
            onPress={() => onSelectDevice?.(device.url, device.displayName)}
            accessibilityRole="button"
            accessibilityLabel={`Connect to ${device.displayName}`}
          >
            <View style={[styles.blipAvatar, { backgroundColor: blipColor }]}>
              <Ionicons name="desktop-outline" size={20} color="#fff" />
            </View>
            <Text style={styles.blipLabel} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(size: number, colors: ThemeColors) {
  const coreSize = size * 0.2;
  return StyleSheet.create({
    wrap: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
    },
    fieldClip: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: size / 2,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primaryBorder,
    },
    sweepLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    pulseRing: {
      position: "absolute",
      borderWidth: 1,
      borderColor: colors.primaryLight,
    },
    core: {
      width: coreSize,
      height: coreSize,
      borderRadius: coreSize / 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    blip: {
      position: "absolute",
      width: BLIP_SIZE,
      alignItems: "center",
      zIndex: 3,
    },
    blipAvatar: {
      width: BLIP_SIZE,
      height: BLIP_SIZE,
      borderRadius: BLIP_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 4,
    },
    blipLabel: {
      marginTop: 4,
      color: colors.text,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "center",
      maxWidth: BLIP_SIZE + 36,
    },
  });
}
