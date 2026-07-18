import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { QuoteCard } from "./QuoteCard";
import type { QuoteView, ThreadMessage } from "./types";

/**
 * A single message row. Mine right-aligned in oxblood, theirs left in ink. A
 * message carrying a quote renders the rich read-only QuoteCard instead of a
 * plain bubble; attachments render as honest "photo — view on web" chips since
 * signing the private references bucket needs the service role (web-only phase).
 */
export function MessageBubble({
  message,
  quote,
}: {
  message: ThreadMessage;
  quote: QuoteView | null;
}) {
  const { mine } = message;
  const hasText = message.body.trim().length > 0;
  const attachments = message.attachmentPaths ?? [];

  // A quote message: render the card, full-width-ish, aligned to the sender.
  if (quote) {
    return (
      <View className={`w-full ${mine ? "items-end" : "items-start"}`}>
        <View className="w-[88%]">
          <QuoteCard quote={quote} />
          <Text
            variant="caption"
            className={`mt-1 text-bone-500 ${mine ? "text-right" : "text-left"}`}
          >
            {message.timeLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className={`w-full ${mine ? "items-end" : "items-start"}`}>
      <View className="max-w-[80%]">
        <View
          className={`rounded-2xl px-3.5 py-2.5 ${
            mine
              ? "rounded-br-md bg-oxblood-600/90 border border-oxblood-500"
              : "rounded-bl-md bg-ink-800 border border-ink-700"
          }`}
        >
          {attachments.length > 0 ? (
            <View className={hasText ? "mb-2 gap-1.5" : "gap-1.5"}>
              {attachments.map((path, i) => (
                <View
                  key={`${path}-${i}`}
                  className="flex-row items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 px-3 py-2"
                >
                  <Icon
                    name="image-outline"
                    size={16}
                    color={colors.bone[300]}
                  />
                  <Text variant="caption" className="text-bone-300">
                    Photo — view on web
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {hasText ? (
            <Text
              variant="body"
              className={mine ? "text-bone-100" : "text-bone-100"}
            >
              {message.body}
            </Text>
          ) : null}
        </View>
        <Text
          variant="caption"
          className={`mt-1 text-bone-500 ${mine ? "text-right" : "text-left"}`}
        >
          {message.timeLabel}
        </Text>
      </View>
    </View>
  );
}
