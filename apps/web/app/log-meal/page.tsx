"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type FoodCandidate, computeMealItemNutrition, searchOpenFoodFacts,
} from "@dynamic-energy/data";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useLocalStore, type MealType } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

const useDebounced = <T,>(value: T, ms = 350): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch" },
  { value: "dinner",    label: "Dinner" },
  { value: "snack",     label: "Snack" },
];

export default function LogMealPage() {
  const router = useRouter();
  const tz = useLocalStore((s) => s.profile?.timezone ?? "UTC");
  const cacheFood = useLocalStore((s) => s.cacheFood);
  const cachedFoods = useLocalStore((s) => s.foodsCache);

  const [mode, setMode] = useState<"quick" | "search">("quick");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const [remote, setRemote] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [grams, setGrams] = useState("100");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [committing, setCommitting] = useState(false);

  // Quick entry state
  const [quick, setQuick] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });

  // Custom-food state
  const [creating, setCreating] = useState(false);
  const [c, setC] = useState({ name: "", brand: "", kcal: "", protein: "", carbs: "", fat: "" });

  const localMatches = useMemo(() => {
    if (!debounced) return [];
    const q = debounced.toLowerCase();
    return cachedFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [debounced, cachedFoods]);

  useEffect(() => {
    if (mode !== "search" || !debounced || localMatches.length >= 5) { setRemote([]); return; }
    let cancelled = false;
    setSearching(true); setError(null);
    void (async () => {
      try {
        const r = await searchOpenFoodFacts(debounced, 12);
        if (!cancelled) setRemote(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced, localMatches.length, mode]);

  const nutrition = useMemo(() => {
    if (!selected) return null;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    return computeMealItemNutrition({
      kcalPer100g: selected.kcalPer100g,
      proteinPer100g: selected.proteinPer100g,
      carbsPer100g: selected.carbsPer100g,
      fatPer100g: selected.fatPer100g,
    }, g);
  }, [selected, grams]);

  const onCommit = () => {
    if (!selected || !nutrition) return;
    setCommitting(true); setError(null);
    try {
      cacheFood(selected);
      const today = localDateInTimezone(tz);
      localRepos.meal.add({
        date: today,
        mealType,
        items: [{
          foodId: selected.sourceRef,
          name: selected.name + (selected.brand ? ` · ${selected.brand}` : ""),
          grams: Number(grams),
          kcal: nutrition.kcal,
          proteinG: nutrition.proteinG,
          carbsG: nutrition.carbsG,
          fatG: nutrition.fatG,
        }],
      });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  const onQuickLog = () => {
    const kcal = Number(quick.kcal);
    if (!quick.kcal || isNaN(kcal) || kcal < 0) { setError("Calories required."); return; }
    setCommitting(true);
    try {
      const today = localDateInTimezone(tz);
      localRepos.meal.add({
        date: today,
        mealType,
        items: [{
          name: quick.name.trim() || "Quick add",
          grams: null,
          kcal: kcal,
          proteinG: quick.protein ? Number(quick.protein) : null,
          carbsG: quick.carbs ? Number(quick.carbs) : null,
          fatG: quick.fat ? Number(quick.fat) : null,
        }],
      });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  const onCreate = () => {
    if (!c.name.trim() || !Number.isFinite(Number(c.kcal)) || Number(c.kcal) < 0) {
      setError("Name and kcal/100g required."); return;
    }
    const custom: FoodCandidate = {
      sourceRef: `custom-${Date.now()}`,
      source: "off",
      name: c.name.trim(),
      brand: c.brand.trim() || null,
      servingSizeG: null,
      kcalPer100g: Number(c.kcal),
      proteinPer100g: c.protein ? Number(c.protein) : null,
      carbsPer100g: c.carbs ? Number(c.carbs) : null,
      fatPer100g: c.fat ? Number(c.fat) : null,
    };
    cacheFood(custom);
    setSelected(custom);
    setCreating(false);
  };

  if (selected) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <header>
            <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Portion</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{selected.name}</h1>
            {selected.brand && <div style={{ color: "var(--muted)", fontSize: 13 }}>{selected.brand}</div>}
          </header>

          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
            <label style={{ display: "block", color: "var(--muted)", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Grams</label>
            <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 40, fontWeight: 800, padding: "4px 0", outline: 0 }} />
            {nutrition && (
              <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                <Metric label="Kcal" value={`${nutrition.kcal}`} color="var(--accent)" />
                <Metric label="P" value={`${nutrition.proteinG ?? "—"}g`} color="var(--viz-protein)" />
                <Metric label="C" value={`${nutrition.carbsG ?? "—"}g`} color="var(--viz-carbs)" />
                <Metric label="F" value={`${nutrition.fatG ?? "—"}g`} color="var(--viz-fat)" />
              </div>
            )}
          </section>

          <MealTypeSelector value={mealType} onChange={setMealType} />

          {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSelected(null)} style={btnGhost}>Back</button>
            <button onClick={onCommit} disabled={committing || !nutrition} style={{ ...btnPrimary, opacity: committing || !nutrition ? 0.5 : 1 }}>
              {committing ? "Logging…" : "Log meal"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Log food</div>
          <div style={{ display: "flex", background: "var(--surface-container)", borderRadius: 14, padding: 4, marginTop: 8 }}>
            <button onClick={() => setMode("quick")} style={tabBtn(mode === "quick")}>Quick log</button>
            <button onClick={() => setMode("search")} style={tabBtn(mode === "search")}>Search</button>
          </div>
        </header>

        {mode === "quick" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
             <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
               <label style={{ display: "block", color: "var(--muted)", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Calories</label>
               <input type="number" placeholder="0" value={quick.kcal} onChange={(e) => setQuick({ ...quick, kcal: e.target.value })} style={{ width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 40, fontWeight: 800, padding: "4px 0", outline: 0 }} />
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
                 <CField label="Protein g" value={quick.protein} onChange={(v) => setQuick({ ...quick, protein: v })} numeric />
                 <CField label="Carbs g" value={quick.carbs} onChange={(v) => setQuick({ ...quick, carbs: v })} numeric />
                 <CField label="Fat g" value={quick.fat} onChange={(v) => setQuick({ ...quick, fat: v })} numeric />
               </div>
               <div style={{ marginTop: 16 }}>
                 <CField label="Name (optional)" value={quick.name} onChange={(v) => setQuick({ ...quick, name: v })} />
               </div>
             </section>

             <MealTypeSelector value={mealType} onChange={setMealType} />

             {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

             <button onClick={onQuickLog} disabled={committing || !quick.kcal} style={{ ...btnPrimary, opacity: committing || !quick.kcal ? 0.5 : 1 }}>
               {committing ? "Logging…" : "Quick log meal"}
             </button>
          </div>
        )}

        {mode === "search" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="oats, chicken, banana…"
              autoFocus
              style={{ width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 22, fontWeight: 700, padding: "10px 0", outline: 0 }}
            />

            {searching && <div style={{ color: "var(--muted)", fontSize: 13 }}>Searching…</div>}
            {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

            {localMatches.length > 0 && (
              <Section label="Your recents">
                {localMatches.map((f) => <ResultRow key={f.sourceRef} f={f} onClick={() => setSelected(f)} />)}
              </Section>
            )}
            {remote.length > 0 && (
              <Section label="Open Food Facts">
                {remote.map((f) => <ResultRow key={f.sourceRef} f={f} onClick={() => setSelected(f)} />)}
              </Section>
            )}

            {!searching && debounced && localMatches.length === 0 && remote.length === 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <p style={{ color: "var(--muted)", marginBottom: 12 }}>No matches for "{debounced}".</p>
                <button onClick={() => { setC((c) => ({ ...c, name: debounced })); setCreating(true); }} style={btnPrimary}>
                  Define custom food
                </button>
              </div>
            )}

            {creating && (
              <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <CField label="Name" value={c.name} onChange={(v) => setC({ ...c, name: v })} />
                <CField label="Brand (optional)" value={c.brand} onChange={(v) => setC({ ...c, brand: v })} />
                <div style={{ display: "flex", gap: 12 }}>
                  <CField label="Kcal / 100g" value={c.kcal} onChange={(v) => setC({ ...c, kcal: v })} numeric />
                  <CField label="Protein g" value={c.protein} onChange={(v) => setC({ ...c, protein: v })} numeric />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <CField label="Carbs g" value={c.carbs} onChange={(v) => setC({ ...c, carbs: v })} numeric />
                  <CField label="Fat g" value={c.fat} onChange={(v) => setC({ ...c, fat: v })} numeric />
                </div>
                <button onClick={onCreate} style={btnPrimary}>Save & choose portion</button>
                <button onClick={() => setCreating(false)} style={btnGhost}>Cancel</button>
              </section>
            )}
          </div>
        )}

        <Link href="/today" style={{ ...btnGhost, display: "inline-block", textAlign: "center", textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </main>
  );
}

const MealTypeSelector = ({ value, onChange }: { value: MealType; onChange: (v: MealType) => void }) => (
  <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 8, display: "flex" }}>
    {MEAL_TYPES.map((mt) => {
      const active = value === mt.value;
      return (
        <button key={mt.value} onClick={() => onChange(mt.value)} style={{ flex: 1, padding: 12, border: 0, background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: "pointer" }}>
          {mt.label}
        </button>
      );
    })}
  </section>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section>
    <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      {children}
    </div>
  </section>
);

const ResultRow = ({ f, onClick }: { f: FoodCandidate; onClick: () => void }) => (
  <button onClick={onClick} style={{ display: "block", width: "100%", padding: "14px 16px", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--border)", color: "var(--fg)", cursor: "pointer" }}>
    <div style={{ fontSize: 15, fontWeight: 600 }}>{f.name}</div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{f.brand ?? "Generic"}</span>
      <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>{Math.round(f.kcalPer100g)} kcal/100g</span>
    </div>
  </button>
);

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    <div style={{ color, fontSize: 18, fontWeight: 800 }}>{value}</div>
  </div>
);

const CField = ({ label, value, onChange, numeric }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>{label}</span>
    <input type={numeric ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 18, fontWeight: 700, padding: "4px 0", outline: 0 }} />
  </label>
);

const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: "10px 0", borderRadius: 10, border: 0,
  background: active ? "var(--surface)" : "transparent",
  color: active ? "var(--fg)" : "var(--muted)",
  fontSize: 14, fontWeight: active ? 700 : 500, cursor: "pointer"
});

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost: React.CSSProperties = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer" };
