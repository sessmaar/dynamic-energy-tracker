import { View } from "react-native";
import { colors, radius } from "./tokens";
import { Text } from "./Text";

/**
 * Single-row stacked bar showing macro split as a fraction of total
 * energy. Navigator Light edition — rounded track, blue protein slice.
 */
export interface MacroBarProps {
  proteinG: number | null;
  carbsG:   number | null;
  fatG:     number | null;
  totalKcal: number;
  height?: number;
  hideLabels?: boolean;
}

const P_COLOR = colors.accent;
const C_COLOR = colors.secondaryContainer;
const F_COLOR = colors.secondary;

export const MacroBar = ({
  proteinG, carbsG, fatG, totalKcal, height = 6, hideLabels,
}: MacroBarProps) => {
  const pKcal = (proteinG ?? 0) * 4;
  const cKcal = (carbsG   ?? 0) * 4;
  const fKcal = (fatG     ?? 0) * 9;
  const knownKcal = pKcal + cKcal + fKcal;

  const denom = Math.max(totalKcal, knownKcal, 1);
  const pPct = (pKcal / denom) * 100;
  const cPct = (cKcal / denom) * 100;
  const fPct = (fKcal / denom) * 100;
  const unknownPct = Math.max(0, 100 - pPct - cPct - fPct);

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          height,
          backgroundColor: colors.fgSoft,
          borderRadius: radius.pill,
          overflow: "hidden",
        }}
      >
        {pPct > 0 && <View style={{ width: `${pPct}%`, backgroundColor: P_COLOR }} />}
        {cPct > 0 && <View style={{ width: `${cPct}%`, backgroundColor: C_COLOR }} />}
        {fPct > 0 && <View style={{ width: `${fPct}%`, backgroundColor: F_COLOR }} />}
        {unknownPct > 0 && <View style={{ width: `${unknownPct}%`, backgroundColor: colors.fgSoft }} />}
      </View>
      {!hideLabels && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Legend dot={P_COLOR} label={`P ${formatG(proteinG)}`} />
          <Legend dot={C_COLOR} label={`C ${formatG(carbsG)}`} />
          <Legend dot={F_COLOR} label={`F ${formatG(fatG)}`} />
        </View>
      )}
    </View>
  );
};

const formatG = (n: number | null): string =>
  n == null ? "—" : `${Math.round(n)}g`;

const Legend = ({ dot, label }: { dot: string; label: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
    <View style={{ width: 6, height: 6, backgroundColor: dot, borderRadius: 3 }} />
    <Text variant="meta">{label}</Text>
  </View>
);
