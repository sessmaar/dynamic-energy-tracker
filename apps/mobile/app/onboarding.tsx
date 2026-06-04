import { useReducer, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";
import { assessmentReducer, initialAssessment } from "@/onboarding/assessment";
import { isStepValid, type StepId } from "@/onboarding/validation";
import { GhostButton, PrimaryButton, ProgressBar } from "@/onboarding/ui";
import { StepWelcome } from "@/onboarding/steps/StepWelcome";
import { StepAboutYou } from "@/onboarding/steps/StepAboutYou";
import { StepBodyComposition } from "@/onboarding/steps/StepBodyComposition";
import { StepActivity } from "@/onboarding/steps/StepActivity";
import { StepGoal } from "@/onboarding/steps/StepGoal";
import { StepDiet } from "@/onboarding/steps/StepDiet";
import { StepReminders } from "@/onboarding/steps/StepReminders";
import { StepPlan } from "@/onboarding/steps/StepPlan";

const ORDER: StepId[] = ["welcome", "aboutYou", "bodyComp", "activity", "goal", "diet", "reminders", "plan"];

export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeOnboarding = useEngine((s) => s.completeOnboarding);

  const [a, dispatch] = useReducer(assessmentReducer, initialAssessment);
  const [index, setIndex] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = ORDER[index]!;
  const isLast = index === ORDER.length - 1;
  const canAdvance = isStepValid(step, a);

  const next = async () => {
    if (!canAdvance) return;
    if (!isLast) { setIndex((i) => i + 1); return; }
    setCommitting(true);
    setError(null);
    try {
      await completeOnboarding(a);
      haptic.success();
      router.replace("/command");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      haptic.error();
      setCommitting(false);
    }
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
        <ProgressBar step={index + 1} total={ORDER.length} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step === "welcome" && <StepWelcome />}
        {step === "aboutYou" && <StepAboutYou a={a} dispatch={dispatch} />}
        {step === "bodyComp" && <StepBodyComposition a={a} dispatch={dispatch} />}
        {step === "activity" && <StepActivity a={a} dispatch={dispatch} />}
        {step === "goal" && <StepGoal a={a} dispatch={dispatch} />}
        {step === "diet" && <StepDiet a={a} dispatch={dispatch} />}
        {step === "reminders" && <StepReminders a={a} dispatch={dispatch} />}
        {step === "plan" && <StepPlan a={a} />}
        {error && <Text style={{ color: t.error, fontSize: 14, marginTop: 16 }}>{error}</Text>}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 12, gap: 4 }}>
        <PrimaryButton
          label={isLast ? (committing ? "Setting up…" : "Start tracking") : "Continue"}
          onPress={next}
          disabled={!canAdvance || committing}
        />
        {index > 0 && <GhostButton label="Back" onPress={back} />}
      </View>
    </View>
  );
}
