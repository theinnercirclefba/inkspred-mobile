import { View } from "react-native";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { AccountPanel } from "../../../src/features/account/AccountPanel";

export default function Settings() {
  return (
    <Screen scroll>
      <View className="mb-6">
        <Text variant="displayBold" className="text-3xl">
          Settings
        </Text>
        <Text variant="body" className="mt-1 text-bone-500">
          Billing, payout account and spread-the-cost terms for the whole studio
          are configured here — coming next.
        </Text>
      </View>
      <AccountPanel />
    </Screen>
  );
}
