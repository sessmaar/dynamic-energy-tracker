import { View } from "react-native";
import { type Assessment, type AssessmentAction, type BodyCompMethod } from "../assessment";
import { Field, SelectableRow, StepHeader, Stack } from "../ui";

export const StepBodyComposition = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const setBc = (patch: Partial<Assessment["bodyComp"]>) => dispatch({ type: "setBodyComp", patch });
  const choose = (method: BodyCompMethod) => dispatch({ type: "setBodyComp", patch: { method } });

  return (
    <View>
      <StepHeader
        eyebrow="Step 2 · Optional"
        title="Body composition"
        subtitle="If you have a measured body-fat %, we'll use a more accurate formula. We never ask you to guess — skip if you're not sure."
      />
      <Stack gap={12}>
        <SelectableRow title="I have a measured body-fat %" detail="From a DEXA scan, smart scale, or calipers"
          selected={a.bodyComp.method === "direct"} onPress={() => choose("direct")} />
        <SelectableRow title="Measure with a tape" detail="We'll estimate using the U.S. Navy method"
          selected={a.bodyComp.method === "tape"} onPress={() => choose("tape")} />
        <SelectableRow title="Skip for now" detail="We'll use the standard formula"
          selected={a.bodyComp.method === "skip"} onPress={() => choose("skip")} />

        {a.bodyComp.method === "direct" && (
          <Field label="Body fat %" unit="%" value={a.bodyComp.directBodyFatPct != null ? String(Math.round(a.bodyComp.directBodyFatPct * 100)) : ""}
            onChangeText={(v) => setBc({ directBodyFatPct: v ? Number(v) / 100 : null })} />
        )}
        {a.bodyComp.method === "tape" && (
          <Stack gap={16}>
            <Field label="Neck" unit="cm" value={a.bodyComp.neckCm != null ? String(a.bodyComp.neckCm) : ""}
              onChangeText={(v) => setBc({ neckCm: v ? Number(v) : null })} />
            <Field label="Waist" unit="cm" value={a.bodyComp.waistCm != null ? String(a.bodyComp.waistCm) : ""}
              onChangeText={(v) => setBc({ waistCm: v ? Number(v) : null })} />
            {a.sex === "female" && (
              <Field label="Hip" unit="cm" value={a.bodyComp.hipCm != null ? String(a.bodyComp.hipCm) : ""}
                onChangeText={(v) => setBc({ hipCm: v ? Number(v) : null })} />
            )}
          </Stack>
        )}
      </Stack>
    </View>
  );
};
