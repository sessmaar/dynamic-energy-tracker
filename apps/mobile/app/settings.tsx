import { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Button, Card, Screen, Text, colors, gap, hairline } from "@/design";
import { useAuth } from "@/context/auth";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";

export default function Settings() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const profile = useEngine((s) => s.profile);
  const dob = useEngine((s) => s.dateOfBirth);
  const tz = useEngine((s) => s.timezone);
  const goal = useEngine((s) => s.goalKgPerWeek);
  const exportData = useEngine((s) => s.exportData);
  const deleteAccount = useEngine((s) => s.deleteAccount);
  const reset = useEngine((s) => s.reset);

  const [busy, setBusy] = useState<null | "export" | "delete" | "signout">(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setBusy("export");
    setError(null);
    try {
      const json = await exportData();
      const path = `${FileSystem.cacheDirectory}det-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: "Export Dynamic Energy Tracker data",
        });
      } else {
        Alert.alert("Saved", `Export written to ${path}`);
      }
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = async () => {
    setBusy("signout");
    try {
      await signOut();
      reset();
      router.replace("/sign-in");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = () => {
    Alert.alert(
      "Purge account",
      "This permanently deletes your profile, goals, weights, meals, and activity logs. " +
        "There is no undo.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purge",
          style: "destructive",
          onPress: async () => {
            setBusy("delete");
            setError(null);
            try {
              await deleteAccount();
              haptic.success();
              router.replace("/sign-in");
            } catch (e) {
              haptic.error();
              setError(e instanceof Error ? e.message : String(e));
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen eyebrow="System · Configuration" title="SETTINGS">
      <Card>
        <View style={{ gap: gap.md }}>
          <Text variant="meta">Operator</Text>
          <Field label="Email"          value={session?.user.email ?? "—"} />
          <Field label="Sex"            value={profile?.sex.toUpperCase() ?? "—"} />
          <Field label="Date of Birth"  value={dob ?? "—"} />
          <Field label="Timezone"       value={tz} />
          <Field label="Weekly Flux"    value={goal === 0 ? "Maintain" : `${goal > 0 ? "+" : ""}${goal} kg/wk`} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.md }}>
          <Text variant="meta">Mission</Text>
          <Button onPress={() => router.push("/edit-goal")} variant="secondary">
            Revise Weekly Goal
          </Button>
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.md }}>
          <Text variant="meta">Data Sovereignty</Text>
          <Text variant="body" color={colors.muted} style={{ fontSize: 13 }}>
            Your raw logs belong to you. Export a complete JSON snapshot any
            time; purge erases everything on the backend.
          </Text>
          <Button onPress={onExport} disabled={busy !== null} variant="secondary">
            {busy === "export" ? "Exporting…" : "Export Snapshot"}
          </Button>
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.md }}>
          <Text variant="meta">Session</Text>
          <Button onPress={onSignOut} disabled={busy !== null} variant="secondary">
            {busy === "signout" ? "Signing out…" : "Sign Out"}
          </Button>
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.md }}>
          <Text variant="meta" color={colors.accent}>Danger · Irreversible</Text>
          <Text variant="body" color={colors.muted} style={{ fontSize: 13 }}>
            Permanent account deletion. Cascades through every owned table.
          </Text>
          <Button onPress={onDelete} disabled={busy !== null}>
            {busy === "delete" ? "Purging…" : "Purge Account"}
          </Button>
        </View>
      </Card>

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}
      <Button onPress={() => router.back()} variant="secondary">← Return</Button>
    </Screen>
  );
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <View style={{
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: gap.sm, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
  }}>
    <Text variant="meta">{label}</Text>
    <Text variant="num" numberOfLines={1} style={{ flexShrink: 1, textAlign: "right", marginLeft: gap.md }}>
      {value}
    </Text>
  </View>
);
