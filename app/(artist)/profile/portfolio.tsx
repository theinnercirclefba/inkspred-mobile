import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { Badge } from "../../../src/ui/Badge";
import { colors } from "../../../src/ui/tokens";
import { publicPortfolioUrl, isPlaceholderPath } from "../../../src/lib/images";
import { useAuth } from "../../../src/lib/auth";
import { ProfileHeader } from "../../../src/features/artist-profile/ProfileHeader";
import {
  getEditableArtist,
  listMyPortfolio,
  type EditablePortfolioItem,
} from "../../../src/features/artist-profile/data";
import {
  deletePortfolioItem,
  registerPortfolioUploads,
  reorderPortfolio,
  setPortfolioPublished,
} from "../../../src/features/artist-profile/actions";
import { pickMultipleImages } from "../../../src/features/artist-profile/pickImage";
import { uploadPortfolioImage } from "../../../src/lib/portfolioUpload";

type Status = "loading" | "ready" | "notartist" | "error";

export default function PortfolioScreen() {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [artistId, setArtistId] = useState<string | null>(null);
  const [items, setItems] = useState<EditablePortfolioItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setStatus("notartist");
      return;
    }
    try {
      const a = await getEditableArtist();
      if (!a) {
        setStatus("notartist");
        return;
      }
      setArtistId(a.id);
      setItems(await listMyPortfolio(a.id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onUpload = useCallback(async () => {
    if (!artistId || uploading) return;
    const picked = await pickMultipleImages(10);
    if (picked.length === 0) return;

    setUploading(true);
    // Upload each image to the caller's own folder, collect the storage paths.
    const paths: string[] = [];
    for (const image of picked) {
      const res = await uploadPortfolioImage(image.uri, image.mimeType);
      if (res.path) paths.push(res.path);
    }

    if (paths.length === 0) {
      setUploading(false);
      Alert.alert("Upload failed", "None of those images could be uploaded. Please try again.");
      return;
    }

    const res = await registerPortfolioUploads(artistId, paths);
    setUploading(false);
    if (res.ok) {
      void load();
      if (res.items.length < picked.length) {
        Alert.alert(
          "Some images skipped",
          `${res.items.length} of ${picked.length} were added. Please retry the rest.`,
        );
      }
    } else {
      Alert.alert("Couldn't add images", "Please try again.");
    }
  }, [artistId, uploading, load]);

  const togglePublished = useCallback(
    async (item: EditablePortfolioItem) => {
      const prev = items;
      const next = !item.published;
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, published: next } : i)),
      );
      const res = await setPortfolioPublished(item.id, next);
      if (!res.ok) {
        setItems(prev);
        Alert.alert("Couldn't update", "Please try again.");
      }
    },
    [items],
  );

  const move = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!artistId) return;
      const target = index + direction;
      if (target < 0 || target >= items.length) return;

      const prev = items;
      const reordered = [...items];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      setItems(reordered);
      setBusyId(moved.id);

      const res = await reorderPortfolio(
        artistId,
        reordered.map((i) => i.id),
      );
      setBusyId(null);
      if (!res.ok) {
        setItems(prev);
        Alert.alert("Couldn't reorder", "Please try again.");
      }
    },
    [artistId, items],
  );

  const onDelete = useCallback(
    (item: EditablePortfolioItem) => {
      Alert.alert("Delete this piece?", "It will be removed from your portfolio.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const prev = items;
            setItems((list) => list.filter((i) => i.id !== item.id));
            const res = await deletePortfolioItem(item.id);
            if (!res.ok) {
              setItems(prev);
              Alert.alert("Couldn't delete", "Please try again.");
            }
          },
        },
      ]);
    },
    [items],
  );

  const uploadButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add photos"
      hitSlop={8}
      onPress={onUpload}
      disabled={uploading}
      className="h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-800 active:opacity-80"
    >
      {uploading ? (
        <ActivityIndicator size="small" color={colors.gold[300]} />
      ) : (
        <Icon name="add" size={20} color={colors.gold[300]} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ProfileHeader
        title="Portfolio"
        subtitle="Your public work"
        right={status === "ready" ? uploadButton : undefined}
      />

      {status === "loading" ? (
        <SkeletonGrid />
      ) : status === "notartist" || status === "error" ? (
        <ErrorState notartist={status === "notartist"} />
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="images-outline" size={24} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Show your best work
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Upload photos from your camera roll. The first pieces become the cover
            clients see in the directory.
          </Text>
          <Button
            label={uploading ? "Uploading…" : "Upload photos"}
            variant="primary"
            block={false}
            loading={uploading}
            onPress={onUpload}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            {items.map((item, index) => (
              <PortfolioRow
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                busy={busyId === item.id}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onTogglePublished={() => togglePublished(item)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PortfolioRow({
  item,
  index,
  total,
  busy,
  onMoveUp,
  onMoveDown,
  onTogglePublished,
  onDelete,
}: {
  item: EditablePortfolioItem;
  index: number;
  total: number;
  busy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  const uri = publicPortfolioUrl(item.imagePath);
  const hasImage = uri && !isPlaceholderPath(item.imagePath);

  return (
    <View className="flex-row gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3">
      {/* Thumbnail */}
      <View className="h-20 w-20 overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
        {hasImage ? (
          <Image source={{ uri: uri! }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="image-outline" size={20} color={colors.bone[500]} />
          </View>
        )}
      </View>

      {/* Meta + controls */}
      <View className="min-w-0 flex-1 justify-between">
        <View className="flex-row flex-wrap items-center gap-1.5">
          {index === 0 ? <Badge label="Cover" tone="gold" /> : null}
          <Badge
            label={item.published ? "Live" : "Hidden"}
            tone={item.published ? "positive" : "neutral"}
          />
          {item.source === "instagram" ? (
            <Badge label="Synced from Instagram" tone="neutral" />
          ) : null}
        </View>

        <View className="mt-2 flex-row items-center gap-1.5">
          <IconBtn
            name="chevron-up"
            disabled={index === 0 || busy}
            onPress={onMoveUp}
          />
          <IconBtn
            name="chevron-down"
            disabled={index === total - 1 || busy}
            onPress={onMoveDown}
          />
          <IconBtn
            name={item.published ? "eye-off-outline" : "eye-outline"}
            onPress={onTogglePublished}
          />
          <IconBtn name="trash-outline" tone="negative" onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

function IconBtn({
  name,
  onPress,
  disabled,
  tone = "neutral",
}: {
  name: React.ComponentProps<typeof Icon>["name"];
  onPress: () => void;
  disabled?: boolean;
  tone?: "neutral" | "negative";
}) {
  const color = disabled
    ? colors.ink[500]
    : tone === "negative"
      ? colors.negative
      : colors.bone[300];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 ${
        disabled ? "opacity-40" : "active:opacity-80"
      }`}
    >
      <Icon name={name} size={17} color={color} />
    </Pressable>
  );
}

function SkeletonGrid() {
  return (
    <View className="flex-1 px-5 pt-2">
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="h-[104px] rounded-2xl border border-ink-700 bg-ink-900"
            style={{ opacity: 0.6 - i * 0.12 }}
          />
        ))}
      </View>
    </View>
  );
}

function ErrorState({ notartist }: { notartist: boolean }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
        <Icon
          name={notartist ? "brush-outline" : "cloud-offline-outline"}
          size={24}
          color={colors.gold[400]}
        />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        {notartist ? "Finish your studio setup" : "Couldn't load portfolio"}
      </Text>
      <Text variant="body" className="max-w-[280px] text-center text-bone-500">
        {notartist
          ? "Once your artist profile is live you can manage your portfolio here."
          : "Something went wrong. Please go back and try again."}
      </Text>
    </View>
  );
}
