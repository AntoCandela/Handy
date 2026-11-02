import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get("theme") || "light";
let delayed = false;
let release: (() => void) | undefined;
Object.assign(window, {
  __TAURI_OS_PLUGIN_INTERNALS__: { os_type: "windows" },
  overlayEmit: emit,
  delayOverlaySettings: () => {
    delayed = true;
  },
  releaseOverlaySettings: () => {
    delayed = false;
    release?.();
  },
});
mockIPC(
  async (cmd) => {
    if (cmd === "get_app_settings") {
      if (delayed)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return {
        app_language: "en",
        selected_model: "fixture",
        selected_microphone: "default",
        overlay_position: "bottom",
      };
    }
    if (cmd === "get_available_models")
      return [{ id: "fixture", name: "Local speech model" }];
    if (cmd === "get_available_microphones")
      return [{ name: "Desk microphone", is_default: true }];
    return null;
  },
  { shouldMockEvents: true },
);
mockWindows("recording-overlay");
const { default: i18n } = await import("../../src/i18n");
await i18n.changeLanguage("en");
const { default: RecordingOverlay } = await import(
  "../../src/overlay/RecordingOverlay"
);
createRoot(document.getElementById("root")!).render(<RecordingOverlay />);
