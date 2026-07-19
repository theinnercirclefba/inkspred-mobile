import { useState } from "react";
import { Pressable, View, ActivityIndicator } from "react-native";
import { Redirect, router } from "expo-router";
import { Screen } from "../../src/ui/Screen";
import { Text } from "../../src/ui/Text";
import { Icon, type IconName } from "../../src/ui/Icon";
import { Wordmark } from "../../src/ui/Wordmark";
import { colors } from "../../src/ui/tokens";
import { useAuth, type AccountType } from "../../src/lib/auth";

interface RoleCard {
  type: AccountType;
  icon: IconName;
  title: string;
  body: string;
}

/**
 * Role completion after a social (Apple/Google) sign-in. The OAuth identity has
 * no account type attached, so a first-time social user lands here to choose
 * how they'll use InkSpred. Picking a card self-inserts their public.users row
 * (name/email pulled from the session), then routes to their role's tabs.
 *
 * Visuals mirror the join screen so the three choices feel identical wherever
 * they surface.
 */
const ROLES: RoleCard[] = [
  {
    type: "customer",
    icon: "search",
    title: "I want to get tattooed",
    body: "Discover artists, follow their work and book with confidence.",
  },
  {
    type: "artist",
    icon: "brush",
    title: "I'm a tattoo artist",
    body: "Run your books, requests and takings from your pocket.",
  },
  {
    type: "studio",
    icon: "business",
    title: "I run a studio",
    body: "Manage your shop, your artists and every chair in one place.",
  },
];

export default function CompleteProfile() {
  const { session, profile, completeProfile, signOut } = useAuth();
  const [pending, setPending] = useState<AccountType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No session — nothing to complete. Back to the start.
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }
  // Already has a profile (e.g. arrived here by accident) — let the gate route.
  if (profile) {
    return <Redirect href="/" />;
  }

  async function choose(type: AccountType) {
    if (pending) return;
    setError(null);
    setPending(type);
    const result = await completeProfile(type);
    setPending(null);
    if (!result.ok) {
      setError(result.error ?? "We couldn't finish setting up your account.");
      return;
    }
    router.replace("/");
  }

  return (
    <Screen scroll>
      <View className="grow justify-center py-10">
        <Wordmark size={34} className="mb-8" />

        <Text variant="display" className="mb-1">
          How will you use InkSpred?
        </Text>
        <Text variant="body" className="mb-8 text-bone-500">
          You're signed in — one last step. Choose how you'll use InkSpred and
          we'll set you up.
        </Text>

        <View className="gap-3">
          {ROLES.map((role) => {
            const loading = pending === role.type;
            const disabled = pending != null && !loading;
            return (
              <Pressable
                key={role.type}
                accessibilityRole="button"
                accessibilityState={{ disabled, busy: loading }}
                disabled={pending != null}
                onPress={() => choose(role.type)}
                className={`flex-row items-start gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-4 active:border-gold-400/60 active:bg-ink-800 ${
                  disabled ? "opacity-50" : ""
                }`}
              >
                <View className="h-11 w-11 items-center justify-center rounded-xl border border-ink-700 bg-ink-800">
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.gold[400]} />
                  ) : (
                    <Icon name={role.icon} size={20} color={colors.gold[400]} />
                  )}
                </View>
                <View className="flex-1">
                  <Text variant="bodySemibold" className="mb-1">
                    {role.title}
                  </Text>
                  <Text variant="body" className="text-bone-500">
                    {role.body}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.bone[500]} />
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View className="mt-4 rounded-xl border border-negative/50 bg-negative/10 px-4 py-3">
            <Text variant="body" className="text-negative">
              {error}
            </Text>
          </View>
        ) : null}

        <View className="mt-8 flex-row justify-center gap-1.5">
          <Text variant="body" className="text-bone-500">
            Not you?
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            disabled={pending != null}
            onPress={() => {
              void signOut();
            }}
          >
            <Text variant="bodySemibold" className="text-gold-300">
              Sign out
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
