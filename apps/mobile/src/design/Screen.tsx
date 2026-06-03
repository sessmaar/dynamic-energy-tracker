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
  footer?: ReactNode;
  /**
   * If provided, the screen renders a pull-to-refresh control.
   * The promise's lifecycle drives the spinner state.
   */
  onRefresh?: () => Promise<unknown> | unknown;
}

/** Navigator Light screen shell: light bg, header, scrollable body, optional fixed footer. */
export const Screen = ({ eyebrow, title, children, scroll = true, footer, onRefresh }: ScreenProps) => {
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: gap.md, gap: gap.lg, paddingBottom: footer ? 100 : 32 }}
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
          <View style={{ gap: 2 }}>
            {eyebrow && <Text variant="eyebrow">{eyebrow}</Text>}
            {title && <Text variant="h2">{title}</Text>}
          </View>
        )}
        {children}
      </Body>
      {footer}
    </SafeAreaView>
  );
};
