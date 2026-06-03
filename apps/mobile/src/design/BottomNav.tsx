import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { colors, gap, hairline } from "./tokens";
import { Text } from "./Text";

export type TabKey = "command" | "trends" | "convergence" | "settings";

export interface BottomNavProps {
  activeTab: TabKey;
}

export const BottomNav = ({ activeTab }: BottomNavProps) => {
  const router = useRouter();

  const handlePress = (tab: TabKey, route: Href) => {
    if (activeTab === tab) return;
    router.replace(route);
  };

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderTopWidth: hairline.width,
      borderTopColor: colors.border,
      paddingVertical: gap.sm,
      paddingHorizontal: gap.sm,
    }}>
      <NavTabItem
        label="Dashboard"
        active={activeTab === "command"}
        onPress={() => handlePress("command", "/command")}
      />
      <NavTabItem
        label="Trends"
        active={activeTab === "trends"}
        onPress={() => handlePress("trends", "/trends")}
      />

      {/* FAB */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Pressable
          onPress={() => router.push("/log-meal")}
          style={({ pressed }) => ({
            width: 52, height: 52,
            borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center",
            shadowColor: colors.accent,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            marginTop: -12,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 24, lineHeight: 28, fontWeight: "300" }}>+</Text>
        </Pressable>
      </View>

      <NavTabItem
        label="Calibrate"
        active={activeTab === "convergence"}
        onPress={() => handlePress("convergence", "/convergence")}
      />
      <NavTabItem
        label="Settings"
        active={activeTab === "settings"}
        onPress={() => handlePress("settings", "/settings")}
      />
    </View>
  );
};

const NavTabItem = ({
  label, active, onPress,
}: { label: string; active?: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
    <View style={{
      width: active ? 24 : 20,
      height: 3,
      borderRadius: 2,
      backgroundColor: active ? colors.accent : "transparent",
      marginBottom: 4,
    }} />
    <Text
      variant="meta"
      color={active ? colors.accent : colors.muted}
      style={{ fontSize: 9, letterSpacing: 0.4 }}
    >
      {label.toUpperCase()}
    </Text>
  </Pressable>
);
