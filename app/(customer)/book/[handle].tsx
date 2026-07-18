import { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { colors } from "../../../src/ui/tokens";
import { getArtistByHandle, type ArtistProfile } from "../../../src/lib/data/artists";
import { BookingWizard } from "../../../src/features/book/BookingWizard";

type Status = "loading" | "ready" | "notfound" | "error";

/**
 * Booking route: /book/[handle]. Resolves the real published artist, then hands
 * off to the wizard. Loading / not-found / error mirror the artist profile
 * screen so the two feel like one flow.
 */
export default function BookScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [artist, setArtist] = useState<ArtistProfile | null>(null);

  const load = useCallback(async () => {
    if (!handle) return;
    setStatus("loading");
    try {
      const profile = await getArtistByHandle(handle);
      if (!profile) {
        setStatus("notfound");
        return;
      }
      setArtist(profile);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <View className="flex-1 bg-ink-950">
        <SafeAreaView edges={["top"]} className="flex-1">
          <BackBar onBack={() => router.back()} />
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="small" color={colors.gold[400]} />
            <Text variant="caption">Loading booking…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (status === "notfound" || status === "error" || !artist) {
    return (
      <View className="flex-1 bg-ink-950">
        <SafeAreaView edges={["top"]} className="flex-1">
          <BackBar onBack={() => router.back()} />
          <View className="flex-1 items-center justify-center px-8">
            <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
              <Icon
                name={status === "notfound" ? "person-remove-outline" : "cloud-offline-outline"}
                size={26}
                color={colors.gold[400]}
              />
            </View>
            <Text variant="display" className="mb-2 text-center text-xl">
              {status === "notfound" ? "Artist not found" : "Something went wrong"}
            </Text>
            <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
              {status === "notfound"
                ? "We couldn't find this artist to book with."
                : "We couldn't start your booking. Please try again."}
            </Text>
            {status === "error" ? (
              <Button label="Try again" variant="secondary" block={false} onPress={load} />
            ) : (
              <Button label="Go back" variant="secondary" block={false} onPress={() => router.back()} />
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return <BookingWizard artist={artist} />;
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <View className="px-3 pt-2">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80"
      >
        <Icon name="chevron-back" size={20} color={colors.bone[100]} />
      </Pressable>
    </View>
  );
}
