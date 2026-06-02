import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button, Card, Screen, Text, colors, fonts, fontSize, gap, hairline } from "@/design";
import { supabase } from "@/lib/supabase";

type Phase = "email" | "code" | "verifying";

const Field = ({
  label, value, onChange, keyboardType, autoCapitalize, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  keyboardType?: "email-address" | "number-pad";
  autoCapitalize?: "none" | "characters";
  autoFocus?: boolean;
}) => (
  <View style={{ gap: gap.sm }}>
    <Text variant="meta">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      autoCapitalize={autoCapitalize ?? "none"}
      autoCorrect={false}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      placeholderTextColor={colors.muted}
      style={{
        fontFamily: fonts.mono,
        fontSize: fontSize.bignum,
        fontWeight: "800",
        color: colors.fg,
        borderBottomWidth: hairline.width,
        borderBottomColor: hairline.color,
        paddingVertical: gap.xs,
        letterSpacing: keyboardType === "number-pad" ? 6 : 0,
      }}
    />
  </View>
);

export default function SignIn() {
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Invalid uplink address.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) setError(error.message);
    else setPhase("code");
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Six-digit code expected.");
      return;
    }
    setPhase("verifying");
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setError(error.message);
      setPhase("code");
    }
    // On success, AuthProvider picks up the new session and the root
    // _layout's gate redirects to /command or /onboarding.
  };

  return (
    <Screen eyebrow="System · Identity Handshake" title="UPLINK">
      <Text variant="body" color={colors.muted}>
        Authentication via single-use code. The engine pulls your logs from the
        encrypted backend after handshake completes.
      </Text>

      <Card>
        <View style={{ gap: gap.lg }}>
          {phase === "email" || phase === "verifying" ? (
            <Field
              label="Operator · Email"
              value={email}
              onChange={setEmail}
              keyboardType="email-address"
              autoFocus
            />
          ) : (
            <>
              <View style={{ gap: gap.xs }}>
                <Text variant="meta">Email Dispatched</Text>
                <Text variant="num" style={{ fontSize: 16 }}>{email}</Text>
              </View>
              <Field
                label="6-Digit Code"
                value={code}
                onChange={(s) => setCode(s.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoFocus
              />
            </>
          )}

          {error && (
            <Text variant="meta" color={colors.accent}>{error}</Text>
          )}
        </View>
      </Card>

      {phase === "email" && (
        <Button onPress={sendCode}>Transmit Code</Button>
      )}
      {phase === "code" && (
        <>
          <Button onPress={verifyCode}>Verify Handshake</Button>
          <Button onPress={() => { setPhase("email"); setCode(""); }} variant="secondary">
            Re-dispatch
          </Button>
        </>
      )}
      {phase === "verifying" && (
        <Text variant="meta" color={colors.accent}>Verifying…</Text>
      )}
    </Screen>
  );
}
