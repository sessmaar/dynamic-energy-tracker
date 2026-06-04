import { View } from "react-native";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "@dynamic-energy/engine";
import { type Assessment, type AssessmentAction } from "../assessment";
import { Field, Segment, StepHeader, Stack } from "../ui";

export const StepAboutYou = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  const ftin = cmToFtIn(a.heightCm || 0);
  const weightLb = kgToLb(a.currentWeightKg || 0).toFixed(1);

  return (
    <View>
      <StepHeader eyebrow="Step 1" title="About you" subtitle="These set your baseline metabolic rate." />
      <Stack gap={24}>
        <Segment<Assessment["sex"]>
          options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
          value={a.sex}
          onChange={(sex) => set({ sex })}
        />
        <Segment<Assessment["units"]>
          options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]}
          value={a.units}
          onChange={(units) => set({ units })}
        />
        <Field
          label="Date of birth (YYYY-MM-DD)"
          value={a.dateOfBirth}
          keyboardType="default"
          onChangeText={(dateOfBirth) => set({ dateOfBirth })}
        />
        {a.units === "metric" ? (
          <>
            <Field label="Height" unit="cm" value={String(a.heightCm)} onChangeText={(v) => set({ heightCm: Number(v) || 0 })} />
            <Field label="Current weight" unit="kg" value={String(a.currentWeightKg)} onChangeText={(v) => set({ currentWeightKg: Number(v) || 0 })} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field label="Height" unit="ft" keyboardType="number-pad" value={String(ftin.feet)}
                  onChangeText={(v) => set({ heightCm: ftInToCm(Number(v) || 0, ftin.inches) })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label=" " unit="in" keyboardType="number-pad" value={String(ftin.inches)}
                  onChangeText={(v) => set({ heightCm: ftInToCm(ftin.feet, Math.min(11, Number(v) || 0)) })} />
              </View>
            </View>
            <Field label="Current weight" unit="lb" value={weightLb} onChangeText={(v) => set({ currentWeightKg: lbToKg(Number(v) || 0) })} />
          </>
        )}
      </Stack>
    </View>
  );
};
