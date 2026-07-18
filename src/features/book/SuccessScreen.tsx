import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Button } from "../../ui/Button";
import { colors } from "../../ui/tokens";

/**
 * Post-submit confirmation. The request is saved; the artist replies from their
 * side. Honest about what happens next — no fake "confirmed" or price.
 */
export function SuccessScreen({
  artistName,
  onDone,
}: {
  artistName: string;
  onDone: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10">
        <Icon name="checkmark" size={40} color={colors.gold[300]} />
      </View>

      <Text variant="displayBold" className="text-center text-3xl">
        Request sent
      </Text>
      <Text variant="body" className="mt-3 max-w-[300px] text-center text-bone-300">
        Your enquiry is on its way to {artistName}. You&rsquo;ll hear back once
        they&rsquo;ve had a look — track it any time in Bookings.
      </Text>

      <View className="mt-8 w-full max-w-[320px] gap-3">
        <View className="flex-row items-start gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
          <Icon name="time-outline" size={18} color={colors.bone[500]} />
          <Text variant="body" className="flex-1 text-[13px] leading-[19px] text-bone-300">
            Most artists reply within a couple of days. Nothing is booked or charged
            until they confirm.
          </Text>
        </View>
      </View>

      <View className="mt-8 w-full max-w-[320px]">
        <Button label="Done" variant="primary" onPress={onDone} />
      </View>
    </View>
  );
}
