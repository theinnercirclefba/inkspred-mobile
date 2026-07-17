import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Inkspred native shell.
 *
 * The app loads the live Inkspred web app inside a native WebView. The
 * appended user agent ("InkspredNative") is the contract the web app uses to
 * switch into native app mode: "/" redirects to /discover, marketing chrome
 * hides, and the bottom tab bar takes over. Native capabilities (push for
 * Cancellation Watch, camera for portfolio/reference photos, splash/status
 * bar) are layered on via Capacitor plugins.
 *
 * When the inkspred.app domain is live, update `server.url` to it.
 */
const config: CapacitorConfig = {
  appId: "app.inkspred",
  appName: "InkSpred",
  webDir: "www",
  appendUserAgent: "InkspredNative",
  server: {
    url: "https://inkspread-nu.vercel.app",
    cleartext: false,
    // Keep these flows inside the app's WebView instead of bouncing to Safari:
    // our own site, Supabase auth, and the Stripe/Klarna payment redirects.
    allowNavigation: [
      "inkspred.app",
      "*.inkspred.app",
      "inkspread-nu.vercel.app",
      "*.vercel.app",
      "*.supabase.co",
      "*.stripe.com",
      "checkout.stripe.com",
      "js.stripe.com",
      "*.klarna.com",
    ],
  },
  backgroundColor: "#0d0d10",
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#0d0d10",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d0d10",
    },
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0d0d10",
  },
  android: {
    backgroundColor: "#0d0d10",
  },
};

export default config;
