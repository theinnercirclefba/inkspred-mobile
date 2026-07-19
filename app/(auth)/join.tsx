import { Pressable, View } from "react-native";
import { Link, router } from "expo-router";
import { Screen } from "../../src/ui/Screen";
import { Text } from "../../src/ui/Text";
import { Icon, type IconName } from "../../src/ui/Icon";
import { Wordmark } from "../../src/ui/Wordmark";
import { SocialAuthBlock } from "../../src/ui/SocialAuthBlock";
import { colors } from "../../src/ui/tokens";
import type { AccountType } from "../../src/lib/auth";

interface RoleCard {
  type: AccountType;
  icon: IconName;
  title: string;
  body: string;
}

/**
 * The three account types, mirroring the web sign-up. Picking one carries the
 * choice through to the credentials form (which writes the matching
 * public.users.role after the Supabase sign-up).
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

export default function Join() {
  function choose(type: AccountType) {
    router.push({ pathname: "/(auth)/signup", params: { role: type } });
  }

  return (
    <Screen scroll>
      <View className="grow justify-center py-10">
        <Wordmark size={34} className="mb-8" />

        <Text variant="display" className="mb-1">
          Create your account
        </Text>
        <Text variant="body" className="mb-8 text-bone-500">
          One account, whichever side of the chair you sit on. Choose how you'll
          use InkSpred.
        </Text>

        <SocialAuthBlock dividerLabel="or use email" />

        <View className="gap-3">
          {ROLES.map((role) => (
            <Pressable
              key={role.type}
              accessibilityRole="button"
              onPress={() => choose(role.type)}
              className="flex-row items-start gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-4 active:border-gold-400/60 active:bg-ink-800"
            >
              <View className="h-11 w-11 items-center justify-center rounded-xl border border-ink-700 bg-ink-800">
                <Icon name={role.icon} size={20} color={colors.gold[400]} />
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
          ))}
        </View>

        <View className="mt-8 flex-row justify-center gap-1.5">
          <Text variant="body" className="text-bone-500">
            Already have an account?
          </Text>
          <Link href="/(auth)/login">
            <Text variant="bodySemibold" className="text-gold-300">
              Sign in
            </Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
