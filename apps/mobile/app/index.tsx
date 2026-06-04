import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { Button, colors, gap, Screen, Text } from "@/design";
import { useEngine } from "@/store/engineStore";
import { repos } from "@/lib/supabase";
import { isoDate } from "@dynamic-energy/engine";

/**
 * Root route. Four states:
 *   1. Auth still hydrating from secure storage → spinner.
 *   2. No session → /sign-in.
 *   3. Signed in, store hydrate failed → error card with retry / sign-out.
 *   4. Signed in, hydrated → /onboarding (no profile or no weights) or /command.
 */
export default function Index() {
  const { session, userId, signOut } = useAuth();
  const router = useRouter();
  const hydrate = useEngine((s) => s.hydrate);
  const loading = useEngine((s) => s.loading);
  const error = useEngine((s) => s.error);
  const storedUserId = useEngine((s) => s.userId);
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (userId && userId !== storedUserId) void hydrate(userId);
  }, [userId, storedUserId, hydrate]);

  useEffect(() => {
    if (session === undefined) return;            // still hydrating
    if (session === null) { router.replace("/sign-in"); return; }
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const since = isoDate("1970-01-01");
        const [account, weights] = await Promise.all([
          repos.profile.getAccount(userId),
          repos.weight.listSince(userId, since),
        ]);
        if (cancelled) return;
        const onboarded = !!account && weights.length > 0;
        router.replace(onboarded ? "/command" : "/onboarding");
        setDecided(true);
      } catch {
        if (!cancelled) { router.replace("/onboarding"); setDecided(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [session, userId, router]);

  if (session === undefined) {
    return <Splash label="Restoring session…" />;
  }
  if (!session) return <Splash label="Redirecting…" />;

  if (error) {
    return (
      <Screen eyebrow="System · Fault" title="SYNC FAILURE">
        <Text variant="body" color={colors.muted}>
          The backend rejected the initial data synchronization. The most likely
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
        <Button onPress={() => userId && hydrate(userId)}>Retry Sync</Button>
        <Button
          onPress={async () => { await signOut(); }}
          variant="secondary"
        >
          Sign Out
        </Button>
      </Screen>
    );
  }

  if (loading || storedUserId !== userId || !decided) {
    return <Splash label="Syncing your data…" />;
  }
  return null;
}

const Splash = ({ label }: { label: string }) => (
  <Screen>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="meta" style={{ marginTop: 16 }}>{label}</Text>
    </View>
  </Screen>
);
