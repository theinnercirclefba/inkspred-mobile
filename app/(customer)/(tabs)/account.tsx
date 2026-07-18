import { View } from "react-native";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { AccountPanel } from "../../../src/features/account/AccountPanel";

export default function Account() {
  return (
    <Screen scroll>
      <View className="mb-6">
        <Text variant="displayBold" className="text-3xl">
          Account
        </Text>
        <Text variant="body" className="mt-1 text-bone-500">
          Manage your InkSpred profile and preferences.
        </Text>
      </View>
      <AccountPanel />
    </Screen>
  );
}
