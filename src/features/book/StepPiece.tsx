import { type ReactNode } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { ArtistServiceRow } from "../../lib/data/artists";
import { Chip } from "./Chip";
import {
  PLACEMENTS,
  SIZE_OPTIONS,
  MIN_DESCRIPTION,
  type BookingDraft,
} from "./model";

/**
 * Step 1 — the piece. Optional set-service pick, placement chips, a size
 * choice, the brief and an optional budget. Mirrors the web StepPiece but
 * built from the design-system primitives.
 */
export function StepPiece({
  services,
  artistName,
  draft,
  update,
}: {
  services: ArtistServiceRow[];
  artistName: string;
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
}) {
  const descLen = draft.description.trim().length;

  return (
    <View className="gap-7">
      <View>
        <Text variant="display" className="text-2xl">
          Your piece
        </Text>
        <Text variant="body" className="mt-1.5 text-bone-300">
          Tell {artistName} what you have in mind. The more detail, the better the
          reply.
        </Text>
      </View>

      {/* Optional service pick */}
      {services.length > 0 ? (
        <View>
          <Text variant="label" className="mb-3 text-bone-300">
            Pick a service (optional)
          </Text>
          <View className="gap-2.5">
            {services.map((svc) => {
              const selected = draft.serviceId === svc.id;
              return (
                <ServiceRow
                  key={svc.id}
                  name={svc.name}
                  price={formatGBP(svc.price_from_pence)}
                  selected={selected}
                  onPress={() =>
                    update({ serviceId: selected ? null : svc.id })
                  }
                />
              );
            })}
            <CustomRow
              selected={draft.serviceId === null}
              onPress={() => update({ serviceId: null })}
            />
          </View>
        </View>
      ) : null}

      {/* Placement */}
      <View>
        <Text variant="label" className="mb-3 text-bone-300">
          Placement
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {PLACEMENTS.map((p) => (
            <Chip
              key={p}
              label={p}
              selected={draft.placement === p}
              onPress={() =>
                update({ placement: draft.placement === p ? null : p })
              }
            />
          ))}
        </View>
      </View>

      {/* Size */}
      <View>
        <Text variant="label" className="mb-3 text-bone-300">
          Rough size
        </Text>
        <View className="gap-2.5">
          {SIZE_OPTIONS.map((s) => {
            const selected = draft.size === s.key;
            return (
              <SizeRow
                key={s.key}
                label={s.label}
                detail={s.detail}
                selected={selected}
                onPress={() => update({ size: selected ? null : s.key })}
              />
            );
          })}
        </View>
      </View>

      {/* Description */}
      <View>
        <Text variant="label" className="mb-2 text-bone-300">
          What are we making?
        </Text>
        <TextInput
          value={draft.description}
          onChangeText={(description) => update({ description })}
          placeholder="A fine-line botanical along the forearm, soft shading, roughly hand-span…"
          placeholderTextColor={colors.bone[500]}
          selectionColor={colors.gold[400]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="min-h-[104px] rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 font-sans text-[15px] leading-[22px] text-bone-100"
        />
        <View className="mt-1.5 flex-row items-center justify-between">
          <Text variant="caption" className="text-bone-500">
            A sentence or two is plenty.
          </Text>
          <Text
            variant="caption"
            className={descLen >= MIN_DESCRIPTION ? "text-positive" : "text-bone-500"}
          >
            {descLen < MIN_DESCRIPTION
              ? `${MIN_DESCRIPTION - descLen} more`
              : "Looks good"}
          </Text>
        </View>
      </View>

      {/* Budget */}
      <View>
        <Text variant="label" className="mb-2 text-bone-300">
          Budget (optional)
        </Text>
        <View className="flex-row items-center rounded-xl border border-ink-600 bg-ink-800 px-4">
          <Text variant="body" className="text-bone-500">
            £
          </Text>
          <TextInput
            value={draft.budgetPounds}
            onChangeText={(v) =>
              update({ budgetPounds: v.replace(/[^0-9]/g, "") })
            }
            placeholder="Skip if you're not sure"
            placeholderTextColor={colors.bone[500]}
            selectionColor={colors.gold[400]}
            keyboardType="number-pad"
            className="h-12 flex-1 pl-2 font-sans text-[15px] text-bone-100"
          />
        </View>
        <Text variant="caption" className="mt-1.5 text-bone-500">
          A guide only — nothing is charged now.
        </Text>
      </View>
    </View>
  );
}

function ServiceRow({
  name,
  price,
  selected,
  onPress,
}: {
  name: string;
  price: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectableRow selected={selected} onPress={onPress}>
      <View className="flex-1">
        <Text variant="bodySemibold" className={selected ? "text-gold-300" : undefined}>
          {name}
        </Text>
        <Text variant="caption" className="mt-0.5 text-bone-500">
          from {price}
        </Text>
      </View>
      <Radio selected={selected} />
    </SelectableRow>
  );
}

function CustomRow({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectableRow selected={selected} onPress={onPress}>
      <View className="flex-1">
        <Text variant="bodySemibold" className={selected ? "text-gold-300" : undefined}>
          Something custom
        </Text>
        <Text variant="caption" className="mt-0.5 text-bone-500">
          Describe it below — priced after the artist replies
        </Text>
      </View>
      <Radio selected={selected} />
    </SelectableRow>
  );
}

function SizeRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectableRow selected={selected} onPress={onPress}>
      <View className="flex-1">
        <Text variant="bodySemibold" className={selected ? "text-gold-300" : undefined}>
          {label}
        </Text>
        <Text variant="caption" className="mt-0.5 text-bone-500">
          {detail}
        </Text>
      </View>
      <Radio selected={selected} />
    </SelectableRow>
  );
}

function SelectableRow({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
        selected ? "border-gold-400/70 bg-ink-800" : "border-ink-700 bg-ink-900"
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {children}
    </Pressable>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      className={`h-5 w-5 items-center justify-center rounded-full border ${
        selected ? "border-gold-400 bg-gold-400" : "border-ink-500"
      }`}
    >
      {selected ? <Icon name="checkmark" size={13} color={colors.ink[950]} /> : null}
    </View>
  );
}
