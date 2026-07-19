import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth, roleHome } from "../src/lib/auth";
import { colors } from "../src/ui/tokens";
import { Wordmark } from "../src/ui/Wordmark";

/**
 * Entry gate. Resolves the persisted Supabase session and the user's role,
 * then routes:
 *   - signed out            -> (auth)/login
 *   - signed in, role known -> that role's tab group
 *   - signed in, no profile  -> (auth)/complete to finish choosing a role
 *
 * While the session is resolving we hold on a branded splash so there's no
 * flash of the wrong screen on a warm start.
 */
export default function Index() {
  const { initialising, session, profile } = useAuth();

  if (initialising) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Wordmark size={40} />
        <ActivityIndicator
          color={colors.gold[400]}
          size="small"
          style={{ marginTop: 28 }}
        />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Signed in but the profile row hasn't been created yet — typically a social
  // (Apple/Google) sign-in, which can't carry a role. Send them to pick one and
  // finish setup before entering the app.
  if (!profile) {
    return <Redirect href="/(auth)/complete" />;
  }

  return <Redirect href={roleHome(profile.role) as never} />;
}
