import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  SETUP_GUIDE_SECTIONS,
  SETUP_TROUBLESHOOTING,
  type SetupGuideStep,
} from "../lib/setup-guide";
import { getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";
import SetupGuideIllustration from "./SetupGuideIllustrations";

const SUBTEXT = { fontSize: 12, lineHeight: 17 } as const;

function CollapsibleSetupStep({
  item,
  stepKey,
  colors,
  styles,
  expanded,
  onToggle,
  isLast,
}: {
  item: SetupGuideStep;
  stepKey: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  expanded: boolean;
  onToggle: (key: string) => void;
  isLast: boolean;
}) {
  const canExpand = !!item.illustration;

  return (
    <View style={[styles.stepBlock, !isLast && !expanded && styles.stepBlockDivider]}>
      <Pressable
        onPress={() => canExpand && onToggle(stepKey)}
        disabled={!canExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={item.step}
        style={({ pressed }) => [
          styles.stepRow,
          pressed && canExpand && styles.stepRowPressed,
        ]}
      >
        <Ionicons name={item.icon} size={18} color={colors.primaryLight} style={styles.stepIcon} />
        <View style={styles.stepCopy}>
          <Text style={styles.rowStep}>{item.step}</Text>
          <Text style={styles.rowDetail}>{item.detail}</Text>
        </View>
        {canExpand ? (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textDim}
            style={styles.expandChevron}
          />
        ) : null}
      </Pressable>

      {expanded && item.bullets?.map((bullet) => (
        <Text key={bullet} style={styles.bulletText}>
          · {bullet}
        </Text>
      ))}

      {expanded && item.illustration ? (
        <View style={styles.illustrationWrap}>
          <SetupGuideIllustration id={item.illustration} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  showDoneButton?: boolean;
  onDone?: () => void;
  onStartTutorial?: () => void;
  expandedStepKey?: string | null;
  onExpandedStepKeyChange?: (key: string | null) => void;
};

export default function SetupGuideBody({
  showDoneButton = false,
  onDone,
  onStartTutorial,
  expandedStepKey: expandedStepKeyProp,
  onExpandedStepKeyChange,
}: Props) {
  const { colors: themeColors, isDark } = useTheme();
  const colors = useMemo(
    () => getSettingsPalette(themeColors, isDark),
    [themeColors, isDark]
  );
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedStepKeyLocal, setExpandedStepKeyLocal] = useState<string | null>(null);
  const expandedStepKey = expandedStepKeyProp ?? expandedStepKeyLocal;
  const setExpandedStepKey = onExpandedStepKeyChange ?? setExpandedStepKeyLocal;

  const toggleStep = (key: string) => {
    setExpandedStepKey(expandedStepKey === key ? null : key);
  };

  return (
    <View>
      {SETUP_GUIDE_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.steps.map((item, index) => {
            const stepKey = `${section.title}-${item.step}`;
            return (
              <CollapsibleSetupStep
                key={stepKey}
                stepKey={stepKey}
                item={item}
                colors={colors}
                styles={styles}
                expanded={expandedStepKey === stepKey}
                onToggle={toggleStep}
                isLast={index === section.steps.length - 1}
              />
            );
          })}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Troubleshooting</Text>
      <View style={styles.troubleList}>
        {SETUP_TROUBLESHOOTING.map((item) => (
          <View key={item.title} style={styles.troublePoint}>
            <Text style={styles.troubleBullet}>·</Text>
            <Text style={styles.troubleLine}>
              <Text style={styles.troubleLabel}>{item.title}</Text>
              <Text style={styles.troubleDetail}> — {item.detail}</Text>
            </Text>
          </View>
        ))}
      </View>

      {onStartTutorial ? (
        <Pressable
          onPress={onStartTutorial}
          accessibilityRole="button"
          accessibilityLabel="Start interactive tutorial"
          style={({ pressed }) => [styles.tutorialBtn, pressed && styles.tutorialBtnPressed]}
        >
          <Ionicons name="play-outline" size={16} color={colors.primaryLight} />
          <Text style={styles.tutorialBtnText}>Start tutorial</Text>
        </Pressable>
      ) : null}

      {showDoneButton && onDone ? (
        <Pressable style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneBtnText}>Got it</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 4 },
    sectionTitle: {
      color: colors.textDim,
      ...SUBTEXT,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 6,
      marginTop: 12,
    },
    stepBlock: {
      paddingVertical: 10,
    },
    stepBlockDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    stepRowPressed: {
      opacity: 0.82,
    },
    stepIcon: {
      marginTop: 1,
      flexShrink: 0,
    },
    stepCopy: {
      flex: 1,
      minWidth: 0,
    },
    expandChevron: {
      marginTop: 2,
      flexShrink: 0,
    },
    rowStep: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    rowDetail: {
      color: colors.textMuted,
      ...SUBTEXT,
      marginTop: 3,
    },
    bulletText: {
      color: colors.textDim,
      ...SUBTEXT,
      marginTop: 6,
      marginLeft: 28,
    },
    illustrationWrap: { marginTop: 10, marginLeft: 28 },
    troubleList: {
      gap: 6,
      marginBottom: 4,
    },
    troublePoint: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    troubleBullet: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
      width: 10,
      textAlign: "center",
      flexShrink: 0,
    },
    troubleLine: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      lineHeight: 17,
    },
    troubleLabel: {
      color: colors.text,
      fontWeight: "600",
    },
    troubleDetail: {
      color: colors.textMuted,
      fontWeight: "400",
    },
    tutorialBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 20,
      paddingVertical: 12,
    },
    tutorialBtnPressed: { opacity: 0.72 },
    tutorialBtnText: { color: colors.primaryLight, fontSize: 15, fontWeight: "600" },
    doneBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
