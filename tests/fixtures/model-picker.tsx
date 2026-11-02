import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import type { ModelInfo } from "../../src/bindings";
import "../../src/App.css";
mockIPC(() => null, { shouldMockEvents: true });
const { default: i18n } = await import("../../src/i18n");
await i18n.changeLanguage("en");
document.documentElement.dataset.theme = "dark";
const { default: ModelDropdown } = await import(
  "../../src/components/model-selector/ModelDropdown"
);
const models = [
  {
    id: "fixture-live",
    name: "Parakeet Unified English 0.6B",
    description: "Best all-around choice for English dictation",
    supports_streaming: true,
    size_mb: 697,
    is_downloaded: true,
  },
  {
    id: "fixture-ultra",
    name: "Parakeet Ultra",
    description: "Best accuracy across 25 European languages",
    size_mb: 706,
    is_downloaded: true,
  },
  {
    id: "fixture-whisper",
    name: "Whisper Large v3 Turbo",
    description: "Accurate in many languages. Slow without a GPU",
    size_mb: 845,
    is_downloaded: true,
  },
] as ModelInfo[];
Object.assign(window, { pickedModel: null });
createRoot(document.getElementById("root")!).render(
  <div style={{ position: "absolute", left: 16, bottom: 32 }}>
    <ModelDropdown
      models={models}
      currentModelId="fixture-ultra"
      locked={location.search.includes("locked")}
      onModelSelect={(id) => Object.assign(window, { pickedModel: id })}
    />
  </div>,
);
