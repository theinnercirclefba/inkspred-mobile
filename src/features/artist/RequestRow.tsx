import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { ArtistRequest, DepositState } from "./data";
import type { RequestStatus } from "../bookings/data";

/**
 * One booking-request row in the artist inbox — the brief (piece, placement,
 * size, budget), a status chip, and the actions that apply to its state:
 * Accept / Decline while live, Propose-a-time once accepted, with a deposit
 * chip (Awaiting deposit / Deposit paid) on the accepted row.
 *
 * Purely presentational — the parent owns optimistic state and passes the
 * handlers plus a `pending` flag that disables the row while a write is in
 * flight.
 */

export interface RequestRowProps {
  request: ArtistRequest;
  pending?: boolean;
  onAccept: (request: ArtistRequest) => void;
  onDecline: (request: ArtistRequest) => void;
  onPropose: (request: ArtistRequest) => void;
}

const STATUS: Record<
  RequestStatus,
  { label: string; tone: "gold" | "positive" | "neutral" }
> = {
  pending: { label: "Pending", tone: "gold" },
  reviewing: { label: "Reviewing", tone: "gold" },
  accepted: { label: "Accepted", tone: "positive" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

const DEPOSIT: Record<
  Exclude<DepositState, "none">,
  { label: string; tone: "gold" | "positive" }
> = {
  awaiting: { label: "Awaiting deposit", tone: "gold" },
  paid: { label: "Deposit paid", tone: "positive" },
};

/** "Left forearm · Palm-sized" from the parts that are present. */
function detailLine(placement: string | null, sizeDesc: string | null): string | null {
  const parts = [placement, sizeDesc].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function RequestRow({
  request,
  pending = false,
  onAccept,
  onDecline,
  onPropose,
}: RequestRowProps) {
  const status = STATUS[request.status];
  const detail = detailLine(request.placement, request.sizeDesc);
  const isLive = request.status === "pending" || request.status === "reviewing";
  const isAccepted = request.status === "accepted";
  const deposit =
    isAccepted && request.depositState !== "none"
      ? DEPOSIT[request.depositState]
      : null;

  return (
    <View
      className={`rounded-2xl border border-ink-700 bg-ink-900 p-4 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {/* Header: customer + status + received */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text variant="bodySemibold" numberOfLines={1}>
            {request.customer}
          </Text>
          <Text variant="caption" className="mt-0.5">
            {request.receivedLabel}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>

      {/* Brief */}
      {request.serviceName ? (
        <Text variant="bodyMedium" className="mt-3 text-[14px] text-gold-300">
          {request.serviceName}
        </Text>
      ) : null}
      <Text
        variant="body"
        numberOfLines={3}
        className="mt-1.5 text-[14px] text-bone-300"
      >
        {request.description || "No description provided."}
      </Text>

      {/* Meta row: placement/size · references · budget */}
      <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        {detail ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="body-outline" size={13} color={colors.bone[500]} />
            <Text variant="caption">{detail}</Text>
          </View>
        ) : null}
        {request.referenceCount > 0 ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="images-outline" size={13} color={colors.bone[500]} />
            <Text variant="caption">
              {request.referenceCount} ref{request.referenceCount === 1 ? "" : "s"}
            </Text>
          </View>
        ) : null}
        {request.budgetPence != null ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="pricetag-outline" size={13} color={colors.bone[500]} />
            <Text variant="caption">{formatGBP(request.budgetPence)} budget</Text>
          </View>
        ) : null}
      </View>

      {/* Accepted: deposit chip + proposed session */}
      {isAccepted ? (
        <View className="mt-3.5 rounded-xl border border-ink-700 bg-ink-800 p-3">
          <View className="flex-row items-center justify-between gap-3">
            {deposit ? (
              <Badge label={deposit.label} tone={deposit.tone} />
            ) : (
              <View />
            )}
            {request.depositPence > 0 ? (
              <Text variant="bodyMedium" className="text-[13px] text-bone-300">
                {formatGBP(request.depositPence)}
              </Text>
            ) : null}
          </View>
          <View className="mt-2.5 flex-row items-center gap-1.5">
            <Icon name="time-outline" size={14} color={colors.bone[500]} />
            <Text
              variant="body"
              className={`text-[13px] ${
                request.sessionLabel ? "text-bone-100" : "text-bone-500"
              }`}
            >
              {request.sessionLabel ?? "No time proposed yet"}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Actions */}
      {isLive ? (
        <View className="mt-4 flex-row gap-2.5">
          <View className="flex-1">
            <Button
              label="Decline"
              variant="secondary"
              disabled={pending}
              onPress={() => onDecline(request)}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Accept"
              variant="primary"
              disabled={pending}
              onPress={() => onAccept(request)}
            />
          </View>
        </View>
      ) : null}

      {isAccepted && request.appointmentId ? (
        <View className="mt-3.5">
          <Button
            label={request.sessionLabel ? "Change proposed time" : "Propose a time"}
            variant={request.sessionLabel ? "secondary" : "gold"}
            disabled={pending}
            onPress={() => onPropose(request)}
          />
        </View>
      ) : null}
    </View>
  );
}
