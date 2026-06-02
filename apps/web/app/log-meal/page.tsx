"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type FoodCandidate, type FoodSummary, type MealType,
  computeMealItemNutrition, searchOpenFoodFacts,
} from "@dynamic-energy/data";
import { isoDate, localDateInTimezone } from "@dynamic-energy/engine";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Web parity for mobile's /log-meal. Same three-step flow:
 *   query → results (cached + Open Food Facts) → portion picker.
 * Submission writes a meal row + meal_item via the shared data package.
 */
export default function LogMealPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <Shell><Empty title="BACKEND NOT CONFIGURED" body="Set NEXT_PUBLIC_SUPABASE_* in apps/web/.env.local." /></Shell>;
  if (session === undefined) return <Shell><Empty title="…" body="Restoring session." /></Shell>;
  if (!session) { router.replace("/sign-in"); return null; }
  return <Shell><MealLogger userId={session.user.id} /></Shell>;
}

// ------------------------------------------------------------------------

type SelectedFood =
  | { kind: "local"; food: FoodSummary }
  | { kind: "remote"; candidate: FoodCandidate };

const toFood = (s: SelectedFood) =>
  s.kind === "local" ? s.food : {
    id: "", name: s.candidate.name, brand: s.candidate.brand,
    kcalPer100g: s.candidate.kcalPer100g,
    proteinPer100g: s.candidate.proteinPer100g,
    carbsPer100g: s.candidate.carbsPer100g,
    fatPer100g: s.candidate.fatPer100g,
    commonUnit: null, commonUnitGrams: null,
  };

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Morn"  },
  { value: "lunch",     label: "Noon"  },
  { value: "dinner",    label: "Eve"   },
  { value: "snack",     label: "Snack" },
];

const useDebounced = <T,>(value: T, ms = 350): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const MealLogger = ({ userId }: { userId: string }) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const [local, setLocal] = useState<FoodSummary[]>([]);
  const [remote, setRemote] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SelectedFood | null>(null);
  const [grams, setGrams] = useState("100");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [committing, setCommitting] = useState(false);

  // Custom-food state
  const [creating, setCreating] = useState(false);
  const [c, setC] = useState({ name: "", brand: "", kcal: "", protein: "", carbs: "", fat: "" });

  useEffect(() => {
    if (!debounced) { setLocal([]); setRemote([]); return; }
    let cancelled = false;
    setSearching(true); setError(null);
    void (async () => {
      try {
        const l = await repos.food.searchLocal(debounced, 8);
        if (cancelled) return;
        setLocal(l);
        if (l.length < 5) {
          const r = await searchOpenFoodFacts(debounced, 12);
          if (cancelled) return;
          setRemote(r);
        } else setRemote([]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  const nutrition = useMemo(() => {
    if (!selected) return null;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    return computeMealItemNutrition(toFood(selected), g);
  }, [selected, grams]);

  const onCreate = async () => {
    if (!c.name.trim() || !Number.isFinite(Number(c.kcal)) || Number(c.kcal) < 0) {
      setError("Name and kcal/100g required."); return;
    }
    try {
      const food = await repos.food.createCustom({
        userId,
        name: c.name.trim(),
        brand: c.brand.trim() || undefined,
        kcalPer100g: Number(c.kcal),
        proteinPer100g: c.protein ? Number(c.protein) : undefined,
        carbsPer100g:   c.carbs   ? Number(c.carbs)   : undefined,
        fatPer100g:     c.fat     ? Number(c.fat)     : undefined,
      });
      setCreating(false);
      setSelected({ kind: "local", food });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCommit = async () => {
    if (!selected || !nutrition) return;
    setCommitting(true); setError(null);
    try {
      let foodId: string | undefined;
      if (selected.kind === "local") {
        foodId = selected.food.id;
      } else {
        const cached = await repos.food.upsertCandidate(selected.candidate);
        foodId = cached.id;
      }
      const food = toFood(selected);
      // Use browser-resolved timezone for the local date — matches the engine helper.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await repos.meal.logMeal({
        userId,
        date: localDateInTimezone(tz),
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
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  // --- Selected: portion + meal slot view ---
  if (selected) {
    const food = toFood(selected);
    return (
      <>
        <Header eyebrow="Logger · Portion" title="ENTER" />
        <div className="card card-lg" style={{ marginBottom: "var(--gap-md)" }}>
          <span className="meta">{food.brand ?? selected.kind.toUpperCase()}</span>
          <h2 className="h3" style={{ marginTop: 4 }}>{food.name}</h2>
          <div className="row" style={{ gap: "var(--gap-lg)", marginTop: "var(--gap-sm)" }}>
            <Stat label="KCAL/100G" value={Math.round(food.kcalPer100g).toString()} />
            <Stat label="P" value={food.proteinPer100g?.toFixed(1) ?? "—"} />
            <Stat label="C" value={food.carbsPer100g?.toFixed(1) ?? "—"} />
            <Stat label="F" value={food.fatPer100g?.toFixed(1) ?? "—"} />
          </div>
        </div>

        <div className="card card-lg" style={{ marginBottom: "var(--gap-md)" }}>
          <span className="meta">Portion · Grams</span>
          <input
            type="number"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            style={inputBigNumber}
          />
          {nutrition && (
            <div className="row" style={{ gap: "var(--gap-lg)", marginTop: "var(--gap-md)" }}>
              <Stat label="THIS PORTION" value={`${nutrition.kcal} KCAL`} accent />
              <Stat label="P" value={nutrition.proteinG?.toString() ?? "—"} />
              <Stat label="C" value={nutrition.carbsG?.toString() ?? "—"} />
              <Stat label="F" value={nutrition.fatG?.toString() ?? "—"} />
            </div>
          )}
        </div>

        <div className="card card-lg" style={{ marginBottom: "var(--gap-lg)" }}>
          <span className="meta">Meal Slot</span>
          <div className="row" style={{ marginTop: 8, border: "0.5px solid var(--border)" }}>
            {MEAL_TYPES.map((mt, i) => {
              const active = mealType === mt.value;
              return (
                <button
                  key={mt.value}
                  onClick={() => setMealType(mt.value)}
                  style={{
                    flex: 1, padding: 14, background: active ? "var(--accent-soft)" : "transparent",
                    border: 0, borderLeft: i === 0 ? 0 : "0.5px solid var(--border)",
                    color: active ? "var(--accent)" : "var(--muted)",
                    fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em",
                    fontSize: 11, cursor: "pointer",
                  }}
                >
                  {mt.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="meta" style={{ color: "var(--accent)" }}>{error}</p>}
        <div className="col" style={{ gap: "var(--gap-md)" }}>
          <button onClick={onCommit} disabled={committing || !nutrition} style={btnPrimary}>
            {committing ? "Logging…" : "Commit Meal"}
          </button>
          <button onClick={() => setSelected(null)} style={btnSecondary}>← Different Food</button>
        </div>
      </>
    );
  }

  // --- Search view ---
  return (
    <>
      <Header eyebrow="Logger · Food" title="SEARCH" />
      <div className="card card-lg" style={{ marginBottom: "var(--gap-md)" }}>
        <span className="meta">Query</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="oats, chicken, banana…"
          autoFocus
          style={{
            width: "100%", fontFamily: "var(--font-body)", fontSize: 22, fontWeight: 700,
            background: "transparent", border: 0, borderBottom: "0.5px solid var(--border)",
            color: "var(--fg)", outline: "none", padding: "8px 0", marginTop: 8,
          }}
        />
      </div>

      {searching && <p className="meta" style={{ color: "var(--accent)" }}>Searching catalog…</p>}
      {error && <p className="meta" style={{ color: "var(--accent)" }}>{error}</p>}

      {local.length > 0 && (
        <Section label="Cached Catalog">
          {local.map((f) => (
            <ResultRow key={f.id} title={f.name} subtitle={f.brand ?? "LOCAL"}
              kcal={`${Math.round(f.kcalPer100g)} kcal/100g`}
              onClick={() => setSelected({ kind: "local", food: f })}
            />
          ))}
        </Section>
      )}

      {remote.length > 0 && (
        <Section label="Open Food Facts">
          {remote.map((r) => (
            <ResultRow key={r.sourceRef} title={r.name} subtitle={r.brand ?? "OFF"}
              kcal={`${Math.round(r.kcalPer100g)} kcal/100g`}
              onClick={() => setSelected({ kind: "remote", candidate: r })}
            />
          ))}
        </Section>
      )}

      {!searching && debounced && local.length === 0 && remote.length === 0 && (
        <div className="card card-lg">
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            No matches for &quot;{debounced}&quot;.
          </p>
          <button
            onClick={() => { setC((c) => ({ ...c, name: debounced })); setCreating(true); }}
            style={btnPrimary}
          >
            Define Custom Food
          </button>
        </div>
      )}

      {creating && (
        <div className="card card-lg" style={{ marginTop: "var(--gap-md)" }}>
          <span className="meta">Custom Food · Definition</span>
          <div className="col" style={{ gap: "var(--gap-md)", marginTop: "var(--gap-sm)" }}>
            <CustomField label="Name"            value={c.name}    onChange={(v) => setC({ ...c, name: v })} />
            <CustomField label="Brand (optional)" value={c.brand}  onChange={(v) => setC({ ...c, brand: v })} />
            <div className="row" style={{ gap: "var(--gap-md)" }}>
              <CustomField label="kcal / 100g" numeric value={c.kcal}    onChange={(v) => setC({ ...c, kcal: v })} />
              <CustomField label="Protein g"   numeric value={c.protein} onChange={(v) => setC({ ...c, protein: v })} />
            </div>
            <div className="row" style={{ gap: "var(--gap-md)" }}>
              <CustomField label="Carbs g" numeric value={c.carbs} onChange={(v) => setC({ ...c, carbs: v })} />
              <CustomField label="Fat g"   numeric value={c.fat}   onChange={(v) => setC({ ...c, fat: v })} />
            </div>
            <button onClick={onCreate} style={btnPrimary}>Save &amp; Pick Portion</button>
            <button onClick={() => setCreating(false)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      <div className="col" style={{ gap: "var(--gap-md)", marginTop: "var(--gap-lg)" }}>
        {!creating && (
          <button onClick={() => setCreating(true)} style={btnSecondary}>+ Define Custom Food</button>
        )}
        <Link href="/dashboard" style={{ ...btnSecondary, display: "inline-block", textAlign: "center" }}>
          Cancel
        </Link>
      </div>
    </>
  );
};

// ------------------------------------------------------------------------

const Shell = ({ children }: { children: React.ReactNode }) => (
  <>
    <header className="topnav">
      <div className="container topnav-inner">
        <span className="topnav-logo">DET<span style={{ color: "var(--accent)" }}>·</span>CONSOLE</span>
        <nav>
          <Link href="/">Demo</Link>
          <Link href="/dashboard">Live</Link>
          <Link href="/log-meal" className="active">Log Meal</Link>
          <Link href="/import">Import</Link>
        </nav>
      </div>
    </header>
    <main className="container section" style={{ maxWidth: 720 }}>{children}</main>
  </>
);

const Header = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div style={{ marginBottom: "var(--gap-lg)" }}>
    <span className="eyebrow">{eyebrow}</span>
    <h1 className="h2" style={{ marginTop: 16 }}>{title}</h1>
  </div>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "var(--gap-lg)" }}>
    <span className="meta" style={{ display: "block", marginBottom: 8 }}>{label}</span>
    <div style={{ border: "0.5px solid var(--border)" }}>{children}</div>
  </section>
);

const ResultRow = ({ title, subtitle, kcal, onClick }: {
  title: string; subtitle: string; kcal: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      display: "block", width: "100%", padding: "12px 16px", textAlign: "left",
      background: "transparent", border: 0, borderBottom: "0.5px solid var(--border)",
      color: "var(--fg)", cursor: "pointer",
    }}
  >
    <div style={{ fontSize: 14 }}>{title}</div>
    <div className="row between" style={{ marginTop: 4 }}>
      <span className="meta">{subtitle}</span>
      <span className="meta" style={{ color: "var(--accent)" }}>{kcal}</span>
    </div>
  </button>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <span className="meta">{label}</span>
    <span className="num" style={{ fontSize: 16, fontWeight: 700, color: accent ? "var(--accent)" : "var(--fg)" }}>
      {value}
    </span>
  </div>
);

const CustomField = ({ label, value, onChange, numeric }: {
  label: string; value: string; onChange: (v: string) => void; numeric?: boolean;
}) => (
  <div className="col flex1" style={{ gap: 4 }}>
    <span className="meta">{label}</span>
    <input
      type={numeric ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "transparent", border: 0,
        borderBottom: "0.5px solid var(--border)", color: "var(--fg)",
        fontFamily: numeric ? "var(--font-mono)" : "var(--font-body)",
        fontSize: 18, fontWeight: 700, outline: "none", padding: "6px 0",
      }}
    />
  </div>
);

const Empty = ({ title, body }: { title: string; body: string }) => (
  <>
    <span className="eyebrow">System</span>
    <h1 className="h2" style={{ marginTop: 16 }}>{title}</h1>
    <p style={{ color: "var(--muted)", marginTop: 24 }}>{body}</p>
  </>
);

const inputBigNumber: React.CSSProperties = {
  width: "100%", fontFamily: "var(--font-mono)", fontSize: 40, fontWeight: 800,
  background: "transparent", border: 0, borderBottom: "0.5px solid var(--border)",
  color: "var(--fg)", outline: "none", padding: "8px 0", marginTop: 8,
};
const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "var(--bg)", border: "0.5px solid var(--accent)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "var(--surface)", color: "var(--fg)", border: "0.5px solid var(--border)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
  textDecoration: "none",
};
