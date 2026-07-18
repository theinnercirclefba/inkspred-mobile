import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { Text } from "./Text";
import { colors } from "./tokens";

export interface FieldProps extends TextInputProps {
  label: string;
  /** Inline validation / error message shown under the input. */
  error?: string;
  className?: string;
}

/**
 * A labelled text input matching the web form controls — ink-800 surface,
 * ink-600 hairline, bone text, gold focus is implied by the caret colour. Use
 * for every credential / detail entry.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, className, ...rest },
  ref,
) {
  return (
    <View className={className}>
      <Text variant="label" className="mb-2 text-bone-300">
        {label}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.bone[500]}
        selectionColor={colors.gold[400]}
        className={`h-12 rounded-xl border px-4 font-sans text-[15px] text-bone-100 ${
          error ? "border-negative bg-ink-800" : "border-ink-600 bg-ink-800"
        }`}
        {...rest}
      />
      {error ? (
        <Text variant="caption" className="mt-1.5 text-negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
