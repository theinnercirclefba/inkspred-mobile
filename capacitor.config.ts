import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Inkspred native shell.
 *
 * The app loads the live Inkspred web app inside a native WebView, so every
 * screen we ship on the web appears in the app instantly. Native capabilities
 * (push notifications for Cancellation Watch, camera for portfolio uploads,
 * splash/status bar) are layered on top via Capacitor plugins — which is also
 * what takes this past Apple's "not just a website" (guideline 4.2) bar.
 *
 * When the inkspred.app domain is live, update `server.url` to it.
 */
const config: CapacitorConfig = {
  appId: "app.inkspred",
  appName: "Inkspred",
  webDir: "www",
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
