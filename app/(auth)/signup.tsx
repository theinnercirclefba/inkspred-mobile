import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/ui/Screen";
import { Text } from "../../src/ui/Text";
import { Button } from "../../src/ui/Button";
import { Field } from "../../src/ui/Field";
import { Badge } from "../../src/ui/Badge";
import { Icon } from "../../src/ui/Icon";
import { Wordmark } from "../../src/ui/Wordmark";
import { SocialAuthBlock } from "../../src/ui/SocialAuthBlock";
import { colors } from "../../src/ui/tokens";
import { useAuth, type AccountType } from "../../src/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const ACCOUNT_COPY: Record<AccountType, { badge: string; blurb: string }> = {
  customer: {
    badge: "Getting tattooed",
    blurb: "Discover artists, follow their work and book with confidence.",
  },
  artist: {
    badge: "Tattoo artist",
    blurb: "Run your books, requests and takings from your pocket.",
  },
  studio: {
    badge: "Studio",
    blurb: "Manage your shop, your artists and every chair in one place.",
  },
};

function accountTypeFrom(raw: unknown): AccountType {
  return raw === "artist" || raw === "studio" || raw === "customer" ? raw : "customer";
}

/**
 * Credentials form. The role chosen on the join screen arrives as a param; we
 * create the Supabase auth user, then write the matching public.users row (via
 * the self-insert RLS policy) and land the user in their role's tab group.
 */
export default function Signup() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const accountType = accountTypeFrom(role);
  const copy = ACCOUNT_COPY[accountType];
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const errors: typeof fieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Please tell us your name.";
    if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const result = await signUp({ fullName, email, password, accountType });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error ?? "We couldn't create your account.");
      return;
    }
    if (result.needsEmailConfirmation) {
      setEmailSent(true);
      return;
    }
    router.replace("/");
  }

  if (emailSent) {
    return (
      <Screen scroll>
        <View className="grow justify-center py-10">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="mail-outline" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2">
            Check your email
          </Text>
          <Text variant="body" className="mb-8 text-bone-500">
            We've sent a confirmation link to{" "}
            <Text variant="bodySemibold" className="text-bone-100">
              {email.trim()}
            </Text>
            . Tap it to activate your account, then sign in.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button label="Back to sign in" variant="secondary" />
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="grow justify-center py-10"
      >
        <Wordmark size={30} className="mb-8" />

        <View className="mb-6 flex-row items-center justify-between">
          <Badge label={copy.badge} tone="gold" />
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <Text variant="bodySemibold" className="text-bone-500">
              Change
            </Text>
          </Pressable>
        </View>

        <Text variant="display" className="mb-1">
          Create your account
        </Text>
        <Text variant="body" className="mb-8 text-bone-500">
          {copy.blurb}
        </Text>

        <SocialAuthBlock dividerLabel="or sign up with email" />

        <View className="gap-4">
          <Field
            label="Full name"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              if (fieldErrors.fullName) setFieldErrors((e) => ({ ...e, fullName: undefined }));
            }}
            error={fieldErrors.fullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            placeholder="Your name"
            returnKeyType="next"
          />
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
            autoComplete="password-new"
            textContentType="newPassword"
            placeholder="At least 8 characters"
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
          label="Create account with email"
          variant="secondary"
          className="mt-6"
          loading={submitting}
          onPress={onSubmit}
        />

        <View className="mt-6 flex-row justify-center gap-1.5">
          <Text variant="body" className="text-bone-500">
            Already have an account?
          </Text>
          <Link href="/(auth)/login">
            <Text variant="bodySemibold" className="text-gold-300">
              Sign in
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
