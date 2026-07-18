import { View } from "react-native";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { colors } from "../../../src/ui/tokens";
import { AccountPanel } from "../../../src/features/account/AccountPanel";
import { useAuth } from "../../../src/lib/auth";

export default function Today() {
  const { profile } = useAuth();
  const firstName = profile?.fullName?.trim().split(/\s+/)[0];

  return (
    <Screen scroll>
      <View className="mb-6">
        <Text variant="body" className="text-bone-500">
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </Text>
        <Text variant="displayBold" className="mt-1 text-3xl">
          Today
        </Text>
      </View>

      <View className="mb-8 items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
          <Icon name="sunny-outline" size={24} color={colors.gold[400]} />
        </View>
        <Text variant="display" className="mb-2 text-center text-xl">
          Nothing on today
        </Text>
        <Text variant="body" className="max-w-[280px] text-center text-bone-500">
          Your day at a glance — next appointment, deposits due and gaps to fill
          — appears here each morning once your books are live.
        </Text>
      </View>

      <Text variant="label" className="mb-3 text-bone-500">
        Account
      </Text>
      <AccountPanel />
    </Screen>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
