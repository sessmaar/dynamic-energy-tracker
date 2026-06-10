"use client";

import { useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_LEVELS, localDateInTimezone } from "@dynamic-energy/engine";
import { assessmentReducer, initialAssessment, type Assessment, type AssessmentAction, type BodyCompMethod, type DietPattern } from "@/lib/onboarding/assessment";
import { isStepValid, type StepId } from "@/lib/onboarding/validation";
import { computeStartingPlan } from "@/lib/onboarding/plan";
import { commitOnboarding } from "@/lib/onboarding/persistence";

const ORDER: StepId[] = ["welcome", "aboutYou", "bodyComp", "activity", "goal", "diet", "reminders", "plan"];

export default function OnboardingPage() {
  const router = useRouter();
  const [a, dispatch] = useReducer(assessmentReducer, initialAssessment);
  const [index, setIndex] = useState(0);
  const step = ORDER[index]!;
  const canAdvance = isStepValid(step, a);
  const isLast = index === ORDER.length - 1;

  const tz = useMemo(
    () => Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC",
    [],
  );

  const onNext = () => {
    if (!canAdvance) return;
    if (!isLast) { setIndex((i) => i + 1); return; }
    const today = localDateInTimezone(tz);
    commitOnboarding(a, tz, today);
    router.replace("/today");
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <ProgressBar step={index + 1} total={ORDER.length} />
        {step === "welcome" && <StepWelcome />}
        {step === "aboutYou" && <StepAboutYou a={a} dispatch={dispatch} />}
        {step === "bodyComp" && <StepBodyComp a={a} dispatch={dispatch} />}
        {step === "activity" && <StepActivity a={a} dispatch={dispatch} />}
        {step === "goal" && <StepGoal a={a} dispatch={dispatch} />}
        {step === "diet" && <StepDiet a={a} dispatch={dispatch} />}
        {step === "reminders" && <StepReminders />}
        {step === "plan" && <StepPlan a={a} today={localDateInTimezone(tz)} />}
        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && <button onClick={() => setIndex((i) => i - 1)} style={btnGhost}>Back</button>}
          <button onClick={onNext} disabled={!canAdvance} style={{ ...btnPrimary, opacity: canAdvance ? 1 : 0.4 }}>
            {isLast ? "Start tracking →" : "Continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

const ProgressBar = ({ step, total }: { step: number; total: number }) => (
  <div style={{ height: 4, background: "var(--surface-container)", borderRadius: 999, overflow: "hidden" }}>
    <div style={{ height: 4, width: `${Math.round((step / total) * 100)}%`, background: "var(--accent)", borderRadius: 999 }} />
  </div>
);

const Header = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>{eyebrow}</span>
    <h1 style={{ color: "var(--fg)", fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>{title}</h1>
    {subtitle && <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.5, margin: 0 }}>{subtitle}</p>}
  </div>
);

const Field = ({ label, value, onChange, unit, type = "text" }: { label: string; value: string; onChange: (v: string) => void; unit?: string; type?: "text" | "number" | "date" }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--fg)", fontSize: 24, fontWeight: 700, padding: 0 }} />
      {unit && <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{unit}</span>}
    </div>
  </label>
);

const Segment = <T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
  <div style={{ display: "flex", background: "var(--surface-container)", borderRadius: 12, padding: 4 }}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: 0, background: active ? "var(--surface)" : "transparent", color: active ? "var(--fg)" : "var(--muted)", fontSize: 14, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
          {o.label}
        </button>
      );
    })}
  </div>
);

const SelectableRow = ({ title, detail, trailing, selected, onClick }: { title: string; detail?: string; trailing?: string; selected: boolean; onClick: () => void }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: 16, borderRadius: 14, border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    background: selected ? "var(--accent-soft)" : "var(--surface)", textAlign: "left", cursor: "pointer", width: "100%",
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ color: selected ? "var(--accent)" : "var(--fg)", fontSize: 15, fontWeight: 600 }}>{title}</div>
      {detail && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>{detail}</div>}
    </div>
    {trailing && <span style={{ color: selected ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 600 }}>{trailing}</span>}
  </button>
);

// --- Steps ---

const StepWelcome = () => (
  <Header eyebrow="Welcome" title="Targets that adapt to your real metabolism"
    subtitle="Answer a few questions and we'll set your starting calories and macros. As you log, your targets adjust automatically — no recalculating by hand." />
);

const StepAboutYou = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header eyebrow="Step 1" title="About you" subtitle="These set your baseline metabolic rate." />
      <Segment options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} value={a.sex} onChange={(sex) => set({ sex })} />
      <Segment options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} value={a.units} onChange={(units) => set({ units })} />
      <Field label="Date of birth" type="date" value={a.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} />
      <Field label="Height" type="number" value={String(a.heightCm)} unit={a.units === "metric" ? "cm" : "cm (we'll convert)"} onChange={(v) => set({ heightCm: Number(v) || 0 })} />
      <Field label="Current weight" type="number" value={String(a.currentWeightKg)} unit={a.units === "metric" ? "kg" : "kg (we'll convert)"} onChange={(v) => set({ currentWeightKg: Number(v) || 0 })} />
    </div>
  );
};

const StepBodyComp = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const setBc = (patch: Partial<Assessment["bodyComp"]>) => dispatch({ type: "setBodyComp", patch });
  const choose = (method: BodyCompMethod) => dispatch({ type: "setBodyComp", patch: { method } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header eyebrow="Step 2 · Optional" title="Body composition" subtitle="If you have a measured body-fat %, we'll use a more accurate formula. We never ask you to guess — skip if you're not sure." />
      <SelectableRow title="I have a measured body-fat %" detail="From DEXA, smart scale, or calipers" selected={a.bodyComp.method === "direct"} onClick={() => choose("direct")} />
      <SelectableRow title="Measure with a tape" detail="We'll use the U.S. Navy method" selected={a.bodyComp.method === "tape"} onClick={() => choose("tape")} />
      <SelectableRow title="Skip for now" detail="We'll use the standard formula" selected={a.bodyComp.method === "skip"} onClick={() => choose("skip")} />
      {a.bodyComp.method === "direct" && (
        <Field label="Body fat %" type="number" unit="%" value={a.bodyComp.directBodyFatPct != null ? String(Math.round(a.bodyComp.directBodyFatPct * 100)) : ""} onChange={(v) => setBc({ directBodyFatPct: v ? Number(v) / 100 : null })} />
      )}
      {a.bodyComp.method === "tape" && (
        <>
          <Field label="Neck" type="number" unit="cm" value={a.bodyComp.neckCm != null ? String(a.bodyComp.neckCm) : ""} onChange={(v) => setBc({ neckCm: v ? Number(v) : null })} />
          <Field label="Waist" type="number" unit="cm" value={a.bodyComp.waistCm != null ? String(a.bodyComp.waistCm) : ""} onChange={(v) => setBc({ waistCm: v ? Number(v) : null })} />
          {a.sex === "female" && <Field label="Hip" type="number" unit="cm" value={a.bodyComp.hipCm != null ? String(a.bodyComp.hipCm) : ""} onChange={(v) => setBc({ hipCm: v ? Number(v) : null })} />}
        </>
      )}
    </div>
  );
};

const StepActivity = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Header eyebrow="Step 3" title="Your lifestyle" subtitle="This sets your starting calorie estimate. We refine it from your real data each week." />
    {ACTIVITY_LEVELS.map((o) => (
      <SelectableRow key={o.key} title={o.label} detail={o.detail} selected={a.activityLevel === o.key} onClick={() => dispatch({ type: "set", patch: { activityLevel: o.key } })} />
    ))}
  </div>
);

const StepGoal = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header eyebrow="Step 4" title="Your goal" subtitle="We'll keep your rate within a safe range." />
      <Segment options={[{ value: "cut", label: "Lose" }, { value: "maintain", label: "Maintain" }, { value: "gain", label: "Gain" }]} value={a.goalType} onChange={(goalType) => set({ goalType })} />
      {a.goalType !== "maintain" && (
        <>
          <Field label="Weekly rate" type="number" unit="kg/wk" value={String(a.rateKgPerWeek)} onChange={(v) => set({ rateKgPerWeek: Number(v) || 0 })} />
          <Field label="Goal weight (optional)" type="number" unit="kg" value={a.goalWeightKg != null ? String(a.goalWeightKg) : ""} onChange={(v) => set({ goalWeightKg: v ? Number(v) : null })} />
        </>
      )}
    </div>
  );
};

const PATTERNS: { value: DietPattern; title: string; detail: string }[] = [
  { value: "balanced", title: "Balanced", detail: "Even split, moderate protein" },
  { value: "high_protein", title: "High protein", detail: "Prioritize protein for muscle" },
  { value: "lower_carb", title: "Lower carb", detail: "More fat, fewer carbs" },
  { value: "custom", title: "Custom", detail: "Set protein and fat yourself" },
];

const StepDiet = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header eyebrow="Step 5" title="Dietary preference" subtitle="This shapes how we split your calories into macros." />
      {PATTERNS.map((p) => (
        <SelectableRow key={p.value} title={p.title} detail={p.detail} selected={a.dietPattern === p.value} onClick={() => set({ dietPattern: p.value })} />
      ))}
      {a.dietPattern === "custom" && (
        <>
          <Field label="Protein" type="number" unit="g/kg" value={a.customProteinPerKg != null ? String(a.customProteinPerKg) : ""} onChange={(v) => set({ customProteinPerKg: v ? Number(v) : null })} />
          <Field label="Fat" type="number" unit="% of calories" value={a.customFatPct != null ? String(Math.round(a.customFatPct * 100)) : ""} onChange={(v) => set({ customFatPct: v ? Number(v) / 100 : null })} />
        </>
      )}
    </div>
  );
};

const StepReminders = () => (
  <Header eyebrow="Step 6 · Optional" title="Reminders" subtitle="Skipping for now — you can wire notifications later. Press Continue to see your starting plan." />
);

const StepPlan = ({ a, today }: { a: Assessment; today: string }) => {
  const plan = computeStartingPlan(a, today);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header eyebrow="Your starting plan" title={`${Math.round(plan.dailyCalories).toLocaleString()} kcal / day`} subtitle="These are your starting targets. They'll adapt automatically as you log." />
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", gap: 16 }}>
        <Metric label="Protein" value={`${plan.macros.proteinG} g`} color="var(--viz-protein)" />
        <Metric label="Carbs" value={`${plan.macros.carbsG} g`} color="var(--viz-carbs)" />
        <Metric label="Fat" value={`${plan.macros.fatG} g`} color="var(--viz-fat)" />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Estimated daily energy use: {Math.round(plan.tdee).toLocaleString()} kcal{plan.usedComposition ? " · using your body composition" : ""}.
      </p>
      {plan.clamped && (
        <p style={{ color: "var(--viz-warning)", fontSize: 13 }}>
          We adjusted your rate to a safer {Math.abs(plan.effectiveRateKgPerWeek).toFixed(2)} kg/week.
        </p>
      )}
    </div>
  );
};

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    <div style={{ color, fontSize: 22, fontWeight: 800 }}>{value}</div>
  </div>
);

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost: React.CSSProperties = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer" };
