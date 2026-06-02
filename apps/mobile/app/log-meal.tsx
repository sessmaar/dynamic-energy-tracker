import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  type FoodCandidate, type FoodSummary, type MealType,
  computeMealItemNutrition, searchOpenFoodFacts,
} from "@dynamic-energy/data";
import { localDateInTimezone } from "@dynamic-energy/engine";
import {
  Button, Card, Screen, Text,
  colors, fonts, fontSize, gap, hairline, radius,
} from "@/design";
import { useDebounce } from "@/hooks/useDebounce";
import { haptic } from "@/lib/haptics";
import { repos } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { useEngine } from "@/store/engineStore";

type SelectedFood =
  | { kind: "local"; food: FoodSummary }
  | { kind: "remote"; candidate: FoodCandidate };

const toFood = (s: SelectedFood) =>
  s.kind === "local"
    ? s.food
    : {
        id: "",
        name: s.candidate.name,
        brand: s.candidate.brand,
        kcalPer100g: s.candidate.kcalPer100g,
        proteinPer100g: s.candidate.proteinPer100g,
        carbsPer100g: s.candidate.carbsPer100g,
        fatPer100g: s.candidate.fatPer100g,
        commonUnit: null,
        commonUnitGrams: null,
      };

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Morn" },
  { value: "lunch",     label: "Noon" },
  { value: "dinner",    label: "Eve"  },
  { value: "snack",     label: "Snack" },
];

// Local date in the user's profile timezone — defaults to UTC pre-hydration,
// updated to e.g. "America/Los_Angeles" after the store reads the profile.

export default function LogMeal() {
  const router = useRouter();
  const { userId } = useAuth();
  const hydrate = useEngine((s) => s.hydrate);
  const timezone = useEngine((s) => s.timezone);
  const recipes = useEngine((s) => s.recipes);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 350);

  const [localResults, setLocalResults] = useState<FoodSummary[]>([]);
  const [remoteResults, setRemoteResults] = useState<FoodCandidate[]>([]);
  const [favorites, setFavorites] = useState<FoodSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SelectedFood | null>(null);
  const [grams, setGrams] = useState("100");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [committing, setCommitting] = useState(false);
  const [creating, setCreating] = useState(false);

  // ---- custom food form state ------------------------------------------
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [creatingError, setCreatingError] = useState<string | null>(null);

  const onCreateCustom = async () => {
    if (!userId) return;
    setCreatingError(null);
    const kcal = Number(customKcal);
    if (!customName.trim()) { setCreatingError("Name required."); return; }
    if (!Number.isFinite(kcal) || kcal < 0) { setCreatingError("kcal/100g must be a number."); return; }
    try {
      const food = await repos.food.createCustom({
        userId,
        name: customName.trim(),
        brand: customBrand.trim() || undefined,
        kcalPer100g: kcal,
        proteinPer100g: customProtein ? Number(customProtein) : undefined,
        carbsPer100g: customCarbs ? Number(customCarbs) : undefined,
        fatPer100g: customFat ? Number(customFat) : undefined,
      });
      setCreating(false);
      setSelected({ kind: "local", food });
    } catch (e) {
      setCreatingError(e instanceof Error ? e.message : String(e));
    }
  };

  // ---- favorites (load once on mount) ---------------------------------
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const top = await repos.food.topUserFoods(userId, 8);
        setFavorites(top);
      } catch {
        // Favorites are a nice-to-have — silently skip on failure rather
        // than blocking the search UI.
      }
    })();
  }, [userId]);

  // ---- search effect ---------------------------------------------------
  useEffect(() => {
    if (!debouncedQuery) {
      setLocalResults([]);
      setRemoteResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    void (async () => {
      try {
        const local = await repos.food.searchLocal(debouncedQuery, 8);
        if (cancelled) return;
        setLocalResults(local);
        // Only hit Open Food Facts when local is thin — saves a round
        // trip on common terms the catalog already has.
        if (local.length < 5) {
          const remote = await searchOpenFoodFacts(debouncedQuery, 12);
          if (cancelled) return;
          // De-dup remote against local sourceRef (so already-cached OFF
          // entries don't appear twice in the list).
          setRemoteResults(remote);
        } else {
          setRemoteResults([]);
        }
      } catch (e) {
        if (!cancelled) setSearchError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ---- nutrition preview ------------------------------------------------
  const nutrition = useMemo(() => {
    if (!selected) return null;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    return computeMealItemNutrition(toFood(selected), g);
  }, [selected, grams]);

  // ---- commit -----------------------------------------------------------
  const onCommit = async () => {
    if (!userId || !selected || !nutrition) return;
    setCommitting(true);
    try {
      // For remote candidates, cache into local `foods` first so the
      // meal_item references a real id and the next search hits the
      // local index for free.
      let foodId: string | undefined;
      if (selected.kind === "local") {
        foodId = selected.food.id;
      } else {
        const cached = await repos.food.upsertCandidate(selected.candidate);
        foodId = cached.id;
      }
      const food = toFood(selected);
      await repos.meal.logMeal({
        userId,
        date: localDateInTimezone(timezone),
        mealType,
        items: [{
          foodId,
          name: food.name + (food.brand ? ` · ${food.brand}` : ""),
          grams: Number(grams),
          kcal: nutrition.kcal,
          proteinG: nutrition.proteinG ?? undefined,
          carbsG: nutrition.carbsG ?? undefined,
          fatG: nutrition.fatG ?? undefined,
        }],
      });
      await hydrate(userId);
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  };

  // Selected detail view replaces the result list once a food is picked.
  if (selected) {
    const food = toFood(selected);
    return (
      <Screen eyebrow="Logger · Portion" title="ENTER">
        <Card>
          <View style={{ gap: gap.xs }}>
            <Text variant="meta">{food.brand ?? selected.kind.toUpperCase()}</Text>
            <Text variant="h3" numberOfLines={2}>{food.name}</Text>
            <View style={{ flexDirection: "row", gap: gap.lg, marginTop: gap.sm }}>
              <Stat label="KCAL/100G" value={Math.round(food.kcalPer100g).toString()} />
              <Stat label="P" value={food.proteinPer100g != null ? food.proteinPer100g.toFixed(1) : "—"} />
              <Stat label="C" value={food.carbsPer100g != null ? food.carbsPer100g.toFixed(1) : "—"} />
              <Stat label="F" value={food.fatPer100g != null ? food.fatPer100g.toFixed(1) : "—"} />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Portion · Grams</Text>
            <TextInput
              value={grams}
              onChangeText={(s) => setGrams(s.replace(/[^\d.]/g, ""))}
              keyboardType="decimal-pad"
              style={{
                fontFamily: fonts.mono, fontSize: fontSize.bignum, fontWeight: "800",
                color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
              }}
            />
            {nutrition && (
              <View style={{ flexDirection: "row", gap: gap.lg, marginTop: gap.md }}>
                <Stat label="THIS PORTION" value={`${nutrition.kcal} KCAL`} accent />
                <Stat label="P" value={nutrition.proteinG?.toString() ?? "—"} />
                <Stat label="C" value={nutrition.carbsG?.toString() ?? "—"} />
                <Stat label="F" value={nutrition.fatG?.toString() ?? "—"} />
              </View>
            )}
          </View>
        </Card>

        <Card>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Meal Slot</Text>
            <View style={{ flexDirection: "row", borderWidth: hairline.width, borderColor: colors.border }}>
              {MEAL_TYPES.map((mt, i) => {
                const active = mealType === mt.value;
                return (
                  <Pressable
                    key={mt.value}
                    onPress={() => setMealType(mt.value)}
                    style={{
                      flex: 1, paddingVertical: gap.md, alignItems: "center",
                      borderLeftWidth: i === 0 ? 0 : hairline.width,
                      borderLeftColor: hairline.color,
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

        {searchError && <Text variant="meta" color={colors.accent}>{searchError}</Text>}

        <Button onPress={onCommit} disabled={committing || !nutrition}>
          {committing ? "Logging…" : "Commit Meal"}
        </Button>
        <Button onPress={() => setSelected(null)} variant="secondary">
          ← Different Food
        </Button>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Logger · Food" title="SEARCH">
      <Card>
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Query</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="oats, chicken, banana…"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              fontFamily: fonts.body, fontSize: 22, fontWeight: "700",
              color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
              paddingVertical: gap.xs,
            }}
          />
        </View>
      </Card>

      {searching && (
        <View style={{ alignItems: "center", padding: gap.md }}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="meta" style={{ marginTop: gap.sm }}>Searching catalog…</Text>
        </View>
      )}

      {searchError && <Text variant="meta" color={colors.accent}>{searchError}</Text>}

      {!debouncedQuery && recipes.length > 0 && (
        <Section label={`From Library · ${recipes.length} ${recipes.length === 1 ? "Recipe" : "Recipes"}`}>
          {recipes.slice(0, 6).map((r) => (
            <ResultRow
              key={r.id}
              title={r.name}
              subtitle={`${r.items.length} ITEMS`}
              kcal={`${r.totalKcal} kcal total`}
              onPress={() => router.push({ pathname: "/recipes/[id]", params: { id: r.id } })}
            />
          ))}
        </Section>
      )}

      {!debouncedQuery && favorites.length > 0 && (
        <Section label={`Your Usuals · Top ${favorites.length}`}>
          {favorites.map((f) => (
            <ResultRow
              key={f.id}
              title={f.name}
              subtitle={f.brand ?? "FAVORITE"}
              kcal={`${Math.round(f.kcalPer100g)} kcal/100g`}
              onPress={() => setSelected({ kind: "local", food: f })}
            />
          ))}
        </Section>
      )}

      {localResults.length > 0 && (
        <Section label="Cached Catalog">
          {localResults.map((f) => (
            <ResultRow
              key={f.id}
              title={f.name}
              subtitle={f.brand ?? "LOCAL"}
              kcal={`${Math.round(f.kcalPer100g)} kcal/100g`}
              onPress={() => setSelected({ kind: "local", food: f })}
            />
          ))}
        </Section>
      )}

      {remoteResults.length > 0 && (
        <Section label="Open Food Facts">
          {remoteResults.map((c) => (
            <ResultRow
              key={c.sourceRef}
              title={c.name}
              subtitle={c.brand ?? "OFF"}
              kcal={`${Math.round(c.kcalPer100g)} kcal/100g`}
              onPress={() => setSelected({ kind: "remote", candidate: c })}
            />
          ))}
        </Section>
      )}

      {!searching && debouncedQuery && localResults.length === 0 && remoteResults.length === 0 && (
        <Card>
          <Text variant="body" color={colors.muted}>No matches for &quot;{debouncedQuery}&quot;.</Text>
          <Button onPress={() => { setCustomName(debouncedQuery); setCreating(true); }} style={{ marginTop: gap.md }}>
            Define Custom Food
          </Button>
        </Card>
      )}

      <Button onPress={() => setCreating(true)} variant="secondary">
        + Define Custom Food
      </Button>
      <Button onPress={() => router.back()} variant="secondary">
        Cancel
      </Button>

      {creating && (
        <Card>
          <View style={{ gap: gap.md }}>
            <Text variant="meta">Custom Food · Definition</Text>
            <CustomField label="Name" value={customName} onChange={setCustomName} />
            <CustomField label="Brand (optional)" value={customBrand} onChange={setCustomBrand} />
            <View style={{ flexDirection: "row", gap: gap.md }}>
              <View style={{ flex: 1 }}>
                <CustomField label="kcal / 100g" value={customKcal} onChange={setCustomKcal} numeric />
              </View>
              <View style={{ flex: 1 }}>
                <CustomField label="Protein g" value={customProtein} onChange={setCustomProtein} numeric />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: gap.md }}>
              <View style={{ flex: 1 }}>
                <CustomField label="Carbs g" value={customCarbs} onChange={setCustomCarbs} numeric />
              </View>
              <View style={{ flex: 1 }}>
                <CustomField label="Fat g" value={customFat} onChange={setCustomFat} numeric />
              </View>
            </View>
            {creatingError && <Text variant="meta" color={colors.accent}>{creatingError}</Text>}
            <Button onPress={onCreateCustom}>Save & Pick Portion</Button>
            <Button onPress={() => setCreating(false)} variant="secondary">Cancel</Button>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const CustomField = ({
  label, value, onChange, numeric,
}: { label: string; value: string; onChange: (s: string) => void; numeric?: boolean }) => (
  <View style={{ gap: gap.xs }}>
    <Text variant="meta">{label}</Text>
    <TextInput
      value={value}
      onChangeText={(s) => onChange(numeric ? s.replace(/[^\d.]/g, "") : s)}
      keyboardType={numeric ? "decimal-pad" : "default"}
      autoCapitalize={numeric ? "none" : "sentences"}
      style={{
        fontFamily: numeric ? fonts.mono : fonts.body,
        fontSize: 18, fontWeight: "700",
        color: colors.fg,
        borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
        paddingVertical: gap.xs,
      }}
    />
  </View>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ gap: gap.sm }}>
    <Text variant="meta">{label}</Text>
    <View style={{ borderWidth: hairline.width, borderColor: colors.border, borderRadius: radius.sharp }}>
      {children}
    </View>
  </View>
);

const ResultRow = ({
  title, subtitle, kcal, onPress,
}: { title: string; subtitle: string; kcal: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      padding: gap.md,
      borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
      backgroundColor: pressed ? colors.accentSoft : "transparent",
    })}
  >
    <Text variant="body" numberOfLines={2}>{title}</Text>
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
      <Text variant="meta">{subtitle}</Text>
      <Text variant="meta" color={colors.accent}>{kcal}</Text>
    </View>
  </Pressable>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <View style={{ gap: 2 }}>
    <Text variant="meta">{label}</Text>
    <Text variant="num" color={accent ? colors.accent : colors.fg} style={{ fontSize: 16, fontWeight: "700" as const }}>
      {value}
    </Text>
  </View>
);
