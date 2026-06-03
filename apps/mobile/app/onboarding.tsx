import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  ACTIVITY_LEVELS, type ActivityLevel, DEFAULT_ACTIVITY_LEVEL,
  clampGoalToSafety, cmToFtIn, ftInToCm, kgToLb, lbToKg,
} from "@dynamic-energy/engine";
import { Button, Card, Screen, Text, colors, fonts, fontSize, gap, hairline, radius } from "@/design";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";

type Sex = "male" | "female";
type UnitSystem = "metric" | "imperial";

const NumberField = ({
  label, value, unit, onChangeText,
}: { label: string; value: string; unit: string; onChangeText: (v: string) => void }) => (
  <View style={{ gap: gap.sm }}>
    <Text variant="meta">{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: gap.sm }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        style={{
          fontFamily: fonts.mono, fontSize: fontSize.bignum, fontWeight: "800",
          color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
          paddingVertical: gap.xs, flex: 1,
        }}
      />
      <Text variant="meta">{unit}</Text>
    </View>
  </View>
);

const Segment = <T extends string>({
  options, value, onChange,
}: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
  <View style={{
    flexDirection: "row", borderWidth: hairline.width, borderColor: hairline.color, borderRadius: radius.sharp,
  }}>
    {options.map((o, i) => {
      const active = o.value === value;
      return (
        <Pressable
          key={o.value}
          onPress={() => { haptic.light(); onChange(o.value); }}
          style={{
            flex: 1, paddingVertical: gap.md,
            backgroundColor: active ? colors.accentSoft : "transparent",
            borderLeftWidth: i === 0 ? 0 : hairline.width, borderLeftColor: hairline.color,
            alignItems: "center",
          }}
        >
          <Text variant="meta" color={active ? colors.accent : colors.muted}>{o.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

/**
 * Lifestyle picker. Each tier maps to a published Physical Activity Level
 * (PAL) multiplier; the engine seeds the cold-start TDEE as BMR × that
 * factor, then tunes it from logs each Monday. Five tiers, stacked so the
 * one-line description for each is readable.
 */
const ActivityPicker = ({
  value, onChange,
}: { value: ActivityLevel; onChange: (v: ActivityLevel) => void }) => (
  <View style={{ borderWidth: hairline.width, borderColor: hairline.color, borderRadius: radius.sharp }}>
    {ACTIVITY_LEVELS.map((o, i) => {
      const active = o.key === value;
      return (
        <Pressable
          key={o.key}
          onPress={() => { haptic.light(); onChange(o.key); }}
          style={{
            paddingVertical: gap.md, paddingHorizontal: gap.md,
            backgroundColor: active ? colors.accentSoft : "transparent",
            borderTopWidth: i === 0 ? 0 : hairline.width, borderTopColor: hairline.color,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: gap.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="meta" color={active ? colors.accent : colors.fg}>{o.label}</Text>
            <Text variant="meta" color={colors.muted}>{o.detail}</Text>
          </View>
          <Text variant="num" color={active ? colors.accent : colors.muted} style={{ fontSize: 13 }}>
            ×{o.factor.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useEngine((s) => s.setProfile);

  const [sex, setSex] = useState<Sex>("male");
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [dob, setDob] = useState<Date>(new Date("1995-01-01T00:00:00Z"));
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios"); // iOS shows inline; Android opens modal

  // We always store metric internally. When the user switches units we
  // re-render the inputs with converted values so they see a consistent
  // number; the underlying state stays in kg/cm until commit.
  const [heightCm, setHeightCm] = useState("180");
  const [weightKg, setWeightKg] = useState("80");

  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(DEFAULT_ACTIVITY_LEVEL);
  const [goalType, setGoalType] = useState<"cut" | "maintain" | "gain">("cut");
  const [rate, setRate] = useState("0.5");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Imperial display state — derived from metric on every render so a
  // unit-switch round trip never loses precision.
  const heightImperial = cmToFtIn(Number(heightCm) || 0);
  const weightLb = (kgToLb(Number(weightKg) || 0)).toFixed(1);
  const rateLbPerWk = (kgToLb(Math.abs(Number(rate)) || 0)).toFixed(1);

  // Browser-resolved timezone; falls back to UTC on devices that don't
  // expose Intl (vanishingly rare on modern RN, but kept defensive).
  const deviceTimezone =
    Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC";

  const onCommit = async () => {
    const heightNum = Number(heightCm);
    const weightNum = Number(weightKg);
    if (!Number.isFinite(heightNum) || heightNum <= 0) { setError("Height required."); return; }
    if (!Number.isFinite(weightNum) || weightNum <= 0) { setError("Weight required."); return; }
    if (dob.getUTCFullYear() < 1900 || dob > new Date()) { setError("Date of birth required."); return; }

    setCommitting(true);
    setError(null);
    try {
      const rawGoal =
        goalType === "maintain" ? 0
        : goalType === "cut" ? -Math.abs(Number(rate))
        : Math.abs(Number(rate));

      const safeGoal = clampGoalToSafety(rawGoal, weightNum);
      
      if (rawGoal !== safeGoal) {
        setCommitting(false);
        setError(`Goal rate is outside safe limits. Maximum for your mass is ${Math.abs(safeGoal).toFixed(2)} kg/wk.`);
        haptic.error();
        return;
      }

      await setProfile({
        sex,
        dateOfBirth: toIsoDate(dob),
        heightCm: heightNum,
        initialWeightKg: weightNum,
        activityLevel,
        goalKgPerWeek: safeGoal,
        timezone: deviceTimezone,
      });
      haptic.success();
      router.replace("/command");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      haptic.error();
      setCommitting(false);
    }
  };

  const onDobChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) setDob(selected);
  };

  return (
    <Screen eyebrow="Get Started" title="SETUP PROFILE">
      <Text variant="body" color={colors.muted}>
        Let's set up your profile. Provide a baseline to start, and the system will automatically adapt your target based on your logs.
      </Text>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Personal Details</Text>
            <Segment<Sex>
              options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
              value={sex}
              onChange={setSex}
            />
          </View>

          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Date of Birth</Text>
            {Platform.OS === "ios" ? (
              <View style={{ alignItems: "flex-start" }}>
                <DateTimePicker
                  value={dob}
                  mode="date"
                  display="compact"
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={onDobChange}
                />
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => setShowPicker(true)}
                  style={{ paddingVertical: gap.sm, borderBottomWidth: hairline.width, borderBottomColor: hairline.color }}
                >
                  <Text variant="num" style={{ fontSize: 22, fontWeight: "700" as const }}>
                    {toIsoDate(dob)}
                  </Text>
                </Pressable>
                {showPicker && (
                  <DateTimePicker value={dob} mode="date" maximumDate={new Date()} onChange={onDobChange} />
                )}
              </>
            )}
          </View>

          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Units</Text>
            <Segment<UnitSystem>
              options={[
                { value: "metric",   label: "Metric · kg / cm" },
                { value: "imperial", label: "Imperial · lb / ft" },
              ]}
              value={units}
              onChange={setUnits}
            />
          </View>

          {units === "metric" ? (
            <View style={{ flexDirection: "row", gap: gap.md }}>
              <View style={{ flex: 1 }}>
                <NumberField label="Height" value={heightCm} unit="CM" onChangeText={setHeightCm} />
              </View>
              <View style={{ flex: 1 }}>
                <NumberField label="Current Weight" value={weightKg} unit="KG" onChangeText={setWeightKg} />
              </View>
            </View>
          ) : (
            <View style={{ gap: gap.lg }}>
              <View style={{ gap: gap.sm }}>
                <Text variant="meta">Height · FT / IN</Text>
                <View style={{ flexDirection: "row", gap: gap.md, alignItems: "baseline" }}>
                  <TextInput
                    value={heightImperial.feet.toString()}
                    onChangeText={(v) => {
                      const ft = Number(v) || 0;
                      setHeightCm(ftInToCm(ft, heightImperial.inches).toFixed(1));
                    }}
                    keyboardType="number-pad"
                    style={{
                      fontFamily: fonts.mono, fontSize: fontSize.bignum, fontWeight: "800",
                      color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
                      paddingVertical: gap.xs, flex: 1,
                    }}
                  />
                  <Text variant="meta">FT</Text>
                  <TextInput
                    value={heightImperial.inches.toString()}
                    onChangeText={(v) => {
                      const inches = Math.min(11, Number(v) || 0);
                      setHeightCm(ftInToCm(heightImperial.feet, inches).toFixed(1));
                    }}
                    keyboardType="number-pad"
                    style={{
                      fontFamily: fonts.mono, fontSize: fontSize.bignum, fontWeight: "800",
                      color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
                      paddingVertical: gap.xs, flex: 1,
                    }}
                  />
                  <Text variant="meta">IN</Text>
                </View>
              </View>
              <NumberField
                label="Current Weight"
                value={weightLb}
                unit="LB"
                onChangeText={(v) => setWeightKg(lbToKg(Number(v) || 0).toFixed(2))}
              />
            </View>
          )}

          <View style={{ gap: 2 }}>
            <Text variant="meta">Timezone · Auto-Detected</Text>
            <Text variant="num" style={{ fontSize: 14 }}>{deviceTimezone}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.md }}>
          <View style={{ gap: gap.xs }}>
            <Text variant="meta">Typical Daily Activity</Text>
            <Text variant="meta" color={colors.muted}>
              This sets your initial calorie target. The app will automatically adjust this number as it learns from your actual data.
            </Text>
          </View>
          <ActivityPicker value={activityLevel} onChange={setActivityLevel} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Choose Your Goal</Text>
            <Segment<"cut" | "maintain" | "gain">
              options={[
                { value: "cut", label: "Cut" },
                { value: "maintain", label: "Hold" },
                { value: "gain", label: "Gain" },
              ]}
              value={goalType}
              onChange={setGoalType}
            />
          </View>

          {goalType !== "maintain" && (
            units === "metric" ? (
              <NumberField label="Weekly Target" value={rate} unit="KG/WK" onChangeText={setRate} />
            ) : (
              <NumberField
                label="Weekly Target"
                value={rateLbPerWk}
                unit="LB/WK"
                onChangeText={(v) => setRate(lbToKg(Number(v) || 0).toFixed(3))}
              />
            )
          )}
        </View>
      </Card>

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onCommit} disabled={committing}>
        {committing ? "Saving…" : "Save Profile & Start"}
      </Button>
    </Screen>
  );
}
