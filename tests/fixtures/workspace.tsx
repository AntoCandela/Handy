import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/App.css";
const state = {
  title: "My recording",
  text: "I use handee daily",
  revision: 0,
  originals: ["I use handee daily"],
};
const calls: string[] = [];
Object.assign(window, { workspaceCalls: calls });
mockIPC((cmd, args) => {
  if (cmd === "get_app_settings") return { ui_language: "en" };
  if (cmd === "get_writing_profile")
    return { mode: "dictation", model: "gemma3:4b" };
  if (cmd === "check_writing_model") {
    if (new URLSearchParams(location.search).has("unavailable"))
      throw new Error("Unavailable");
    calls.push(cmd);
  }
  if (cmd === "set_writing_profile") calls.push(JSON.stringify(args.profile));
  if (cmd === "get_transcript_workspace") return structuredClone(state);
  if (cmd === "save_transcript_edit") {
    calls.push(cmd);
    if (new URLSearchParams(location.search).has("conflict"))
      throw new Error("Conflict");
    Object.assign(state, {
      title: args.title,
      text: args.text,
      revision: state.revision + 1,
    });
  }
  return null;
});
const { useSettingsStore } = await import("../../src/stores/settingsStore");
useSettingsStore.setState({
  isLoading: false,
  settings: { custom_words: [] },
  updateSetting: async (key, value) => {
    calls.push(key);
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, [key]: value },
    }));
  },
});
const { default: i18n } = await import("../../src/i18n");
await i18n.changeLanguage("en");
const { TranscriptWorkspace } = await import(
  "../../src/components/settings/history/TranscriptWorkspace"
);
const { WritingProfiles } = await import(
  "../../src/components/settings/WritingProfiles"
);
localStorage.setItem("handy-correction-counts", JSON.stringify({ Handy: 1 }));
createRoot(document.getElementById("root")!).render(
  <div style={{ maxWidth: 700, padding: 24 }}>
    {new URLSearchParams(location.search).has("profile") ? (
      <WritingProfiles />
    ) : (
      <TranscriptWorkspace id={1} onClose={() => calls.push("close")} />
    )}
  </div>,
);
