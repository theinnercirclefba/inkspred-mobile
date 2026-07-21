import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { colors } from "../../../src/ui/tokens";
import { AccountPanel } from "../../../src/features/account/AccountPanel";
import { PRIVACY_URL, TERMS_URL, openExternal } from "../../../src/lib/links";

/**
 * Studio settings — deliberately duplicate-free. Studio details are edited on
 * the Shop tab, so this screen just points there; the account identity + sign
 * out come from the shared AccountPanel, and the legal pages / account deletion
 * open the website (the source of truth for those flows).
 */
export default function Settings() {
  const router = useRouter();

  return (
    <Screen scroll>
      <View className="mb-6">
        <Text variant="body" className="text-bone-500">
          Your studio
        </Text>
        <Text variant="displayBold" className="mt-1 text-3xl">
          Settings
        </Text>
      </View>

      {/* Studio details → Shop (no duplication) */}
      <Text variant="label" className="mb-3 text-bone-500">
        Studio
      </Text>
      <View className="mb-6 rounded-2xl border border-ink-700 bg-ink-900">
        <LinkRow
          icon="storefront-outline"
          label="Studio details"
          hint="Name, location and public page"
          first
          onPress={() => router.push("/(studio)/(tabs)/shop")}
        />
        <LinkRow
          icon="people-outline"
          label="Artists & roster"
          hint="Add or remove artists"
          last
          onPress={() => router.push("/(studio)/(tabs)/artists")}
        />
      </View>

      {/* Account identity + sign out (shared) */}
      <Text variant="label" className="mb-3 text-bone-500">
        Account
      </Text>
      <AccountPanel />

      {/* Legal + account management (web) */}
      <Text variant="label" className="mb-3 mt-8 text-bone-500">
        Legal
      </Text>
      <View className="rounded-2xl border border-ink-700 bg-ink-900">
        <LinkRow
          icon="shield-checkmark-outline"
          label="Privacy policy"
          external
          first
          onPress={() => openExternal(PRIVACY_URL)}
        />
        <LinkRow
          icon="document-text-outline"
          label="Terms of service"
          external
          last
          onPress={() => openExternal(TERMS_URL)}
        />
      </View>
    </Screen>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  external,
  first,
  last,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  external?: boolean;
  first?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={external ? "link" : "button"}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-80 ${
        first ? "" : "border-t border-ink-700"
      }`}
    >
      <Icon name={icon} size={18} color={colors.bone[300]} />
      <View className="flex-1">
        <Text variant="body" className="text-bone-100">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" className="mt-0.5">
            {hint}
          </Text>
        ) : null}
      </View>
      <Icon
        name={external ? "open-outline" : "chevron-forward"}
        size={16}
        color={colors.bone[500]}
      />
    </Pressable>
  );
}
