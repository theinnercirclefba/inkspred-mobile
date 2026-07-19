import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../ui/Text";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import type { DepositKind, EditableService } from "./data";
import type { ServiceInput } from "./actions";
import { minutesToLabel, penceToPoundsInput, poundsToPence } from "./format";

/**
 * Add / edit a service in a bottom sheet. Collects the same shape the web
 * onboarding wizard does — name, a free-text duration label (parsed to minutes
 * on save), a price in £, and a deposit that is either a fixed £ amount or a
 * whole-number percentage. Confirm hands the caller a ServiceInput; all money
 * conversion to pence happens here so the caller stays in pounds-land.
 */
export interface ServiceEditorSheetProps {
  visible: boolean;
  /** The service being edited, or null when adding a new one. */
  service: EditableService | null;
  onClose: () => void;
  onSubmit: (input: ServiceInput) => void;
  onDelete?: () => void;
  saving?: boolean;
}

export function ServiceEditorSheet({
  visible,
  service,
  onClose,
  onSubmit,
  onDelete,
  saving = false,
}: ServiceEditorSheetProps) {
  const [name, setName] = useState("");
  const [durationLabel, setDurationLabel] = useState("");
  const [price, setPrice] = useState("");
  const [depositKind, setDepositKind] = useState<DepositKind>("fixed");
  const [depositValue, setDepositValue] = useState("");
  const [priceError, setPriceError] = useState<string | undefined>();

  // Re-seed the form whenever the sheet opens for a (different) service.
  useEffect(() => {
    if (!visible) return;
    if (service) {
      setName(service.name);
      setDurationLabel(minutesToLabel(service.durationMin));
      setPrice(penceToPoundsInput(service.priceFromPence));
      setDepositKind(service.depositType);
      setDepositValue(
        service.depositType === "percent"
          ? String(service.depositValue)
          : penceToPoundsInput(service.depositValue),
      );
    } else {
      setName("");
      setDurationLabel("");
      setPrice("");
      setDepositKind("fixed");
      setDepositValue("");
    }
    setPriceError(undefined);
  }, [visible, service]);

  const submit = () => {
    const pricePence = poundsToPence(price);
    if (pricePence === null) {
      setPriceError("Enter a valid price, e.g. 120 or 120.50");
      return;
    }
    const depositValueNumber =
      depositKind === "percent"
        ? Math.max(0, Math.min(100, Math.round(Number.parseFloat(depositValue) || 0)))
        : (poundsToPence(depositValue) ?? 0);

    onSubmit({
      name,
      durationLabel: durationLabel.trim() || "2 h",
      pricePence,
      depositKind,
      depositValue: depositValueNumber,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[88%] rounded-t-3xl border-t border-ink-700 bg-ink-950 pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
            <Text variant="display" className="text-xl">
              {service ? "Edit service" : "Add a service"}
            </Text>
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Half-day session"
              className="mb-4"
            />
            <Field
              label="Duration"
              value={durationLabel}
              onChangeText={setDurationLabel}
              placeholder="e.g. 3 h, 90 min, 3–4 h"
              className="mb-4"
            />
            <Field
              label="Price (£)"
              value={price}
              onChangeText={(t) => {
                setPrice(t);
                if (priceError) setPriceError(undefined);
              }}
              keyboardType="decimal-pad"
              placeholder="120"
              error={priceError}
              className="mb-4"
            />

            {/* Deposit */}
            <Text variant="label" className="mb-2 text-bone-300">
              Deposit
            </Text>
            <View className="mb-3 flex-row gap-2">
              <Segment
                label="Fixed £"
                active={depositKind === "fixed"}
                onPress={() => setDepositKind("fixed")}
              />
              <Segment
                label="Percent %"
                active={depositKind === "percent"}
                onPress={() => setDepositKind("percent")}
              />
            </View>
            <Field
              label={depositKind === "percent" ? "Deposit (%)" : "Deposit (£)"}
              value={depositValue}
              onChangeText={setDepositValue}
              keyboardType="decimal-pad"
              placeholder={depositKind === "percent" ? "20" : "30"}
              className="mb-2"
            />
            <Text variant="caption" className="mb-4">
              {depositKind === "percent"
                ? "A share of the price, taken to secure the booking."
                : "A fixed amount, taken to secure the booking."}
            </Text>
          </ScrollView>

          <View className="gap-3 px-5 pt-2">
            <Button
              label={saving ? "Saving…" : service ? "Save changes" : "Add service"}
              variant="primary"
              loading={saving}
              onPress={submit}
            />
            {service && onDelete ? (
              <Button
                label="Remove service"
                variant="ghost"
                disabled={saving}
                onPress={onDelete}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 items-center rounded-xl border py-3 active:opacity-80 ${
        active ? "border-gold-400 bg-gold-400/15" : "border-ink-600 bg-ink-800"
      }`}
    >
      <Text
        variant={active ? "bodySemibold" : "body"}
        className={`text-[14px] ${active ? "text-gold-300" : "text-bone-300"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
