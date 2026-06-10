import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createModalTheme } from "../lib/modal-theme";
import { useTheme } from "../lib/theme";
import { LocalModelsManager } from "./LocalModelsSection";

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  title?: string;
};

export default function LocalModelsModal({
  visible,
  onClose,
  selectedKey,
  onSelect,
  title = "Browse On-Device Models",
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createModalTheme(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.pageContainer}>
        <View style={styles.pageHandleWrap}>
          <View style={styles.pageHandle} />
        </View>
        <View style={[styles.pageHeader, { paddingTop: 8 }]}>
          <Pressable onPress={onClose} style={styles.pageHeaderBtn} hitSlop={8}>
            <View style={styles.closeCircle}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </View>
          </Pressable>
          <Text style={styles.pageTitle}>{title}</Text>
          <View style={styles.pageHeaderBtn} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <LocalModelsManager
            selectedKey={selectedKey}
            onSelect={(key) => {
              if (!key) return;
              onSelect(key);
              onClose();
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
