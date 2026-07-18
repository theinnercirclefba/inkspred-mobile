import { View } from "react-native";
import { Text } from "./Text";

export interface WordmarkProps {
  /** Font size of the wordmark in px. Default 34. */
  size?: number;
  className?: string;
}

/**
 * The InkSpred wordmark — "InkSpred" set in Pirata One blackletter with a
 * gold full stop. This is the ONLY place the blackletter face is used for the
 * brand name; never re-typeset the wordmark by hand elsewhere.
 */
export function Wordmark({ size = 34, className }: WordmarkProps) {
  return (
    <View className={`flex-row items-baseline ${className ?? ""}`}>
      <Text
        variant="blackletter"
        className="text-bone-100"
        style={{ fontSize: size, lineHeight: size * 1.1 }}
      >
        InkSpred
      </Text>
      <Text
        variant="blackletter"
        className="text-gold-400"
        style={{ fontSize: size, lineHeight: size * 1.1 }}
      >
        .
      </Text>
    </View>
  );
}
