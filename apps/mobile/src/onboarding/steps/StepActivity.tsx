import { View } from "react-native";
import { ACTIVITY_LEVELS } from "@dynamic-energy/engine";
import { type Assessment, type AssessmentAction } from "../assessment";
import { SelectableRow, StepHeader, Stack } from "../ui";

export const StepActivity = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => (
  <View>
    <StepHeader eyebrow="Step 3" title="Your lifestyle" subtitle="This sets your starting calorie estimate. We refine it from your real data each week." />
    <Stack gap={12}>
      {ACTIVITY_LEVELS.map((o) => (
        <SelectableRow
          key={o.key}
          title={o.label}
          detail={o.detail}
          selected={a.activityLevel === o.key}
          onPress={() => dispatch({ type: "set", patch: { activityLevel: o.key } })}
        />
      ))}
    </Stack>
  </View>
);
