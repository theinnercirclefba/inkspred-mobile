// Metro config for the InkSpred native app.
//
// This app builds in TWO places:
//   1. Inside the npm-workspaces monorepo (apps/native) for day-to-day dev.
//   2. As a STANDALONE repo (theinnercirclefba/inkspred-mobile) on Codemagic,
//      where apps/native's contents sit at the repo root with no workspace
//      around them.
//
// Monorepo detection is therefore CONDITIONAL: we only apply the Expo-monorepo
// recipe (watch the workspace root, resolve modules from both the app and the
// root node_modules) when the workspace root marker is actually present —
// i.e. ../../package.json exists AND declares a `workspaces` field. Otherwise
// we fall back to a plain single-project Expo config so the standalone build
// doesn't point Metro at folders that don't exist.
const path = require("path");
const fs = require("fs");
const Module = require("module");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Is this app currently living inside its npm-workspaces monorepo?
function isInsideWorkspace() {
  try {
    const rootPkgPath = path.join(workspaceRoot, "package.json");
    if (!fs.existsSync(rootPkgPath)) return false;
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
    return Boolean(rootPkg && rootPkg.workspaces);
  } catch {
    return false;
  }
}

const MONOREPO = isInsideWorkspace();

if (MONOREPO) {
  // The React 18 native stack (react-native, react) is nested in this app
  // because the web app owns React 19 at the workspace root. NativeWind's Metro
  // plugin (react-native-css-interop) hoists to the root, so its config-time
  // `require('react-native/package.json')` can't see the app-nested copy. Add
  // the app's node_modules to Node's resolution fallback so those hoisted
  // build-time requires resolve here. Metro's own bundler resolution is handled
  // separately by watchFolders + nodeModulesPaths below.
  process.env.NODE_PATH = [process.env.NODE_PATH, path.join(projectRoot, "node_modules")]
    .filter(Boolean)
    .join(path.delimiter);
  Module._initPaths();
}

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(projectRoot);

if (MONOREPO) {
  // 1. Watch all files within the monorepo — APPEND to Metro's defaults rather
  // than replacing them, so the SDK 54 default watch entries are preserved.
  config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

  // 2. Let Metro resolve packages from the app first, then the workspace root
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ];

  // NOTE: hierarchical lookup is intentionally LEFT ENABLED (Metro's default).
  // The SDK 52 config disabled it to force the React 18 native stack to resolve
  // predictably, but under SDK 54 some bundled deps nest their own transitive
  // packages (e.g. expo's whatwg-url-without-unicode nests webidl-conversions
  // in its OWN node_modules rather than hoisting it). Disabling hierarchical
  // lookup makes Metro ignore those nested folders and the export fails to
  // resolve them. The standard Expo monorepo recipe (watchFolders +
  // nodeModulesPaths, hierarchical lookup on) resolves both correctly.
}
// Standalone: leave Metro's defaults (single project root, hierarchical lookup)
// exactly as getDefaultConfig produced them.

module.exports = withNativeWind(config, { input: "./global.css" });
