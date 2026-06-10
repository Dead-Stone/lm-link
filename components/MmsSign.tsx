import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { AppFonts } from "../lib/typography";
import { ThemeColors } from "../lib/theme";

const FACE_WIDTH = 200;
const FACE_HEIGHT = 34;
/** Smile arc — same curve as signedbymms.vercel.app/art footer. */
const SMILE_PATH = "M12 12 C 60 3, 140 3, 188 12";
const LEFT_EYE = { cx: 78, cy: 24, r: 2.4 };
const RIGHT_EYE = { cx: 122, cy: 24, r: 2.4 };

type MmsSignProps = {
  colors: ThemeColors;
  fontSize?: number;
  smileWidth?: number;
  compact?: boolean;
};

/** Rotated MMS script + smile mark from signedbymms.vercel.app/art footer. */
export default function MmsSign({
  colors,
  fontSize = 32,
  smileWidth = 88,
  compact = false,
}: MmsSignProps) {
  const styles = useMemo(() => createStyles(colors, fontSize, compact), [colors, fontSize, compact]);
  const ink = colors.text;
  const smileHeight = (smileWidth * FACE_HEIGHT) / FACE_WIDTH;
  const strokeWidth = compact ? 2.8 : 2.6;

  return (
    <View style={styles.hitbox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.rotateWrap}>
        <View style={styles.sign}>
          <Text style={styles.label}>MMS</Text>
          <Svg
            width={smileWidth}
            height={smileHeight}
            viewBox={`0 0 ${FACE_WIDTH} ${FACE_HEIGHT}`}
            style={styles.face}
          >
            <Path
              d={SMILE_PATH}
              stroke={ink}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={LEFT_EYE.r} fill={ink} />
            <Circle cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={RIGHT_EYE.r} fill={ink} />
          </Svg>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, fontSize: number, compact: boolean) {
  const pad = Math.ceil(fontSize * (compact ? 0.22 : 0.35));

  return StyleSheet.create({
    hitbox: {
      overflow: "visible",
      paddingTop: compact ? pad * 0.4 : pad,
      paddingRight: compact ? pad * 0.8 : pad * 1.4,
      paddingBottom: compact ? pad * 0.35 : pad * 0.6,
      paddingLeft: compact ? pad * 0.2 : pad * 0.4,
    },
    rotateWrap: {
      transform: [{ rotate: "-30deg" }],
      overflow: "visible",
    },
    sign: {
      alignItems: "center",
      opacity: 0.95,
      overflow: "visible",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        android: {
          elevation: 4,
        },
        default: {},
      }),
    },
    label: {
      fontFamily: AppFonts.script,
      fontSize,
      lineHeight: fontSize * 1.15,
      letterSpacing: fontSize * 0.02,
      color: colors.text,
      paddingHorizontal: 2,
      includeFontPadding: true,
    },
    face: {
      marginTop: compact ? -2 : -4,
    },
  });
}
