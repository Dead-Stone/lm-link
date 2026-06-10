import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { radii, ThemeColors } from "../lib/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onDownload: () => void;
  placeholder: string;
  hint: string;
  colors: ThemeColors;
  disabled?: boolean;
  downloading?: boolean;
};

export default function ModelDownloadStringField({
  value,
  onChangeText,
  onDownload,
  placeholder,
  hint,
  colors,
  disabled = false,
  downloading = false,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canDownload = value.trim().length > 0 && !disabled && !downloading;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Download from link</Text>
      <SectionHint text={hint} colors={colors} />
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          editable={!downloading && !disabled}
          returnKeyType="go"
          onSubmitEditing={() => canDownload && onDownload()}
        />
        <Pressable
          onPress={onDownload}
          disabled={!canDownload}
          style={({ pressed }) => [
            styles.btn,
            !canDownload && styles.btnDisabled,
            pressed && canDownload && styles.btnPressed,
          ]}
          accessibilityLabel="Download model"
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.primaryLight} />
          ) : (
            <Ionicons name="cloud-download-outline" size={20} color={colors.primaryLight} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SectionHint({ text, colors }: { text: string; colors: ThemeColors }) {
  return <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 17 }}>{text}</Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      gap: 6,
      marginBottom: 14,
    },
    title: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    input: {
      flex: 1,
      minWidth: 0,
      color: colors.inputText,
      fontSize: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.pill,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      flexShrink: 0,
    },
    btnDisabled: { opacity: 0.45 },
    btnPressed: { opacity: 0.82 },
  });
}
