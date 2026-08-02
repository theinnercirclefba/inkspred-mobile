import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { acceptRequest, declineRequest } from "../artist/actions";
import { datesLabel } from "../messages/RequestCard";
import type { RequestView } from "../messages/types";

/**
 * The booking request as the conversation's opener — the ARTIST's side. Same
 * rich card as the customer variant, but an open request carries real Accept /
 * Decline actions (the same acceptRequest/declineRequest the Requests inbox
 * uses — accepting materialises the confirmed appointment). `onChanged`
 * refreshes the thread once a response lands.
 */

const STATUS_CHIP: Record<
  RequestView["status"],
  { label: string; tone: "gold" | "positive" | "neutral" }
> = {
  pending: { label: "New request", tone: "gold" },
  reviewing: { label: "Reviewing", tone: "gold" },
  accepted: { label: "Accepted", tone: "positive" },
  declined: { label: "Declined", tone: "neutral" },
};

export function ArtistRequestCard({
  request,
  onChanged,
}: {
  request: RequestView;
  onChanged?: () => void;
}) {
  const chip = STATUS_CHIP[request.status];
  const open = request.status === "pending" || request.status === "reviewing";
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const respond = useCallback(
    async (action: "accept" | "decline") => {
      setBusy(action);
      const result =
        action === "accept"
          ? await acceptRequest(request.id)
          : await declineRequest(request.id);
      setBusy(null);
      if (!result.ok) {
        Alert.alert(
          "Couldn't update the request",
          "Please check your connection and try again.",
        );
        return;
      }
      onChanged?.();
      if (action === "accept") {
        Alert.alert(
          "Request accepted",
          "The booking is confirmed on your side — propose a session time from your Requests inbox, and the deposit is collected once they pay.",
        );
      }
    },
    [request.id, onChanged],
  );

  const onAccept = useCallback(() => {
    Alert.alert("Accept this request?", "It becomes a confirmed booking you can schedule.", [
      { text: "Cancel", style: "cancel" },
      { text: "Accept", onPress: () => void respond("accept") },
    ]);
  }, [respond]);

  const onDecline = useCallback(() => {
    Alert.alert(
      "Decline this request?",
      "The client will see it was declined. You can keep chatting here.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Decline", style: "destructive", onPress: () => void respond("decline") },
      ],
    );
  }, [respond]);

  return (
    <View className="w-full overflow-hidden rounded-2xl border border-ink-700 bg-ink-800">
      <View className="flex-row items-center justify-between border-b border-ink-700 bg-ink-900/60 px-4 py-2.5">
        <View className="flex-row items-center gap-1.5">
          <Icon name="file-tray-full-outline" size={13} color={colors.gold[300]} />
          <Text variant="label" className="text-[10px] tracking-[1px] text-gold-300">
            Booking request
          </Text>
        </View>
        <Badge label={chip.label} tone={chip.tone} />
      </View>

      <View className="px-4 py-4">
        <Text variant="body" className="text-bone-100">
          {request.description}
        </Text>

        <View className="mt-3 gap-1.5 border-t border-ink-700 pt-3">
          {request.placement ? <MetaRow label="Placement" value={request.placement} /> : null}
          {request.sizeDesc ? <MetaRow label="Size" value={request.sizeDesc} /> : null}
          {request.budgetPence ? (
            <MetaRow label="Budget" value={`Around ${formatGBP(request.budgetPence)}`} />
          ) : null}
          {request.preferredDates.length > 0 ? (
            <MetaRow label="Dates" value={datesLabel(request.preferredDates)} />
          ) : null}
        </View>

        {open ? (
          <View className="mt-4 flex-row gap-2.5">
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={onDecline}
              className="flex-1 flex-row items-center justify-center rounded-xl border border-ink-600 bg-ink-900 py-3 active:opacity-80"
            >
              {busy === "decline" ? (
                <ActivityIndicator size="small" color={colors.bone[300]} />
              ) : (
                <Text variant="bodyMedium" className="text-[14px] text-bone-300">
                  Decline
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={onAccept}
              className="flex-[1.6] flex-row items-center justify-center gap-1.5 rounded-xl bg-oxblood-500 py-3 active:opacity-85"
            >
              {busy === "accept" ? (
                <ActivityIndicator size="small" color={colors.bone[100]} />
              ) : (
                <>
                  <Icon name="checkmark" size={15} color={colors.bone[100]} />
                  <Text variant="bodySemibold" className="text-[14px] text-bone-100">
                    Accept request
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" className="text-bone-500">
        {label}
      </Text>
      <Text variant="caption" className="flex-1 text-right text-bone-300" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
