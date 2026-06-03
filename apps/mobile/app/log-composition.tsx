import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  type Composition,
  cm, cmToInches, inchesToCm, kgToLb, latestTrendWeight, resolveComposition, unit,
} from "@dynamic-energy/engine";
import {
  Button, Card, Screen, Text,
  colors, fonts, fontSize, gap, hairline, radius,
} from "@/design";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";

type UnitSystem = "metric" | "imperial";

const Field = ({
  label, value, unit: u, onChangeText, placeholder,
}: { label: string; value: string; unit: string; onChangeText: (v: string) => void; placeholder?: string }) => (
  <View style={{ gap: gap.sm, flex: 1 }}>
    <Text variant="meta">{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: gap.sm }}>
      <TextInput
        value={value}
        onChangeText={(s) => onChangeText(s.replace(/[^\d.]/g, ""))}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          fontFamily: fonts.mono, fontSize: 28, fontWeight: "800",
          color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
          paddingVertical: gap.xs, flex: 1,
        }}
      />
      <Text variant="meta">{u}</Text>
    </View>
  </View>
);

const Segment = ({
  options, value, onChange,
}: { options: readonly { value: UnitSystem; label: string }[]; value: UnitSystem; onChange: (v: UnitSystem) => void }) => (
  <View style={{ flexDirection: "row", borderWidth: hairline.width, borderColor: hairline.color, borderRadius: radius.sharp }}>
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
 * Body-composition logger. Captures tape circumferences (and/or a direct
 * body-fat reading from a DEXA scan or smart scale) plus an optional
 * progress photo.
 *
 * The displayed body-fat % uses the U.S. Navy circumference equation —
 * the only tape-based method with published validation. A direct reading,
 * when entered, overrides the estimate. Photos are stored for qualitative
 * progress only; no calculation reads them.
 */
export default function LogComposition() {
  const router = useRouter();
  const profile = useEngine((s) => s.profile);
  const weights = useEngine((s) => s.weights);
  const logComposition = useEngine((s) => s.logComposition);
  const addProgressPhoto = useEngine((s) => s.addProgressPhoto);

  const isFemale = profile?.sex === "female";
  const trend = latestTrendWeight(weights);

  const [units, setUnits] = useState<UnitSystem>("metric");
  // Stored internally in cm regardless of the chosen unit.
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [directBf, setDirectBf] = useState(""); // percent, as the user types it
  const [photoBusy, setPhotoBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Imperial display is derived from the metric source on every render.
  const toDisplay = (cmStr: string) => (cmStr === "" ? "" : (units === "metric" ? cmStr : cmToInches(Number(cmStr)).toFixed(1)));
  const fromDisplay = (v: string): string => (v === "" ? "" : (units === "metric" ? v : inchesToCm(Number(v)).toFixed(1)));
  const lenUnit = units === "metric" ? "CM" : "IN";

  // Live preview — wrapped because partial/invalid input makes the Navy
  // equation throw (e.g. waist ≤ neck).
  const preview: Composition | null = (() => {
    if (!profile || !trend) return null;
    try {
      return resolveComposition({
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: trend,
        neckCm: neck ? cm(Number(neck)) : undefined,
        waistCm: waist ? cm(Number(waist)) : undefined,
        hipCm: hip ? cm(Number(hip)) : undefined,
        directBodyFatPct: directBf ? unit(Math.min(Math.max(Number(directBf) / 100, 0), 1)) : undefined,
      });
    } catch {
      return null;
    }
  })();

  const hasAnyInput = neck !== "" || waist !== "" || hip !== "" || directBf !== "";

  const onPickPhoto = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library permission denied."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    setPhotoBusy(true);
    try {
      const asset = res.assets[0];
      const resp = await fetch(asset.uri);
      const body = await resp.blob();
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      await addProgressPhoto({ body, ext, contentType: body.type || "image/jpeg" });
      haptic.success();
      setStatus("Progress photo uploaded.");
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const onCommit = async () => {
    if (!hasAnyInput) { setError("Enter at least one measurement."); return; }
    setError(null);
    setCommitting(true);
    try {
      await logComposition({
        neckCm: neck ? Number(neck) : null,
        waistCm: waist ? Number(waist) : null,
        hipCm: hip ? Number(hip) : null,
        bodyFatPct: directBf ? Math.min(Math.max(Number(directBf) / 100, 0), 1) : null,
      });
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  return (
    <Screen eyebrow="Logger · Composition" title="COMPOSITION">
      <Text variant="body" color={colors.muted}>
        Tape measurements feed the U.S. Navy body-fat estimate. A direct reading from a DEXA
        scan or smart scale overrides it. Lean mass updates the resting-energy model.
      </Text>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Units</Text>
            <Segment
              options={[{ value: "metric", label: "Metric · cm" }, { value: "imperial", label: "Imperial · in" }]}
              value={units}
              onChange={setUnits}
            />
          </View>

          <View style={{ flexDirection: "row", gap: gap.md }}>
            <Field label="Neck" value={toDisplay(neck)} unit={lenUnit} onChangeText={(v) => setNeck(fromDisplay(v))} />
            <Field label="Waist" value={toDisplay(waist)} unit={lenUnit} onChangeText={(v) => setWaist(fromDisplay(v))} />
          </View>

          {isFemale && (
            <Field label="Hip · required for female estimate" value={toDisplay(hip)} unit={lenUnit} onChangeText={(v) => setHip(fromDisplay(v))} />
          )}

          <Field label="Direct Body Fat · optional" value={directBf} unit="%" onChangeText={setDirectBf} placeholder="e.g. 18.5" />
        </View>
      </Card>

      {/* Live estimate */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: gap.xs }}>
            <Text variant="meta">Estimated Body Fat</Text>
            <Text variant="num" style={{ fontSize: 28, fontWeight: "800" as const }} color={preview ? colors.accent : colors.muted}>
              {preview ? `${(preview.bodyFatPct * 100).toFixed(1)}%` : "—"}
            </Text>
          </View>
          <View style={{ gap: gap.xs, alignItems: "flex-end" }}>
            <Text variant="meta">Lean Mass</Text>
            <Text variant="num" style={{ fontSize: 28, fontWeight: "800" as const }}>
              {preview ? (units === "metric" ? `${preview.leanMassKg.toFixed(1)}` : `${kgToLb(preview.leanMassKg).toFixed(1)}`) : "—"}
              {" "}<Text variant="meta">{units === "metric" ? "KG" : "LB"}</Text>
            </Text>
          </View>
        </View>
        {!trend && (
          <Text variant="meta" color={colors.muted} style={{ marginTop: gap.sm }}>
            Log a weight first — lean mass is computed against your trend weight.
          </Text>
        )}
      </Card>

      <Pressable
        onPress={onPickPhoto}
        disabled={photoBusy}
        style={({ pressed }) => ({
          borderWidth: hairline.width, borderColor: colors.border, padding: gap.md,
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          borderRadius: radius.sharp, backgroundColor: pressed ? colors.accentSoft : "transparent",
        })}
      >
        <Text variant="meta">{photoBusy ? "Uploading…" : "Capture Progress Photo →"}</Text>
        <Text variant="meta" color={colors.accent}>PHOTO</Text>
      </Pressable>

      {status && <Text variant="meta" color={colors.accent}>{status}</Text>}
      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onCommit} disabled={committing || !hasAnyInput}>
        {committing ? "Logging…" : "Commit Assessment"}
      </Button>
      <Button onPress={() => router.back()} variant="secondary">Cancel</Button>
      <Text variant="body" color={colors.muted} style={{ fontSize: fontSize.small }}>
        Photos are stored for your own visual reference only — there is no scientifically
        validated way to estimate body fat from an image, so they never affect the numbers.
      </Text>
    </Screen>
  );
}
