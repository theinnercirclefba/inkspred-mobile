import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { colors } from "./tokens";
import { useAuth } from "../lib/auth";
import { isGoogleConfigured } from "../lib/socialAuth";

/**
 * The social sign-in block shared by login / signup / join. Renders "Continue
 * with Apple" (native Apple button, HIG styling) first, then "Continue with
 * Google" once that provider is enabled, and finally a quiet "or use email"
 * divider above whatever email form the host screen shows.
 *
 * On success we route to the entry gate ("/"), which resolves the profile: a
 * returning social user lands in their role's tabs; a brand-new one is sent to
 * /complete to choose how they'll use InkSpred (social auth can't carry a role).
 */
export interface SocialAuthBlockProps {
  /** Divider text under the social buttons. Defaults to "or use email". */
  dividerLabel?: string;
  className?: string;
}

const APPLE_BUTTON_HEIGHT = 50;

export function SocialAuthBlock({ dividerLabel = "or use email", className }: SocialAuthBlockProps) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<null | "apple" | "google">(null);
  const [error, setError] = useState<string | null>(null);

  const appleAvailable = Platform.OS === "ios";
  const showGoogle = isGoogleConfigured;

  async function handleApple() {
    if (busy) return;
    setError(null);
    setBusy("apple");
    const result = await signInWithApple();
    setBusy(null);
    if (result.ok) {
      router.replace("/");
      return;
    }
    if (result.cancelled) return; // user backed out — stay put, no error
    setError(result.error ?? "We couldn't sign you in with Apple.");
  }

  async function handleGoogle() {
    if (busy) return;
    setError(null);
    setBusy("google");
    const result = await signInWithGoogle();
    setBusy(null);
    if (result.ok) {
      router.replace("/");
      return;
    }
    if (result.cancelled) return;
    setError(result.error ?? "We couldn't sign you in with Google.");
  }

  // Nothing to show (e.g. Android with Google still gated) — render just the
  // divider so the email form still reads as the way in.
  const hasAnyProvider = appleAvailable || showGoogle;

  return (
    <View className={className}>
      {hasAnyProvider ? (
        <View className="gap-3">
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={{ width: "100%", height: APPLE_BUTTON_HEIGHT, opacity: busy ? 0.6 : 1 }}
              onPress={handleApple}
            />
          ) : null}

          {showGoogle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy != null, busy: busy === "google" }}
              disabled={busy != null}
              onPress={handleGoogle}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
              className={`h-[50px] w-full flex-row items-center justify-center gap-2.5 rounded-xl border border-ink-600 bg-bone-100 ${
                busy != null ? "opacity-60" : ""
              }`}
            >
              <Icon name="logo-google" size={18} color={colors.ink[900]} />
              <Text variant="bodySemibold" className="text-[15px] text-ink-950">
                Continue with Google
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View className="mt-4 rounded-xl border border-negative/50 bg-negative/10 px-4 py-3">
          <Text variant="body" className="text-negative">
            {error}
          </Text>
        </View>
      ) : null}

      <View className="my-6 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-ink-700" />
        <Text variant="caption" className="uppercase tracking-[1.5px] text-bone-500">
          {dividerLabel}
        </Text>
        <View className="h-px flex-1 bg-ink-700" />
      </View>
    </View>
  );
}
