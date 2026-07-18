import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatDate } from "./format";
import type { CustomerRequest, RequestStatus } from "./data";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

function statusTone(status: RequestStatus): "gold" | "positive" | "neutral" {
  if (status === "accepted") return "positive";
  if (status === "pending" || status === "reviewing") return "gold";
  return "neutral";
}

/** A booking request the customer has sent, with its current status chip. */
export function RequestCard({ request }: { request: CustomerRequest }) {
  const router = useRouter();
  const canOpen = request.artistHandle.length > 0;

  return (
    <Pressable
      accessibilityRole={canOpen ? "button" : undefined}
      disabled={!canOpen}
      onPress={
        canOpen
          ? () => router.push(`/(customer)/artist/${request.artistHandle}`)
          : undefined
      }
      className={`rounded-2xl border border-ink-700 bg-ink-900 p-4 ${
        canOpen ? "active:opacity-80" : ""
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
          <Icon name="hourglass-outline" size={16} color={colors.bone[500]} />
        </View>

        <View className="min-w-0 flex-1">
          <Text variant="caption" numberOfLines={1}>
            {request.artistName}
          </Text>
          <Text variant="bodySemibold" numberOfLines={2} className="mt-0.5">
            {request.piece}
          </Text>
          <Text variant="body" className="mt-1 text-[13px] text-bone-500">
            Sent {formatDate(request.createdIso)}
          </Text>
          <View className="mt-2.5">
            <Badge label={STATUS_LABEL[request.status]} tone={statusTone(request.status)} />
          </View>
        </View>

        {canOpen ? (
          <Icon name="chevron-forward" size={18} color={colors.bone[500]} />
        ) : null}
      </View>
    </Pressable>
  );
}
