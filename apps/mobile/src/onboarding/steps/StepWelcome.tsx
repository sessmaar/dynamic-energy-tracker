import { View } from "react-native";
import { StepHeader } from "../ui";

export const StepWelcome = () => (
  <View>
    <StepHeader
      eyebrow="Welcome"
      title="Targets that adapt to your real metabolism"
      subtitle="Answer a few questions and we'll set your starting calories and macros. As you log, your targets adjust automatically — no recalculating by hand."
    />
  </View>
);
