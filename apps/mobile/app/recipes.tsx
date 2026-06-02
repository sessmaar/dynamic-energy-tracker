import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Button, Card, MacroBar, Screen, Text, colors, gap, hairline, radius } from "@/design";
import { useAuth } from "@/context/auth";
import { haptic } from "@/lib/haptics";
import { repos } from "@/lib/supabase";
import { useEngine } from "@/store/engineStore";

/**
 * Recipe inventory. List view of every recipe the user has saved, with
 * macro bar per row. Tap-to-detail (`/recipes/[id]`); long-press to
 * delete. The list also serves as the entry point from log-meal — when
 * empty, we explain the two ways to seed one.
 */
export default function RecipesIndex() {
  const router = useRouter();
  const { userId } = useAuth();
  const recipes = useEngine((s) => s.recipes);
  const hydrate = useEngine((s) => s.hydrate);
  const [busy, setBusy] = useState(false);

  // Refresh on focus so a fresh save (from edit-meal) shows up on return.
  useFocusEffect(
    useCallback(() => {
      if (userId) void hydrate(userId);
    }, [userId, hydrate]),
  );

  const onDelete = (id: string, name: string) => {
    Alert.alert(
      "Delete recipe",
      `Permanently remove "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await repos.recipe.delete(id);
              if (userId) await hydrate(userId);
              haptic.success();
            } catch (e) {
              haptic.error();
              Alert.alert("Error", e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      eyebrow="Library · Saved Combinations"
      title="RECIPES"
      onRefresh={userId ? () => hydrate(userId) : undefined}
    >
      <Text variant="body" color={colors.muted}>
        A recipe is a saved combination of foods you log together. Add
        one in two ways: edit a meal and tap &quot;Save as Recipe&quot;,
        or compose freshly from the search flow (TBD).
      </Text>

      {recipes.length === 0 ? (
        <Card>
          <Text variant="body" color={colors.muted}>
            No recipes yet. Log a meal first — then open it from Command
            and tap &quot;Save as Recipe&quot; in the editor.
          </Text>
        </Card>
      ) : (
        recipes.map((r) => {
          const protein = r.items.reduce((s, it) => s + (it.proteinG ?? 0), 0) || null;
          const carbs   = r.items.reduce((s, it) => s + (it.carbsG ?? 0), 0) || null;
          const fat     = r.items.reduce((s, it) => s + (it.fatG ?? 0), 0) || null;
          return (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: "/recipes/[id]", params: { id: r.id } })}
              onLongPress={() => onDelete(r.id, r.name)}
              disabled={busy}
              style={({ pressed }) => ({
                padding: gap.lg,
                borderWidth: hairline.width, borderColor: colors.border,
                borderRadius: radius.sharp,
                backgroundColor: pressed ? colors.accentSoft : colors.surface,
                gap: gap.sm,
              })}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text variant="h3" numberOfLines={1} style={{ flex: 1, marginRight: gap.md }}>
                  {r.name}
                </Text>
                <Text variant="num" color={colors.accent} style={{ fontSize: 18, fontWeight: "700" as const }}>
                  {r.totalKcal} <Text variant="meta">KCAL</Text>
                </Text>
              </View>
              <Text variant="meta">
                {r.items.length} {r.items.length === 1 ? "ITEM" : "ITEMS"} ·
                {" "}{r.items.slice(0, 3).map((it) => it.name).join(" · ")}
                {r.items.length > 3 ? ` · +${r.items.length - 3}` : ""}
              </Text>
              <MacroBar
                proteinG={protein} carbsG={carbs} fatG={fat}
                totalKcal={r.totalKcal} height={4} hideLabels
              />
            </Pressable>
          );
        })
      )}

      {recipes.length > 0 && (
        <Text variant="meta" color={colors.muted} style={{ fontSize: 10 }}>
          Tap to view · long-press to delete.
        </Text>
      )}

      <Button onPress={() => router.back()} variant="secondary">← Return</Button>
    </Screen>
  );
}
