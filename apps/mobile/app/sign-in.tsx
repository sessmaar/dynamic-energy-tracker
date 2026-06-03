import { useState } from "react";
import { TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Button, Card, Screen, Text, colors, fonts, fontSize, gap, hairline } from "@/design";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type Phase = "select" | "email_otp" | "otp_code" | "password" | "verifying";

const Field = ({
  label, value, onChange, keyboardType, autoCapitalize, autoFocus, secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  keyboardType?: "email-address" | "number-pad" | "default";
  autoCapitalize?: "none" | "characters";
  autoFocus?: boolean;
  secureTextEntry?: boolean;
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
      secureTextEntry={secureTextEntry}
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
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("select");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    setPhase("verifying");
    try {
      const redirectUrl = Linking.createURL("/command");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No authorization URL returned.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === "success") {
        const { url } = result;
        const parsed = Linking.parse(url);
        let accessToken = parsed.queryParams?.access_token as string | undefined;
        let refreshToken = parsed.queryParams?.refresh_token as string | undefined;

        if (!accessToken || !refreshToken) {
          const hash = url.split("#")[1];
          if (hash) {
            const parts = hash.split("&");
            for (const p of parts) {
              const [k, v] = p.split("=");
              if (k === "access_token") accessToken = v;
              if (k === "refresh_token") refreshToken = v;
            }
          }
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          router.replace("/");
        } else {
          throw new Error("Session parameters missing from redirect URL.");
        }
      } else {
        setPhase("select");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("select");
    }
  };

  const sendCode = async () => {
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Invalid email address.");
      return;
    }
    setPhase("verifying");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setError(error.message);
      setPhase("email_otp");
    } else {
      setPhase("otp_code");
    }
  };

  const loginWithPassword = async () => {
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Invalid email address.");
      return;
    }
    if (!password) {
      setError("Password required.");
      return;
    }
    setPhase("verifying");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setPhase("password");
    } else {
      router.replace("/");
    }
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
      setPhase("otp_code");
    } else {
      router.replace("/");
    }
  };

  return (
    <Screen eyebrow="Welcome Back" title="SIGN IN">
      <Text variant="body" color={colors.muted}>
        Securely sync your metabolic intelligence across all your devices.
      </Text>

      {phase === "select" && (
        <View style={{ gap: gap.md, marginTop: gap.md }}>
          <Button onPress={signInWithGoogle}>Continue with Google</Button>
          <Button onPress={() => { setError(null); setPhase("email_otp"); }} variant="secondary">
            Use Verification Code
          </Button>
          <Button onPress={() => { setError(null); setPhase("password"); }} variant="secondary">
            Use Email & Password
          </Button>
        </View>
      )}

      {(phase === "email_otp" || phase === "password" || phase === "otp_code") && (
        <Card>
          <View style={{ gap: gap.lg }}>
            {phase === "email_otp" && (
              <Field
                label="Email Address"
                value={email}
                onChange={setEmail}
                keyboardType="email-address"
                autoFocus
              />
            )}

            {phase === "password" && (
              <>
                <Field
                  label="Email Address"
                  value={email}
                  onChange={setEmail}
                  keyboardType="email-address"
                  autoFocus
                />
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  secureTextEntry
                />
              </>
            )}

            {phase === "otp_code" && (
              <>
                <View style={{ gap: gap.xs }}>
                  <Text variant="meta">Verification Email Sent</Text>
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
      )}

      {phase === "email_otp" && (
        <View style={{ gap: gap.sm, marginTop: gap.sm }}>
          <Button onPress={sendCode}>Send Verification Code</Button>
          <Button onPress={() => setPhase("select")} variant="secondary">Back to Options</Button>
        </View>
      )}

      {phase === "password" && (
        <View style={{ gap: gap.sm, marginTop: gap.sm }}>
          <Button onPress={loginWithPassword}>Sign In</Button>
          <Button onPress={() => setPhase("select")} variant="secondary">Back to Options</Button>
        </View>
      )}

      {phase === "otp_code" && (
        <View style={{ gap: gap.sm, marginTop: gap.sm }}>
          <Button onPress={verifyCode}>Verify Code</Button>
          <Button onPress={sendCode} variant="secondary">Resend Email</Button>
          <Button onPress={() => setPhase("select")} variant="secondary">Back to Options</Button>
        </View>
      )}

      {phase === "verifying" && (
        <View style={{ alignItems: "center", padding: gap.xl }}>
          <Text variant="meta" color={colors.accent}>Verifying…</Text>
        </View>
      )}
    </Screen>
  );
}
