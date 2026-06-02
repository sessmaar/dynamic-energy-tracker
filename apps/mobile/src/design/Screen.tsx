import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, gap } from "./tokens";
import { Text } from "./Text";

export interface ScreenProps {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  /**
   * If provided, the screen renders a pull-to-refresh control whose
   * tint is the Dense Matrix accent. The promise's lifecycle drives
   * the spinner state; consumers don't manage their own `refreshing`
   * flag.
   */
  onRefresh?: () => Promise<unknown> | unknown;
}

/** Standard Dense Matrix screen shell: dark bg, eyebrow/title header, scroll body. */
export const Screen = ({ eyebrow, title, children, scroll = true, onRefresh }: ScreenProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try { await onRefresh(); } finally { setRefreshing(false); }
      }
    : undefined;

  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: gap.md, gap: gap.xl, paddingBottom: 120 }}
        {...(scroll && handleRefresh
          ? {
              refreshControl: (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              ),
            }
          : {})}
      >
        {(eyebrow || title) && (
          <View style={{ gap: gap.sm }}>
            {eyebrow && <Text variant="eyebrow">{eyebrow}</Text>}
            {title && <Text variant="h2">{title}</Text>}
          </View>
        )}
        {children}
      </Body>
    </SafeAreaView>
  );
};
