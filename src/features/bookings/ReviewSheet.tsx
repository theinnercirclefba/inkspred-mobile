import { useEffect, useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { Text } from "../../ui/Text";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { Stars } from "../../ui/Stars";
import { colors } from "../../ui/tokens";

/**
 * Leave-a-review bottom sheet — a whole-star 1–5 picker plus an optional note.
 * The parent owns the write (submitReview under RLS) and drives `saving` /
 * `error`; this sheet only collects input. Confirm is disabled until a star is
 * chosen, so the "invalid rating" path can never be hit from here.
 */

const RATING_WORDS: Record<number, string> = {
  1: "Not for me",
  2: "It was okay",
  3: "Pretty good",
  4: "Really happy",
  5: "Absolutely loved it",
};

export interface ReviewSheetProps {
  visible: boolean;
  /** Who the review is for — shown in the header for context. */
  artistName: string;
  /** The piece / service, for a warm subtitle. */
  piece: string;
  saving?: boolean;
  /** A human error from the last submit attempt, or null. */
  error?: string | null;
  onClose: () => void;
  onSubmit: (rating: number, body: string) => void;
}

export function ReviewSheet({
  visible,
  artistName,
  piece,
  saving = false,
  error = null,
  onClose,
  onSubmit,
}: ReviewSheetProps) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");

  // Reset the form each time the sheet opens for a fresh booking.
  useEffect(() => {
    if (visible) {
      setRating(0);
      setBody("");
    }
  }, [visible]);

  const canSubmit = rating >= 1 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-3xl border-t border-ink-700 bg-ink-950 pb-8">
          {/* Header */}
          <View className="flex-row items-start justify-between px-5 pb-4 pt-5">
            <View className="flex-1 pr-3">
              <Text variant="display" className="text-xl">
                Leave a review
              </Text>
              <Text
                variant="body"
                numberOfLines={1}
                className="mt-0.5 text-[13px] text-bone-500"
              >
                {artistName} · {piece}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-ink-900 active:opacity-80"
            >
              <Icon name="close" size={18} color={colors.bone[300]} />
            </Pressable>
          </View>

          <View className="px-5">
            {/* Rating */}
            <Text variant="label" className="mb-3 text-bone-500">
              Your rating
            </Text>
            <View className="flex-row items-center gap-3">
              <Stars rating={rating} size={30} onRate={setRating} />
              {rating >= 1 ? (
                <Text variant="bodyMedium" className="text-[13px] text-gold-300">
                  {RATING_WORDS[rating]}
                </Text>
              ) : null}
            </View>

            {/* Note */}
            <Text variant="label" className="mb-2.5 mt-6 text-bone-500">
              Add a note (optional)
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="What made the experience? Your words help other clients choose."
              placeholderTextColor={colors.bone[500]}
              multiline
              maxLength={1000}
              className="rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3 text-bone-100"
              style={{ height: 112, textAlignVertical: "top", fontFamily: "Inter_400Regular" }}
            />

            {error ? (
              <View className="mt-4 rounded-xl border border-negative/40 bg-negative/10 px-3.5 py-2.5">
                <Text variant="body" className="text-[13px] text-negative">
                  {error}
                </Text>
              </View>
            ) : null}

            <Button
              label={saving ? "Posting…" : "Post review"}
              variant="primary"
              loading={saving}
              disabled={!canSubmit}
              onPress={() => onSubmit(rating, body)}
              className="mt-5"
            />
            <Text variant="caption" className="mt-3 text-center">
              Posted as a Verified booking — only clients who sat through
              InkSpred can review.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
