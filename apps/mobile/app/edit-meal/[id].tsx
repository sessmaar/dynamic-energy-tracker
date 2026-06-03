import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type MealSummary } from "@dynamic-energy/data";
import {
  Button, Card, MacroBar, Screen, Text,
  colors, fonts, fontSize, gap, hairline, radius,
} from "@/design";
import { useAuth } from "@/context/auth";
import { haptic } from "@/lib/haptics";
import { repos } from "@/lib/supabase";
import { useEngine } from "@/store/engineStore";

/**
 * Per-item edit screen. Renders each meal_item with an editable grams
 * field; we proportionally rescale the row's kcal + macros from the
 * original ratio when grams change (no need to re-fetch the parent
 * food — the snapshot at log time is the authoritative reference).
 *
 * Save commits all edits in sequence then re-hydrates the store.
 * "Add another item" is a separate action that bounces to /log-meal —
 * meals can be re-opened from Command and edited again, so chaining
 * adds is fine.
 */
type DraftItem = {
  id: string;
  name: string;
  originalGrams: number | null;
  originalKcal: number;
  originalProteinG: number | null;
  originalCarbsG: number | null;
  originalFatG: number | null;
  grams: string;       // current input
  removed: boolean;
};

const rescale = (orig: number | null, factor: number): number | null =>
  orig == null ? null : Number((orig * factor).toFixed(1));

export default function EditMeal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const hydrate = useEngine((s) => s.hydrate);

  const [meal, setMeal] = useState<MealSummary | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const m = await repos.meal.getMeal(id);
        if (!m) { setError("Meal not found."); return; }
        setMeal(m);
        setDrafts(m.items.map((it) => ({
          id: it.id,
          name: it.name,
          originalGrams: it.grams,
          originalKcal: it.kcal,
          originalProteinG: it.proteinG,
          originalCarbsG: it.carbsG,
          originalFatG: it.fatG,
          grams: it.grams != null ? it.grams.toString() : "",
          removed: false,
        })));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const setGrams = (idx: number, value: string) => {
    setDrafts((d) => {
      const next = [...d];
      next[idx] = { ...next[idx]!, grams: value.replace(/[^\d.]/g, "") };
      return next;
    });
  };

  const toggleRemove = (idx: number) => {
    setDrafts((d) => {
      const next = [...d];
      next[idx] = { ...next[idx]!, removed: !next[idx]!.removed };
      return next;
    });
  };

  // Live recomputation for preview totals.
  const recomputed = drafts
    .filter((d) => !d.removed)
    .map((d) => {
      if (d.originalGrams == null || d.originalGrams === 0) {
        // No portion known on the original — can't proportionally scale.
        return { kcal: d.originalKcal, p: d.originalProteinG, c: d.originalCarbsG, f: d.originalFatG };
      }
      const newGrams = Number(d.grams);
      const factor = Number.isFinite(newGrams) && newGrams > 0 ? newGrams / d.originalGrams : 1;
      return {
        kcal: Math.round(d.originalKcal * factor),
        p: rescale(d.originalProteinG, factor),
        c: rescale(d.originalCarbsG, factor),
        f: rescale(d.originalFatG, factor),
      };
    });
  const totalKcal = recomputed.reduce((s, r) => s + r.kcal, 0);
  const totalP = recomputed.reduce((s, r) => s + (r.p ?? 0), 0) || null;
  const totalC = recomputed.reduce((s, r) => s + (r.c ?? 0), 0) || null;
  const totalF = recomputed.reduce((s, r) => s + (r.f ?? 0), 0) || null;

  const onSave = async () => {
    if (!userId || !meal) return;
    setSaving(true);
    setError(null);
    try {
      // If every item is removed, treat as delete-the-meal.
      const allRemoved = drafts.every((d) => d.removed);
      if (allRemoved) {
        await repos.meal.deleteMeal(meal.id);
      } else {
        for (let i = 0; i < drafts.length; i++) {
          const d = drafts[i]!;
          if (d.removed) {
            await repos.meal.deleteItem(d.id);
            continue;
          }
          const newGrams = Number(d.grams);
          if (d.originalGrams != null && d.originalGrams > 0 && Number.isFinite(newGrams) && newGrams > 0) {
            const factor = newGrams / d.originalGrams;
            await repos.meal.updateItem(d.id, {
              grams: newGrams,
              kcal: d.originalKcal * factor,
              proteinG: rescale(d.originalProteinG, factor),
              carbsG: rescale(d.originalCarbsG, factor),
              fatG: rescale(d.originalFatG, factor),
            });
          }
        }
      }
      await hydrate(userId);
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen eyebrow="Editor · Meal" title="EDIT">
        <View style={{ alignItems: "center", padding: gap.lg }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }
  if (!meal) {
    return (
      <Screen eyebrow="Editor · Fault" title="NOT FOUND">
        <Text variant="body" color={colors.muted}>This meal no longer exists.</Text>
        <Button onPress={() => router.back()} variant="secondary">← Return</Button>
      </Screen>
    );
  }

  return (
    <Screen eyebrow={`Editor · ${meal.mealType.toUpperCase()}`} title="EDIT MEAL">
      <Card>
        <View style={{ gap: gap.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="meta">Date</Text>
            <Text variant="num">{meal.date}</Text>
          </View>
          <View style={{ height: hairline.width, backgroundColor: colors.border, marginVertical: gap.xs }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View style={{ gap: 2 }}>
              <Text variant="meta">Recomputed Total</Text>
              <Text variant="num" style={{ fontSize: 28, fontWeight: "800" as const }}>
                {totalKcal} <Text variant="meta">KCAL</Text>
              </Text>
            </View>
            <View style={{ gap: 2, alignItems: "flex-end" }}>
              <Text variant="meta">Original</Text>
              <Text variant="num" color={colors.muted}>{meal.totalKcal} kcal</Text>
            </View>
          </View>
          <View style={{ marginTop: gap.sm }}>
            <MacroBar proteinG={totalP} carbsG={totalC} fatG={totalF} totalKcal={totalKcal} />
          </View>
        </View>
      </Card>

      {drafts.map((d, i) => {
        const live = recomputed[drafts.slice(0, i + 1).filter((x) => !x.removed).length - 1];
        return (
          <Card key={d.id}>
            <View style={{ gap: gap.sm, opacity: d.removed ? 0.4 : 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text variant="body" numberOfLines={2} style={{ flex: 1, marginRight: gap.md }}>
                  {d.name}
                </Text>
                <Pressable onPress={() => { haptic.light(); toggleRemove(i); }}>
                  <Text variant="meta" color={d.removed ? colors.muted : colors.accent}>
                    {d.removed ? "UNDO" : "REMOVE"}
                  </Text>
                </Pressable>
              </View>

              {!d.removed && d.originalGrams != null && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: gap.sm }}>
                    <Text variant="meta">PORTION</Text>
                    <TextInput
                      value={d.grams}
                      onChangeText={(s) => setGrams(i, s)}
                      keyboardType="decimal-pad"
                      style={{
                        fontFamily: fonts.mono, fontSize: 22, fontWeight: "700",
                        color: colors.fg, flex: 1,
                        borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
                        paddingVertical: gap.xs,
                      }}
                    />
                    <Text variant="meta">G</Text>
                  </View>
                  {live && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text variant="meta">Live</Text>
                      <Text variant="num" color={colors.accent} style={{ fontSize: 13 }}>
                        {live.kcal} kcal · P {live.p?.toFixed(1) ?? "—"} · C {live.c?.toFixed(1) ?? "—"} · F {live.f?.toFixed(1) ?? "—"}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {!d.removed && d.originalGrams == null && (
                <Text variant="meta" color={colors.muted}>
                  Quick-add entry · {d.originalKcal} kcal (portion unknown — can&apos;t rescale)
                </Text>
              )}
            </View>
          </Card>
        );
      })}

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
      <Button onPress={onSaveAsRecipe} disabled={saving} variant="secondary">
        Save as Recipe
      </Button>
      <Button onPress={() => router.back()} variant="secondary">Cancel</Button>

      <View style={{ marginTop: gap.md }}>
        <Text variant="body" color={colors.muted} style={{ fontSize: fontSize.small }}>
          Need to add another item? Cancel and use Fuel to log a fresh meal —
          it'll appear as a second {meal.mealType} entry today.
        </Text>
      </View>
    </Screen>
  );

  function onSaveAsRecipe() {
    if (!userId || !meal) return;
    const visibleDrafts = drafts.filter((d) => !d.removed);
    if (visibleDrafts.length === 0) {
      Alert.alert("Nothing to save", "All items have been removed.");
      return;
    }
    Alert.prompt(
      "Save as recipe",
      "Name this combination so you can log it again with one tap.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async (name?: string) => {
            const trimmed = (name ?? "").trim();
            if (!trimmed) return;
            setSaving(true);
            try {
              await repos.recipe.create({
                userId,
                name: trimmed,
                items: visibleDrafts.map((d, idx) => {
                  // Use the live recomputed values so a recipe saved
                  // after a portion change reflects what the user sees.
                  const live = recomputed[idx];
                  return {
                    name: d.name,
                    grams: Number(d.grams) || d.originalGrams || undefined,
                    kcal: live?.kcal ?? d.originalKcal,
                    proteinG: live?.p ?? d.originalProteinG ?? undefined,
                    carbsG: live?.c ?? d.originalCarbsG ?? undefined,
                    fatG: live?.f ?? d.originalFatG ?? undefined,
                  };
                }),
              });
              haptic.success();
              Alert.alert("Recipe saved", `"${trimmed}" is in your library.`);
            } catch (e) {
              haptic.error();
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
      "plain-text",
      `${meal.mealType[0]!.toUpperCase()}${meal.mealType.slice(1)} · ${meal.date}`,
    );
  }
}
