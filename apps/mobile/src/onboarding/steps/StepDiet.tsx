import { View } from "react-native";
import { type Assessment, type AssessmentAction, type DietPattern } from "../assessment";
import { Field, SelectableRow, StepHeader, Stack } from "../ui";

const PATTERNS: { value: DietPattern; title: string; detail: string }[] = [
  { value: "balanced", title: "Balanced", detail: "Even split, moderate protein" },
  { value: "high_protein", title: "High protein", detail: "Prioritize protein for muscle" },
  { value: "lower_carb", title: "Lower carb", detail: "More fat, fewer carbs" },
  { value: "custom", title: "Custom", detail: "Set protein and fat yourself" },
];

export const StepDiet = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <View>
      <StepHeader eyebrow="Step 5" title="Dietary preference" subtitle="This shapes how we split your calories into macros." />
      <Stack gap={12}>
        {PATTERNS.map((p) => (
          <SelectableRow key={p.value} title={p.title} detail={p.detail}
            selected={a.dietPattern === p.value} onPress={() => set({ dietPattern: p.value })} />
        ))}
        {a.dietPattern === "custom" && (
          <Stack gap={16}>
            <Field label="Protein" unit="g/kg" value={a.customProteinPerKg != null ? String(a.customProteinPerKg) : ""}
              onChangeText={(v) => set({ customProteinPerKg: v ? Number(v) : null })} />
            <Field label="Fat" unit="% of calories" value={a.customFatPct != null ? String(Math.round(a.customFatPct * 100)) : ""}
              onChangeText={(v) => set({ customFatPct: v ? Number(v) / 100 : null })} />
          </Stack>
        )}
      </Stack>
    </View>
  );
};
