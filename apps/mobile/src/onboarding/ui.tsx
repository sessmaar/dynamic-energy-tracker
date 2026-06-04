import { type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "@/design";
import { haptic } from "@/lib/haptics";

export const StepHeader = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => {
  const t = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: 24 }}>
      <Text style={{ color: t.accent, fontSize: 12, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" }}>{eyebrow}</Text>
      <Text style={{ color: t.fg, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }}>{title}</Text>
      {subtitle ? <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}>{subtitle}</Text> : null}
    </View>
  );
};

export const Field = ({ label, value, onChangeText, unit, keyboardType = "decimal-pad" }: {
  label: string; value: string; onChangeText: (v: string) => void; unit?: string;
  keyboardType?: "decimal-pad" | "number-pad" | "default";
}) => {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: 6 }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor={t.muted}
          style={{ flex: 1, color: t.fg, fontSize: 28, fontWeight: "700", padding: 0 }}
        />
        {unit ? <Text style={{ color: t.muted, fontSize: 14, fontWeight: "600" }}>{unit}</Text> : null}
      </View>
    </View>
  );
};

export function Segment<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.surfaceAlt, borderRadius: 12, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { haptic.light(); onChange(o.value); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center", backgroundColor: active ? t.surface : "transparent" }}
          >
            <Text style={{ color: active ? t.fg : t.muted, fontSize: 14, fontWeight: active ? "700" : "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SelectableRow({ title, detail, trailing, selected, onPress }: {
  title: string; detail?: string; trailing?: string; selected: boolean; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: 16, borderRadius: 14, borderWidth: 1.5,
        borderColor: selected ? t.accent : t.border,
        backgroundColor: selected ? t.accentSoft : t.surface,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: selected ? t.accent : t.fg, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {detail ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{detail}</Text> : null}
      </View>
      {trailing ? <Text style={{ color: selected ? t.accent : t.muted, fontSize: 13, fontWeight: "600" }}>{trailing}</Text> : null}
    </Pressable>
  );
}

export const PrimaryButton = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { if (!disabled) { haptic.light(); onPress(); } }}
      style={{ backgroundColor: t.accent, opacity: disabled ? 0.4 : 1, borderRadius: 999, paddingVertical: 16, alignItems: "center" }}
    >
      <Text style={{ color: t.onAccent, fontSize: 16, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
};

export const GhostButton = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const t = useTheme();
  return (
    <Pressable onPress={() => { haptic.light(); onPress(); }} style={{ paddingVertical: 16, alignItems: "center" }}>
      <Text style={{ color: t.muted, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
};

export const ProgressBar = ({ step, total }: { step: number; total: number }) => {
  const t = useTheme();
  return (
    <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
      <View style={{ height: 4, width: `${Math.round((step / total) * 100)}%`, backgroundColor: t.accent, borderRadius: 999 }} />
    </View>
  );
};

export const Stack = ({ children, gap = 16 }: { children: ReactNode; gap?: number }) => (
  <View style={{ gap }}>{children}</View>
);
