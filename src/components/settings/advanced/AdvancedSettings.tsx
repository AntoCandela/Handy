import React from "react";
import { useTranslation } from "react-i18next";
import { ShowOverlay } from "../ShowOverlay";
import { ModelUnloadTimeoutSetting } from "../ModelUnloadTimeout";
import { CustomWords } from "../CustomWords";
import { SettingsSection as SettingsGroup } from "../SettingsSection";
import {
  Power,
  PanelsTopLeft,
  Gauge,
  Clipboard,
  TextCursorInput,
  History,
  FlaskConical,
} from "lucide-react";
import { StartHidden } from "../StartHidden";
import { AutostartToggle } from "../AutostartToggle";
import { ShowTrayIcon } from "../ShowTrayIcon";
import { PasteMethodSetting } from "../PasteMethod";
import { TypingToolSetting } from "../TypingTool";
import { ClipboardHandlingSetting } from "../ClipboardHandling";
import { AutoSubmit } from "../AutoSubmit";
import { AppendTrailingSpace } from "../AppendTrailingSpace";
import { HistoryLimit } from "../HistoryLimit";
import { RecordingRetentionPeriodSelector } from "../RecordingRetentionPeriod";
import { ExperimentalToggle } from "../ExperimentalToggle";
import { useSettings } from "../../../hooks/useSettings";
import { KeyboardImplementationSelector } from "../debug/KeyboardImplementationSelector";
import { VoiceActivityDetection } from "../VoiceActivityDetection";
import { LongFormChunking } from "../LongFormChunking";
import { LanguageDetection } from "../LanguageDetection";
import { AccelerationSelector } from "../AccelerationSelector";
import { LazyStreamClose } from "../LazyStreamClose";
import { FillerWordRemoval } from "../FillerWordRemoval";
import { VadBackendSelector } from "../VadBackendSelector";

export const AdvancedSettings: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const experimentalEnabled = getSetting("experimental_enabled") || false;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <header className="px-1">
        <h1 className="text-xl font-semibold">
          {t("settings.refresh.advancedTitle")}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {t("settings.refresh.advancedIntro")}
        </p>
      </header>
      <SettingsGroup
        icon={Power}
        title={t("settings.refresh.startup")}
        description={t("settings.refresh.startupDescription")}
      >
        <StartHidden descriptionMode="tooltip" grouped={true} />
        <AutostartToggle descriptionMode="tooltip" grouped={true} />
        <ShowTrayIcon descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
      <SettingsGroup
        icon={PanelsTopLeft}
        title={t("settings.refresh.overlay")}
        description={t("settings.refresh.overlayDescription")}
      >
        <ShowOverlay descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
      <SettingsGroup
        icon={Gauge}
        title={t("settings.refresh.performance")}
        description={t("settings.refresh.performanceDescription")}
      >
        <ModelUnloadTimeoutSetting descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup
        icon={Clipboard}
        title={t("settings.advanced.groups.output")}
        description={t("settings.refresh.outputDescription")}
      >
        <PasteMethodSetting descriptionMode="tooltip" grouped={true} />
        <TypingToolSetting descriptionMode="tooltip" grouped={true} />
        <ClipboardHandlingSetting descriptionMode="tooltip" grouped={true} />
        <AutoSubmit descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup
        icon={TextCursorInput}
        title={t("settings.advanced.groups.transcription")}
        description={t("settings.refresh.transcriptionDescription")}
      >
        <VoiceActivityDetection descriptionMode="tooltip" grouped={true} />
        <LongFormChunking descriptionMode="tooltip" grouped={true} />
        <FillerWordRemoval descriptionMode="tooltip" grouped={true} />
        <CustomWords descriptionMode="tooltip" grouped />
        <AppendTrailingSpace descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup
        icon={History}
        title={t("settings.advanced.groups.history")}
        description={t("settings.refresh.historyDescription")}
      >
        <HistoryLimit descriptionMode="tooltip" grouped={true} />
        <RecordingRetentionPeriodSelector
          descriptionMode="tooltip"
          grouped={true}
        />
      </SettingsGroup>

      <SettingsGroup
        icon={FlaskConical}
        title={t("settings.advanced.groups.experimental")}
        description={t("settings.refresh.experimentalDescription")}
      >
        <ExperimentalToggle descriptionMode="tooltip" grouped={true} />
        {experimentalEnabled && (
          <React.Fragment>
            <KeyboardImplementationSelector
              descriptionMode="tooltip"
              grouped={true}
            />
            <AccelerationSelector descriptionMode="tooltip" grouped={true} />
            <LazyStreamClose descriptionMode="tooltip" grouped={true} />
            <VadBackendSelector descriptionMode="tooltip" grouped={true} />
            <LanguageDetection descriptionMode="tooltip" grouped={true} />
          </React.Fragment>
        )}
      </SettingsGroup>
    </div>
  );
};
