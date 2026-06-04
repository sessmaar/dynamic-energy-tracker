import { View } from "react-native";
import { type Assessment, type AssessmentAction } from "../assessment";
import { SelectableRow, StepHeader, Stack } from "../ui";

export const StepReminders = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const r = a.reminders;
  return (
    <View>
      <StepHeader eyebrow="Step 6 · Optional" title="Reminders" subtitle="We'll nudge you only for what you turn on." />
      <Stack gap={12}>
        <SelectableRow title="Daily logging reminder" detail="A gentle nudge to log your food" trailing={r.logging ? "On" : "Off"}
          selected={r.logging} onPress={() => dispatch({ type: "setReminders", patch: { logging: !r.logging } })} />
        <SelectableRow title="Weigh-in reminder" detail="Best taken first thing in the morning" trailing={r.weighIn ? "On" : "Off"}
          selected={r.weighIn} onPress={() => dispatch({ type: "setReminders", patch: { weighIn: !r.weighIn } })} />
        <SelectableRow title="Weekly check-in" detail="Review and accept your adjusted targets" trailing={r.weeklyCheckin ? "On" : "Off"}
          selected={r.weeklyCheckin} onPress={() => dispatch({ type: "setReminders", patch: { weeklyCheckin: !r.weeklyCheckin } })} />
      </Stack>
    </View>
  );
};
