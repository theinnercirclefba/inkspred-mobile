import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { EmptyState } from "../../../src/ui/EmptyState";
import { colors } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/lib/auth";
import {
  getArtistContext,
  listArtistRequests,
  type ArtistContext,
  type ArtistRequest,
} from "../../../src/features/artist/data";
import {
  acceptRequest,
  declineRequest,
  proposeSessionTime,
} from "../../../src/features/artist/actions";
import { RequestRow } from "../../../src/features/artist/RequestRow";
import { ProposeTimeSheet } from "../../../src/features/artist/ProposeTimeSheet";

type Status = "loading" | "ready" | "error";

/** "Fri 24 Jul · 11:00–15:00" — mirrors the server's session chip label. */
function sessionChipLabel(startIso: string, endIso: string | null): string {
  const dayPart = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(startIso));
  const t = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  return endIso
    ? `${dayPart} · ${t(startIso)}–${t(endIso)}`
    : `${dayPart} · ${t(startIso)}`;
}

export default function Requests() {
  const router = useRouter();
  const { session, role } = useAuth();
  const [ctx, setCtx] = useState<ArtistContext | null>(null);
  const [requests, setRequests] = useState<ArtistRequest[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [proposing, setProposing] = useState<ArtistRequest | null>(null);
  const [savingTime, setSavingTime] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setCtx(null);
      setRequests([]);
      setStatus("ready");
      return;
    }
    try {
      const context = await getArtistContext();
      setCtx(context);
      if (!context) {
        setRequests([]);
        setStatus("ready");
        return;
      }
      const rows = await listArtistRequests(context);
      setRequests(rows);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<ArtistRequest>) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...changes } : r)),
      );
    },
    [],
  );

  /* ── Accept ──────────────────────────────────────────────────────── */
  const handleAccept = useCallback(
    async (request: ArtistRequest) => {
      const snapshot = request;
      setPending(request.id, true);
      // Optimistic: flip to accepted with an awaiting-deposit chip.
      patch(request.id, { status: "accepted", depositState: "awaiting" });
      const res = await acceptRequest(request.id);
      if (!res.ok) {
        patch(request.id, snapshot); // revert
        setPending(request.id, false);
        return;
      }
      // Hydrate the real appointment id / deposit from the server.
      if (ctx) {
        try {
          const rows = await listArtistRequests(ctx);
          setRequests(rows);
        } catch {
          /* keep optimistic state */
        }
      }
      setPending(request.id, false);
    },
    [ctx, patch, setPending],
  );

  /* ── Decline ─────────────────────────────────────────────────────── */
  const handleDecline = useCallback(
    async (request: ArtistRequest) => {
      const snapshot = request;
      setPending(request.id, true);
      patch(request.id, { status: "declined" });
      const res = await declineRequest(request.id);
      if (!res.ok) patch(request.id, snapshot);
      setPending(request.id, false);
    },
    [patch, setPending],
  );

  /* ── Propose a time ──────────────────────────────────────────────── */
  const handleConfirmTime = useCallback(
    async (startIso: string, durationMin: number) => {
      const request = proposing;
      if (!request || !request.appointmentId) return;
      const snapshot = request;
      const endIso = new Date(
        new Date(startIso).getTime() + durationMin * 60_000,
      ).toISOString();

      setSavingTime(true);
      // Optimistic update of the row's proposed session.
      patch(request.id, {
        sessionStartIso: startIso,
        sessionEndIso: endIso,
        durationMin,
        sessionLabel: sessionChipLabel(startIso, endIso),
      });

      const res = await proposeSessionTime(
        request.appointmentId,
        startIso,
        durationMin,
      );
      setSavingTime(false);
      setProposing(null);

      if (!res.ok) {
        patch(request.id, {
          sessionStartIso: snapshot.sessionStartIso,
          sessionEndIso: snapshot.sessionEndIso,
          durationMin: snapshot.durationMin,
          sessionLabel: snapshot.sessionLabel,
        });
      }
    },
    [patch, proposing],
  );

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.gold[400]}
    />
  );

  /* Signed out — branded sign-in prompt. */
  if (!session) {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="file-tray-full" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to see your requests
          </Text>
          <Text
            variant="body"
            className="mb-6 max-w-[280px] text-center text-bone-500"
          >
            New booking enquiries land here — review the brief, accept and offer
            a slot without leaving the app.
          </Text>
          <Button
            label="Sign in"
            variant="primary"
            block={false}
            onPress={() => router.push("/(auth)/login")}
          />
        </View>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load"
          body="We couldn't load your requests. Pull down to refresh and try again."
        />
      </Screen>
    );
  }

  // Signed in but not an artist (no artist row yet).
  if (status === "ready" && session && role === "artist" && !ctx) {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="brush-outline"
          title="Finish your studio setup"
          body="Once your artist profile is live, booking enquiries from clients will appear here ready to accept."
        />
      </Screen>
    );
  }

  const isEmpty = status === "ready" && requests.length === 0;

  if (isEmpty) {
    return (
      <Screen padded={false}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            icon="file-tray-full"
            title="No open requests"
            body="New booking enquiries land here. Review the brief, accept the ones you want and offer a slot — all without leaving the app."
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5">
          <Text variant="displayBold" className="text-3xl">
            Requests
          </Text>
          <Text variant="body" className="mt-1 text-bone-500">
            {requests.length} enquir{requests.length === 1 ? "y" : "ies"} in your
            inbox
          </Text>
        </View>

        <View className="gap-3.5">
          {requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              pending={pendingIds.has(request.id)}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onPropose={setProposing}
            />
          ))}
        </View>
      </ScrollView>

      {proposing ? (
        <ProposeTimeSheet
          visible
          subtitle={`${proposing.customer}${
            proposing.serviceName ? ` · ${proposing.serviceName}` : ""
          }`}
          initialDurationMin={proposing.durationMin}
          initialStartIso={proposing.sessionStartIso}
          saving={savingTime}
          onClose={() => setProposing(null)}
          onConfirm={handleConfirmTime}
        />
      ) : null}
    </Screen>
  );
}
