import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon, type IconName } from "../../ui/Icon";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { useAuth, type UserRole } from "../../lib/auth";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Customer",
  artist: "Artist",
  studio_admin: "Studio",
};

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The signed-in identity card + sign-out, shared across every role's account
 * surface so a signed-in user can always leave. Shows who's signed in, their
 * role, and the account controls that are coming next (rendered as disabled
 * "coming soon" rows rather than dead buttons).
 */
export function AccountPanel() {
  const { profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View className="gap-5">
      <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800">
            <Text variant="display" className="text-xl text-bone-100">
              {profile ? monogram(profile.fullName) : "?"}
            </Text>
          </View>
          <View className="flex-1">
            <Text variant="bodySemibold" numberOfLines={1}>
              {profile?.fullName ?? "Your account"}
            </Text>
            <Text variant="caption" numberOfLines={1} className="mt-0.5">
              {profile?.email ?? ""}
            </Text>
          </View>
          {profile ? <Badge label={ROLE_LABEL[profile.role]} tone="gold" /> : null}
        </View>
      </View>

      <View className="rounded-2xl border border-ink-700 bg-ink-900">
        <ComingRow icon="person-outline" label="Edit profile" first />
        <ComingRow icon="card-outline" label="Payment methods" />
        <ComingRow icon="notifications-outline" label="Notifications" />
        <ComingRow icon="shield-checkmark-outline" label="Privacy & data" last />
      </View>

      <Button label="Sign out" variant="secondary" loading={signingOut} onPress={onSignOut} />

      <Text variant="caption" className="text-center text-bone-500">
        Profile, payments and notification controls arrive in an upcoming build.
      </Text>
    </View>
  );
}

function ComingRow({
  icon,
  label,
  first,
  last,
}: {
  icon: IconName;
  label: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${
        first ? "" : "border-t border-ink-700"
      } ${last ? "" : ""}`}
    >
      <Icon name={icon} size={18} color={colors.bone[300]} />
      <Text variant="body" className="flex-1 text-bone-100">
        {label}
      </Text>
      <Badge label="Soon" tone="neutral" />
    </View>
  );
}
