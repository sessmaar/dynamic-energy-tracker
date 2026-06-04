import { View } from "react-native";
import { kgToLb, lbToKg } from "@dynamic-energy/engine";
import { type Assessment, type AssessmentAction } from "../assessment";
import { Field, Segment, StepHeader, Stack } from "../ui";

export const StepGoal = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  const metric = a.units === "metric";
  const rateDisplay = metric ? String(a.rateKgPerWeek) : kgToLb(a.rateKgPerWeek).toFixed(2);
  const goalWeightDisplay =
    a.goalWeightKg == null ? "" : metric ? String(a.goalWeightKg) : kgToLb(a.goalWeightKg).toFixed(1);

  return (
    <View>
      <StepHeader eyebrow="Step 4" title="Your goal" subtitle="We'll keep your rate within a safe range." />
      <Stack gap={24}>
        <Segment<Assessment["goalType"]>
          options={[{ value: "cut", label: "Lose" }, { value: "maintain", label: "Maintain" }, { value: "gain", label: "Gain" }]}
          value={a.goalType}
          onChange={(goalType) => set({ goalType })}
        />
        {a.goalType !== "maintain" && (
          <>
            <Field
              label="Weekly rate"
              unit={metric ? "kg/wk" : "lb/wk"}
              value={rateDisplay}
              onChangeText={(v) => set({ rateKgPerWeek: metric ? Number(v) || 0 : lbToKg(Number(v) || 0) })}
            />
            <Field
              label="Goal weight (optional)"
              unit={metric ? "kg" : "lb"}
              value={goalWeightDisplay}
              onChangeText={(v) => set({ goalWeightKg: v ? (metric ? Number(v) : lbToKg(Number(v))) : null })}
            />
          </>
        )}
      </Stack>
    </View>
  );
};
