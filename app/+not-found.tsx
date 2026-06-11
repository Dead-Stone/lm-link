import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalPageTopPadding } from "../lib/safe-area-layout";
import { useTheme } from "../lib/theme";

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgElevated,
          paddingTop: modalPageTopPadding(insets.top),
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "600", marginBottom: 12 }}>
            Page not found
          </Text>
          <Link href="/" style={{ color: colors.primaryLight, fontSize: 16 }}>
            Go home
          </Link>
        </View>
      </View>
    </>
  );
}
