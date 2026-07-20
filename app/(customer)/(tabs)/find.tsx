import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  type ListRenderItemInfo,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { colors } from "../../../src/ui/tokens";
import { MapPin, useMarkerTracking } from "../../../src/features/find/MapPin";
import { ArtistRailCard, RAIL_CARD_WIDTH } from "../../../src/features/find/ArtistRailCard";
import { listPublishedArtists, type DirectoryArtist } from "../../../src/lib/data/artists";
import {
  resolveArtistCoords,
  styleLabel,
  styleKey,
  DEFAULT_CENTRE,
  type LatLng,
} from "../../../src/lib/geo";
import { DARK_MAP_STYLE } from "../../../src/features/find/mapStyle";
import { InkDropsList } from "../../../src/features/ink-drop/InkDropsList";

type FindMode = "map" | "drops";

/** An artist that has a resolvable map position. */
interface PinnedArtist {
  artist: DirectoryArtist;
  coord: LatLng;
}

const RAIL_INTERVAL = RAIL_CARD_WIDTH + 12; // card width + mr-3

export default function Find() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const railRef = useRef<FlatList<PinnedArtist> | null>(null);

  const [artists, setArtists] = useState<DirectoryArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [mode, setMode] = useState<FindMode>("map");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const rows = await listPublishedArtists();
      setArtists(rows);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Ask for location once; centre on the user when granted, else Manchester.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(here);
        mapRef.current?.animateToRegion(regionFor(here, 0.25), 600);
      } catch {
        // Location is best-effort — the map still works centred on Manchester.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Every published artist reduced to a map position (precise, else city
  // centroid). Artists with no position at all are dropped from the map.
  const allPinned = useMemo<PinnedArtist[]>(
    () =>
      artists
        .map((artist) => {
          const coord = resolveArtistCoords(artist.lat, artist.lng, artist.city, artist.handle);
          return coord ? { artist, coord } : null;
        })
        .filter((p): p is PinnedArtist => p !== null),
    [artists],
  );

  // The style chip set — the union of every artist's styles, normalised.
  const styleChips = useMemo<string[]>(() => {
    const seen = new Map<string, string>();
    for (const a of artists) {
      for (const s of a.styles) {
        const key = styleKey(s);
        if (!seen.has(key)) seen.set(key, styleLabel(s));
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [artists]);

  // Apply the search box + style chip.
  const pinned = useMemo<PinnedArtist[]>(() => {
    const q = query.trim().toLowerCase();
    return allPinned.filter(({ artist }) => {
      if (activeStyle && !artist.styles.some((s) => styleKey(s) === styleKey(activeStyle))) {
        return false;
      }
      if (!q) return true;
      const haystack = [artist.displayName, artist.city ?? "", artist.handle, ...artist.styles]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allPinned, query, activeStyle]);

  // Keep the selection valid as the filtered set changes.
  useEffect(() => {
    if (selectedId && !pinned.some((p) => p.artist.id === selectedId)) {
      setSelectedId(null);
    }
  }, [pinned, selectedId]);

  const selectAndCentre = useCallback((item: PinnedArtist) => {
    setSelectedId(item.artist.id);
    mapRef.current?.animateToRegion(regionFor(item.coord, 0.12), 400);
  }, []);

  const onPinPress = useCallback(
    (item: PinnedArtist) => {
      setSelectedId(item.artist.id);
      const index = pinned.findIndex((p) => p.artist.id === item.artist.id);
      if (index >= 0) {
        railRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
    },
    [pinned],
  );

  const initialRegion = useMemo<Region>(
    () => regionFor(userLocation ?? DEFAULT_CENTRE, 0.4),
    // First mount only; user-location recentres imperatively above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const renderCard = useCallback(
    ({ item }: ListRenderItemInfo<PinnedArtist>) => (
      <ArtistRailCard
        artist={item.artist}
        selected={item.artist.id === selectedId}
        onPress={() => selectAndCentre(item)}
        onOpen={() => router.push(`/(customer)/artist/${item.artist.handle}`)}
      />
    ),
    [selectedId, selectAndCentre, router],
  );

  // Ink Drops mode — a simple column: the mode toggle over the drops browser.
  if (mode === "drops") {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-ink-950">
        <View className="px-4 pb-2 pt-2">
          <ModeToggle mode={mode} onChange={setMode} />
        </View>
        <InkDropsList userLocation={userLocation} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ink-950">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
        customMapStyle={Platform.OS === "android" ? DARK_MAP_STYLE : undefined}
        onPress={() => setSelectedId(null)}
      >
        {pinned.map((item) => (
          <ArtistMarker
            key={item.artist.id}
            item={item}
            selected={item.artist.id === selectedId}
            onPress={() => onPinPress(item)}
          />
        ))}
        {userLocation ? (
          <Marker
            coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View className="items-center justify-center">
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.gold[400],
                  borderWidth: 3,
                  borderColor: colors.ink[950],
                }}
              />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Floating search + style chips */}
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, top: 0 }}
      >
        <View className="px-4 pt-2" pointerEvents="box-none">
          <View className="mb-2.5">
            <ModeToggle mode={mode} onChange={setMode} />
          </View>
          <View className="flex-row items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900/95 px-3.5">
            <Icon name="search" size={18} color={colors.bone[500]} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search artists, styles or a city"
              placeholderTextColor={colors.bone[500]}
              selectionColor={colors.gold[400]}
              autoCapitalize="none"
              className="h-12 flex-1 font-sans text-[15px] text-bone-100"
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button">
                <Icon name="close-circle" size={18} color={colors.bone[500]} />
              </Pressable>
            ) : null}
          </View>

          {styleChips.length > 0 ? (
            <FlatList
              horizontal
              data={styleChips}
              keyExtractor={(s) => s}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 10, paddingRight: 8 }}
              renderItem={({ item }) => {
                const active = activeStyle ? styleKey(activeStyle) === styleKey(item) : false;
                return (
                  <Pressable
                    onPress={() => setActiveStyle(active ? null : item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`mr-2 rounded-full border px-3.5 py-1.5 ${
                      active ? "border-bone-100 bg-bone-100" : "border-ink-600 bg-ink-900/95"
                    }`}
                  >
                    <Text
                      variant="bodyMedium"
                      className={`text-[13px] ${active ? "text-ink-950" : "text-bone-300"}`}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          ) : null}
        </View>
      </SafeAreaView>

      {/* Bottom card rail */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        {loading ? (
          <RailSkeleton />
        ) : error ? (
          <RailNotice
            icon="cloud-offline-outline"
            title="Couldn't load artists"
            body="Check your connection and try again."
            actionLabel="Retry"
            onAction={load}
          />
        ) : pinned.length === 0 ? (
          <RailNotice
            icon="search-outline"
            title="No artists here yet"
            body={
              query || activeStyle
                ? "Try a different search or clear your filters."
                : "New artists are joining InkSpred every week."
            }
            actionLabel={query || activeStyle ? "Clear filters" : undefined}
            onAction={
              query || activeStyle
                ? () => {
                    setQuery("");
                    setActiveStyle(null);
                  }
                : undefined
            }
          />
        ) : (
          <FlatList
            ref={railRef}
            data={pinned}
            keyExtractor={(p) => p.artist.id}
            renderItem={renderCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={RAIL_INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 }}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                railRef.current?.scrollToOffset({ offset: index * RAIL_INTERVAL, animated: true });
              }, 60);
            }}
          />
        )}
      </View>
    </View>
  );
}

/** The Map ⇄ Ink Drops segmented control that sits at the top of Find. */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: FindMode;
  onChange: (m: FindMode) => void;
}) {
  const segments: { key: FindMode; label: string; icon: IconName }[] = [
    { key: "map", label: "Map", icon: "map-outline" },
    { key: "drops", label: "Ink Drops", icon: "flash" },
  ];
  return (
    <View className="flex-row items-center rounded-full border border-ink-700 bg-ink-900/95 p-1">
      {segments.map((seg) => {
        const active = seg.key === mode;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onChange(seg.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2 ${
              active ? "bg-bone-100" : ""
            }`}
          >
            <Icon
              name={seg.icon}
              size={15}
              color={
                active
                  ? colors.ink[950]
                  : seg.key === "drops"
                    ? colors.gold[400]
                    : colors.bone[300]
              }
            />
            <Text
              variant="bodySemibold"
              className={`text-[13px] ${active ? "text-ink-950" : "text-bone-300"}`}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A marker whose custom pin re-rasterises briefly on selection change. */
function ArtistMarker({
  item,
  selected,
  onPress,
}: {
  item: PinnedArtist;
  selected: boolean;
  onPress: () => void;
}) {
  const tracking = useMarkerTracking(selected);
  return (
    <Marker
      coordinate={{ latitude: item.coord.lat, longitude: item.coord.lng }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracking}
      zIndex={selected ? 10 : 1}
    >
      <MapPin selected={selected} />
    </Marker>
  );
}

function RailSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <View className="flex-row gap-3">
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{ width: RAIL_CARD_WIDTH }}
            className="rounded-2xl border border-ink-700 bg-ink-900 p-3"
          >
            <View className="flex-row gap-3">
              <View className="h-[68px] w-[68px] rounded-xl bg-ink-800" />
              <View className="flex-1 gap-2 py-1">
                <View className="h-4 w-3/4 rounded bg-ink-800" />
                <View className="h-3 w-1/2 rounded bg-ink-800" />
                <View className="h-3 w-2/3 rounded bg-ink-800" />
              </View>
            </View>
            <View className="mt-3 h-9 rounded-lg bg-ink-800" />
          </View>
        ))}
      </View>
      <View className="mt-3 flex-row items-center gap-2">
        <ActivityIndicator size="small" color={colors.gold[400]} />
        <Text variant="caption">Finding artists near you…</Text>
      </View>
    </View>
  );
}

function RailNotice({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <View className="rounded-2xl border border-ink-700 bg-ink-900/95 p-4">
        <View className="flex-row items-center gap-2">
          <Icon name={icon} size={18} color={colors.gold[400]} />
          <Text variant="bodySemibold">{title}</Text>
        </View>
        <Text variant="body" className="mt-1 text-bone-500">
          {body}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            className="mt-3 h-10 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 active:opacity-80"
          >
            <Text variant="bodySemibold" className="text-[13px] text-bone-100">
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A map region roughly `spanDeg` tall centred on a point. */
function regionFor(centre: LatLng, spanDeg: number): Region {
  return {
    latitude: centre.lat,
    longitude: centre.lng,
    latitudeDelta: spanDeg,
    longitudeDelta: spanDeg,
  };
}
