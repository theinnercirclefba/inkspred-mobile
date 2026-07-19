import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { colors } from "../../../src/ui/tokens";

/**
 * Enquiries — an honest state. Real booking threads are addressed to individual
 * roster artists, and RLS scopes each thread to its artist and customer, so a
 * studio-level inbox can't read them yet (the same limitation the web app is
 * candid about). Rather than fake a feed, we explain where enquiries land today
 * and flag the studio inbox as coming.
 */
export default function Enquiries() {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6">
          <Text variant="body" className="text-bone-500">
            Your studio
          </Text>
          <Text variant="displayBold" className="mt-1 text-3xl">
            Enquiries
          </Text>
        </View>

        <View className="items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-12">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
            <Icon name="mail-outline" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Enquiries land with each artist
          </Text>
          <Text variant="body" className="max-w-[300px] text-center text-bone-500">
            Every booking request goes straight to the artist it's addressed to,
            in their own inbox. A studio-level inbox that gathers them in one
            place is coming.
          </Text>
        </View>

        <View className="mt-4 flex-row items-start gap-2.5 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
          <Icon name="lock-closed-outline" size={16} color={colors.bone[500]} />
          <Text variant="caption" className="flex-1 leading-[17px] text-bone-500">
            Each conversation stays private between the artist and their client
            until the studio inbox ships.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
