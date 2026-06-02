import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/context/auth";
import { Button, colors, gap, Screen, Text } from "@/design";
import { useEngine } from "@/store/engineStore";

/**
 * Root route. Four states:
 *   1. Auth still hydrating from secure storage → spinner.
 *   2. No session → /sign-in.
 *   3. Signed in, store hydrate failed → error card with retry / sign-out.
 *   4. Signed in, hydrated → /onboarding (no profile) or /command.
 */
export default function Index() {
  const { session, userId, signOut } = useAuth();
  const hydrate = useEngine((s) => s.hydrate);
  const loading = useEngine((s) => s.loading);
  const profile = useEngine((s) => s.profile);
  const error = useEngine((s) => s.error);
  const storedUserId = useEngine((s) => s.userId);

  useEffect(() => {
    if (userId && userId !== storedUserId) void hydrate(userId);
  }, [userId, storedUserId, hydrate]);

  if (session === undefined) {
    return <Splash label="Restoring session…" />;
  }
  if (!session) return <Redirect href="/sign-in" />;

  if (error) {
    return (
      <Screen eyebrow="System · Fault" title="TELEMETRY FAULT">
        <Text variant="body" color={colors.muted}>
          The backend rejected the initial telemetry pull. The most likely
          causes are: Supabase project unreachable, RLS misconfigured, or
          migrations not applied.
        </Text>
        <View style={{
          padding: gap.md,
          borderWidth: 0.5, borderColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <Text variant="meta">Engine Reported</Text>
          <Text variant="num" style={{ marginTop: 4, fontSize: 13 }}>{error}</Text>
        </View>
        <Button onPress={() => userId && hydrate(userId)}>Retry Handshake</Button>
        <Button
          onPress={async () => { await signOut(); }}
          variant="secondary"
        >
          Sign Out
        </Button>
      </Screen>
    );
  }

  if (loading || storedUserId !== userId) {
    return <Splash label="Pulling telemetry…" />;
  }
  return <Redirect href={profile ? "/command" : "/onboarding"} />;
}

const Splash = ({ label }: { label: string }) => (
  <Screen>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="meta" style={{ marginTop: 16 }}>{label}</Text>
    </View>
  </Screen>
);
