import { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { Link, router } from "expo-router";
import { Screen } from "../../src/ui/Screen";
import { Text } from "../../src/ui/Text";
import { Button } from "../../src/ui/Button";
import { Field } from "../../src/ui/Field";
import { Wordmark } from "../../src/ui/Wordmark";
import { SocialAuthBlock } from "../../src/ui/SocialAuthBlock";
import { useAuth } from "../../src/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email + password sign-in against Supabase. On success we route to the entry
 * gate, which resolves the user's role and forwards them to the right tab
 * group. The session persists in AsyncStorage so the next cold start skips
 * straight past this screen.
 */
export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const errors: typeof fieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error ?? "We couldn't sign you in.");
      return;
    }
    router.replace("/");
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="grow justify-center py-10"
      >
        <View className="mb-10 items-center">
          <Wordmark size={44} />
          <Text variant="body" className="mt-3 text-center text-bone-500">
            The operating system for tattoo artists and the people they ink.
          </Text>
        </View>

        <Text variant="display" className="mb-1">
          Welcome back
        </Text>
        <Text variant="body" className="mb-8 text-bone-500">
          Sign in to pick up where you left off.
        </Text>

        <SocialAuthBlock dividerLabel="or use email" />

        <View className="gap-4">
          <Field
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
            }}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
            placeholder="you@email.com"
            returnKeyType="next"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
            }}
            error={fieldErrors.password}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        {formError ? (
          <View className="mt-4 rounded-xl border border-negative/50 bg-negative/10 px-4 py-3">
            <Text variant="body" className="text-negative">
              {formError}
            </Text>
          </View>
        ) : null}

        <Button
          label="Sign in with email"
          variant="secondary"
          className="mt-6"
          loading={submitting}
          onPress={onSubmit}
        />

        <View className="mt-10 flex-row justify-center gap-1.5">
          <Text variant="body" className="text-bone-500">
            New to InkSpred?
          </Text>
          <Link href="/(auth)/join">
            <Text variant="bodySemibold" className="text-gold-300">
              Create an account
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
