import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createModalTheme } from "../lib/modal-theme";
import { modalPageTopPadding } from "../lib/safe-area-layout";
import { ThemeColors, useTheme } from "../lib/theme";
import { AppFonts } from "../lib/typography";
import SetupGuideBody from "./SetupGuideBody";
import SwipeDismissSheet from "./SwipeDismissSheet";

const SUBTEXT = { fontSize: 12, lineHeight: 17 } as const;

export default function SetupGuideModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedStepKey, setExpandedStepKey] = useState<string | null>(null);

  const startTutorial = () => {
    onClose();
    router.push("/tutorial");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={[modalStyles.pageContainer, { flex: 1 }]}>
        <SwipeDismissSheet direction="down" onDismiss={onClose} style={modalStyles.pageContainer}>
          <View style={[modalStyles.pageContainer, { paddingTop: modalPageTopPadding(insets.top) }]}>
            <View style={modalStyles.pageHandleWrap}>
              <View style={modalStyles.pageHandle} />
            </View>

            <View style={styles.header}>
              <Pressable onPress={onClose} hitSlop={8} style={styles.headerSide}>
                <View style={modalStyles.closeCircle}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </View>
              </Pressable>

              <View style={styles.headerCenter}>
                <Text style={styles.title}>Setup Guide</Text>
                <Text style={styles.subtitle}>Connect LM Studio on your Mac over Wi‑Fi</Text>
              </View>

              <View style={styles.headerSide} />
            </View>

            <ScrollView
              contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={() => setExpandedStepKey(null)}
            >
              <SetupGuideBody
                showDoneButton
                onDone={onClose}
                onStartTutorial={startTutorial}
                expandedStepKey={expandedStepKey}
                onExpandedStepKeyChange={setExpandedStepKey}
              />
            </ScrollView>
          </View>
        </SwipeDismissSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 8,
    },
    headerSide: {
      width: 40,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 0,
    },
    title: {
      color: colors.text,
      fontFamily: AppFonts.displayBold,
      fontSize: 18,
      letterSpacing: -0.35,
      lineHeight: 24,
      textAlign: "center",
      alignSelf: "stretch",
      includeFontPadding: false,
    },
    subtitle: {
      color: colors.textMuted,
      ...SUBTEXT,
      marginTop: 2,
      textAlign: "center",
      alignSelf: "stretch",
      includeFontPadding: false,
    },
    body: { paddingHorizontal: 20, paddingTop: 4 },
  });
}
