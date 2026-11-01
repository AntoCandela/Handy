import { AppearanceSettings } from "../AppearanceSettings";
import { WritingProfiles } from "../WritingProfiles";
import React from "react";
import { useTranslation } from "react-i18next";
import { type } from "@tauri-apps/plugin-os";
import { MicrophoneSelector } from "../MicrophoneSelector";
import { ChannelSelector } from "../ChannelSelector";
import { ShortcutInput } from "../ShortcutInput";
import { SettingsSection as SettingsGroup } from "../SettingsSection";
import { Keyboard, Languages, Mic, Volume2 } from "lucide-react";
import { OutputDeviceSelector } from "../OutputDeviceSelector";
import { ShortcutActivationSetting } from "../ShortcutActivation";
import { AudioFeedback } from "../AudioFeedback";
import { useSettings } from "../../../hooks/useSettings";
import { VolumeSlider } from "../VolumeSlider";
import { MuteWhileRecording } from "../MuteWhileRecording";
import { ModelSettingsCard } from "./ModelSettingsCard";
import { PreferredLanguages } from "../PreferredLanguages";
import { ChineseScriptSetting } from "../ChineseScript";
import { isChinese } from "@/lib/utils/languageSuggestions";

export const GeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const { audioFeedbackEnabled, getSetting } = useSettings();
  const isLinux = type() === "linux";
  // Only for Chinese speakers, or anyone who already picked a script.
  const speaksChinese =
    (getSetting("spoken_languages") ?? []).some(isChinese) ||
    (getSetting("chinese_script") ?? "as_transcribed") !== "as_transcribed";
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <header className="px-1">
        <h1 className="text-xl font-semibold">{t("settings.general.title")}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {t("settings.refresh.generalIntro")}
        </p>
      </header>
      <SettingsGroup
        icon={Keyboard}
        title={t("settings.refresh.shortcuts")}
        description={t("settings.refresh.shortcutsDescription")}
      >
        <ShortcutInput shortcutId="transcribe" grouped={true} />
        <ShortcutActivationSetting descriptionMode="tooltip" grouped={true} />
        {/* Cancel shortcut remains hidden on Linux because of dynamic shortcut instability. */}
        {!isLinux && <ShortcutInput shortcutId="cancel" grouped={true} />}
      </SettingsGroup>
      <SettingsGroup
        icon={Languages}
        title={t("settings.languages.title")}
        description={t("settings.refresh.languagesDescription")}
      >
        <PreferredLanguages descriptionMode="tooltip" grouped={true} />
        {speaksChinese && (
          <ChineseScriptSetting descriptionMode="tooltip" grouped={true} />
        )}
      </SettingsGroup>
      <AppearanceSettings />
      <ModelSettingsCard />
      <WritingProfiles />
      <SettingsGroup
        icon={Mic}
        title={t("settings.refresh.microphone")}
        description={t("settings.refresh.microphoneDescription")}
      >
        <MicrophoneSelector descriptionMode="tooltip" grouped={true} />
        <ChannelSelector descriptionMode="tooltip" grouped={true} />
        <MuteWhileRecording descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
      <SettingsGroup
        icon={Volume2}
        title={t("settings.refresh.feedback")}
        description={t("settings.refresh.feedbackDescription")}
      >
        <AudioFeedback descriptionMode="tooltip" grouped={true} />
        {!audioFeedbackEnabled && (
          <p className="px-4 py-2 text-xs text-ink-2 bg-wash/30">
            {t("settings.refresh.feedbackOff")}
          </p>
        )}
        <OutputDeviceSelector
          descriptionMode="tooltip"
          grouped={true}
          disabled={!audioFeedbackEnabled}
        />
        <VolumeSlider disabled={!audioFeedbackEnabled} />
      </SettingsGroup>
    </div>
  );
};
