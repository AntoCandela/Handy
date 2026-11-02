import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/App.css";
const fixtureTheme = "dark" as const;
const fixtureLayout = { padding: 24, maxWidth: 700 } as const;
mockIPC(() => null, { shouldMockEvents: true });
const { useSettingsStore } = await import("../../src/stores/settingsStore");
useSettingsStore.setState({
  isLoading: false,
  settings: { theme: fixtureTheme },
});
const { default: i18n } = await import("../../src/i18n");
await i18n.changeLanguage("en");
const { initializeAppearance } = await import("../../src/lib/utils/appearance");
initializeAppearance();
document.documentElement.dataset.theme = fixtureTheme;
const { AppearanceSettings } = await import(
  "../../src/components/settings/AppearanceSettings"
);
createRoot(document.getElementById("root")!).render(
  <div style={fixtureLayout}>
    <AppearanceSettings />
  </div>,
);
