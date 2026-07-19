import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { colors } from "../../../src/ui/tokens";
import { formatGBP, depositLabel } from "../../../src/lib/money";
import { useAuth } from "../../../src/lib/auth";
import { ProfileHeader } from "../../../src/features/artist-profile/ProfileHeader";
import { ServiceEditorSheet } from "../../../src/features/artist-profile/ServiceEditorSheet";
import { minutesToLabel } from "../../../src/features/artist-profile/format";
import {
  getEditableArtist,
  listMyServices,
  type EditableService,
} from "../../../src/features/artist-profile/data";
import {
  createService,
  deleteService,
  updateService,
  type ServiceInput,
} from "../../../src/features/artist-profile/actions";

type Status = "loading" | "ready" | "notartist" | "error";

export default function ServicesScreen() {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [artistId, setArtistId] = useState<string | null>(null);
  const [services, setServices] = useState<EditableService[]>([]);
  const [editing, setEditing] = useState<EditableService | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setServices(await listMyServices(a.id));
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

  const openAdd = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((service: EditableService) => {
    setEditing(service);
    setSheetOpen(true);
  }, []);

  const onSubmit = useCallback(
    async (input: ServiceInput) => {
      if (!artistId) return;
      setSaving(true);

      if (editing) {
        // Optimistic edit with revert.
        const prev = services;
        const optimistic = services.map((s) =>
          s.id === editing.id
            ? {
                ...s,
                name: input.name.trim(),
                priceFromPence: input.pricePence,
                depositType: input.depositKind,
                depositValue: input.depositValue,
              }
            : s,
        );
        setServices(optimistic);
        const res = await updateService(editing.id, input);
        setSaving(false);
        if (res.ok) {
          setSheetOpen(false);
          void load();
        } else {
          setServices(prev);
          Alert.alert("Couldn't save", res.error ?? "Please try again.");
        }
        return;
      }

      const res = await createService(artistId, input);
      setSaving(false);
      if (res.ok) {
        setSheetOpen(false);
        void load();
      } else {
        Alert.alert("Couldn't add service", res.error ?? "Please try again.");
      }
    },
    [artistId, editing, services, load],
  );

  const onDelete = useCallback(() => {
    if (!editing) return;
    Alert.alert("Remove service?", `"${editing.name}" will no longer be bookable.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const target = editing;
          const prev = services;
          setServices((list) => list.filter((s) => s.id !== target.id));
          setSheetOpen(false);
          const res = await deleteService(target.id);
          if (!res.ok) {
            setServices(prev);
            Alert.alert("Couldn't remove", res.error ?? "Please try again.");
          }
        },
      },
    ]);
  }, [editing, services]);

  const addButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a service"
      hitSlop={8}
      onPress={openAdd}
      className="h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-800 active:opacity-80"
    >
      <Icon name="add" size={20} color={colors.gold[300]} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ProfileHeader
        title="Services"
        subtitle="What clients can book"
        right={status === "ready" ? addButton : undefined}
      />

      {status === "loading" ? (
        <SkeletonList />
      ) : status === "notartist" || status === "error" ? (
        <ErrorState notartist={status === "notartist"} />
      ) : services.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="pricetags-outline" size={24} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            No services yet
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Add the sittings clients can book — a name, how long it takes, your
            price and the deposit that secures it.
          </Text>
          <Button label="Add your first service" variant="primary" block={false} onPress={openAdd} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            {services.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => openEdit(s)}
                className="flex-row items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 active:opacity-80"
              >
                <View className="min-w-0 flex-1">
                  <Text variant="bodySemibold" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text variant="caption" numberOfLines={1} className="mt-0.5">
                    {minutesToLabel(s.durationMin)}
                    {depositLabel(s.depositType, s.depositValue)
                      ? ` · ${depositLabel(s.depositType, s.depositValue)}`
                      : ""}
                    {s.active ? "" : " · Hidden"}
                  </Text>
                </View>
                <Text variant="bodySemibold" className="text-gold-300">
                  {formatGBP(s.priceFromPence)}
                </Text>
                <Icon name="chevron-forward" size={16} color={colors.bone[500]} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <ServiceEditorSheet
        visible={sheetOpen}
        service={editing}
        onClose={() => setSheetOpen(false)}
        onSubmit={onSubmit}
        onDelete={editing ? onDelete : undefined}
        saving={saving}
      />
    </SafeAreaView>
  );
}

function SkeletonList() {
  return (
    <View className="flex-1 px-5 pt-2">
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="h-[68px] rounded-2xl border border-ink-700 bg-ink-900"
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
        {notartist ? "Finish your studio setup" : "Couldn't load services"}
      </Text>
      <Text variant="body" className="max-w-[280px] text-center text-bone-500">
        {notartist
          ? "Once your artist profile is live you can manage services here."
          : "Something went wrong. Please go back and try again."}
      </Text>
    </View>
  );
}
