import { useMemo } from "react";
import { ThemeColors, useTheme } from "./theme";

export function useThemedStyles<T>(create: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => create(colors), [colors, create]);
}
