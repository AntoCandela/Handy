import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { catalog } from "@handy-computer/models";
import "../../src/App.css";

mockIPC((command) => {
  if (command === "get_retired_models") return [];
  if (command === "get_available_accelerators") return { gpu_devices: [] };
  if (command === "get_app_settings") return { ui_language: "en" };
  return null;
});
const { useModelStore } = await import("../../src/stores/modelStore");
const { useSettingsStore } = await import("../../src/stores/settingsStore");
const { useTranscriptionJobsStore } = await import(
  "../../src/stores/transcriptionJobsStore"
);
const { default: i18n } = await import("../../src/i18n");
await i18n.changeLanguage("en");
const { ModelsSettings } = await import(
  "../../src/components/settings/models/ModelsSettings"
);
const models = catalog.models
  .filter((m) => m.role === "asr" && m.curated)
  .slice(0, 3)
  .map((model, index) => ({
    id: `fixture-${index}`,
    name: `Fixture ${index}`,
    description: "Fixture description",
    filename: "model.gguf",
    source: { HuggingFace: { repo_id: model.repository, revision: "main" } },
    size_mb: 700,
    is_downloaded: index < 2,
    is_downloading: false,
    partial_size: 0,
    accuracy_score: 1,
    speed_score: 1,
    supports_translation: index === 2,
    is_recommended: false,
    supported_languages: index === 1 ? ["en"] : ["en", "it"],
    supports_language_selection: true,
    is_custom: false,
    supports_streaming: index === 1,
    supports_language_detection: false,
  }));
useSettingsStore.setState({
  isLoading: false,
  getSetting: (key) => (key === "spoken_languages" ? ["en", "it"] : undefined),
});
useModelStore.setState({
  models,
  currentModel: models[0].id,
  loading: false,
  initialized: true,
  selectModel: async (id) => {
    useModelStore.setState({ currentModel: id });
    return true;
  },
  deleteModel: async () => {
    throw new Error("Deletion must never run in this test");
  },
});
if (new URLSearchParams(location.search).has("locked")) {
  useTranscriptionJobsStore.setState({ jobs: { 1: { state: "queued" } } });
}
document.documentElement.dataset.theme = "dark";
createRoot(document.getElementById("root")!).render(
  <div style={{ height: "100vh", padding: 24, display: "flex" }}>
    <ModelsSettings />
  </div>,
);
