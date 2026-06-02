import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type MealType, type RecipeSummary } from "@dynamic-energy/data";
import {
  Button, Card, MacroBar, Screen, Text,
  colors, gap, hairline,
} from "@/design";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useAuth } from "@/context/auth";
import { haptic } from "@/lib/haptics";
import { repos } from "@/lib/supabase";
import { useEngine } from "@/store/engineStore";

/**
 * Recipe detail. Shows the items + totals, and exposes "Log this now" —
 * which inserts a fresh meal with the recipe's items copied in. Items
 * keep their food_id reference so the per-meal entries still link back
 * to the catalog row they came from.
 */
const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Morn"  },
  { value: "lunch",     label: "Noon"  },
  { value: "dinner",    label: "Eve"   },
  { value: "snack",     label: "Snack" },
];

export default function RecipeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const hydrate = useEngine((s) => s.hydrate);
  const timezone = useEngine((s) => s.timezone);

  const [recipe, setRecipe] = useState<RecipeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>("snack");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const r = await repos.recipe.get(id);
        setRecipe(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onLog = async () => {
    if (!userId || !recipe) return;
    setBusy(true);
    setError(null);
    try {
      await repos.meal.logMeal({
        userId,
        date: localDateInTimezone(timezone),
        mealType,
        items: recipe.items.map((it) => ({
          foodId: it.foodId ?? undefined,
          name: it.name,
          grams: it.grams ?? undefined,
          kcal: it.kcal,
          proteinG: it.proteinG ?? undefined,
          carbsG: it.carbsG ?? undefined,
          fatG: it.fatG ?? undefined,
        })),
      });
      await hydrate(userId);
      haptic.success();
      router.push("/command");
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen eyebrow="Library · Recipe" title="LOAD">
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (!recipe) {
    return (
      <Screen eyebrow="Library · Fault" title="NOT FOUND">
        <Text variant="body" color={colors.muted}>This recipe no longer exists.</Text>
        <Button onPress={() => router.back()} variant="secondary">← Return</Button>
      </Screen>
    );
  }

  const protein = recipe.items.reduce((s, it) => s + (it.proteinG ?? 0), 0) || null;
  const carbs   = recipe.items.reduce((s, it) => s + (it.carbsG ?? 0), 0) || null;
  const fat     = recipe.items.reduce((s, it) => s + (it.fatG ?? 0), 0) || null;

  return (
    <Screen eyebrow="Library · Recipe" title={recipe.name.toUpperCase()}>
      <Card>
        <View style={{ gap: gap.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ gap: 2 }}>
              <Text variant="meta">Total</Text>
              <Text variant="bignum">{recipe.totalKcal}</Text>
            </View>
            <View style={{ gap: 2, alignItems: "flex-end" }}>
              <Text variant="meta">{recipe.items.length} items</Text>
            </View>
          </View>
          <View style={{ marginTop: gap.sm }}>
            <MacroBar proteinG={protein} carbsG={carbs} fatG={fat} totalKcal={recipe.totalKcal} />
          </View>
        </View>
      </Card>

      <View style={{ borderWidth: hairline.width, borderColor: colors.border }}>
        {recipe.items.map((it, i) => (
          <View
            key={it.id}
            style={{
              padding: gap.md,
              borderTopWidth: i === 0 ? 0 : hairline.width,
              borderTopColor: hairline.color,
              flexDirection: "row", justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, marginRight: gap.md }}>
              <Text variant="body" numberOfLines={2}>{it.name}</Text>
              {it.grams != null && <Text variant="meta">{it.grams.toFixed(0)} g</Text>}
            </View>
            <Text variant="num" style={{ fontSize: 16, fontWeight: "700" as const }}>
              {it.kcal}
            </Text>
          </View>
        ))}
      </View>

      <Card>
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Log Into Slot</Text>
          <View style={{ flexDirection: "row", borderWidth: hairline.width, borderColor: colors.border }}>
            {MEAL_TYPES.map((mt, i) => {
              const active = mealType === mt.value;
              return (
                <Pressable
                  key={mt.value}
                  onPress={() => { haptic.light(); setMealType(mt.value); }}
                  style={{
                    flex: 1, paddingVertical: gap.md, alignItems: "center",
                    borderLeftWidth: i === 0 ? 0 : hairline.width, borderLeftColor: hairline.color,
                    backgroundColor: active ? colors.accentSoft : "transparent",
                  }}
                >
                  <Text variant="meta" color={active ? colors.accent : colors.muted}>{mt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onLog} disabled={busy}>
        {busy ? "Logging…" : "Log This Now"}
      </Button>
      <Button onPress={() => router.back()} variant="secondary">← Return</Button>
    </Screen>
  );
}
