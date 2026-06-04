import { View, Text } from "react-native";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useTheme } from "@/design";
import { type Assessment } from "../assessment";
import { computeStartingPlan } from "../plan";
import { StepHeader, Stack } from "../ui";

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{value}</Text>
    </View>
  );
};

export const StepPlan = ({ a }: { a: Assessment }) => {
  const t = useTheme();
  const today = localDateInTimezone(Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC");
  const plan = computeStartingPlan(a, today);

  return (
    <View>
      <StepHeader eyebrow="Your starting plan" title={`${Math.round(plan.dailyCalories).toLocaleString()} calories / day`}
        subtitle="These are your starting targets. They'll adapt automatically as you log." />
      <View style={{ backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 20, gap: 20 }}>
        <View style={{ flexDirection: "row" }}>
          <Metric label="Protein" value={`${plan.macros.proteinG} g`} color={t.protein} />
          <Metric label="Carbs" value={`${plan.macros.carbsG} g`} color={t.carbs} />
          <Metric label="Fat" value={`${plan.macros.fatG} g`} color={t.fat} />
        </View>
        <Stack gap={6}>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Estimated daily energy use: {Math.round(plan.tdee).toLocaleString()} kcal
            {plan.usedComposition ? " · using your body composition" : ""}.
          </Text>
          {plan.clamped && (
            <Text style={{ color: t.warning, fontSize: 13 }}>
              We adjusted your rate to a safer {Math.abs(plan.effectiveRateKgPerWeek).toFixed(2)} kg/week.
            </Text>
          )}
        </Stack>
      </View>
    </View>
  );
};
