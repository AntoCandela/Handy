import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getName, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AudioLines,
  ExternalLink,
  FolderOpen,
  Github,
  Heart,
  Palette,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsSection } from "../SettingsSection";
import { AppDataDirectory } from "../AppDataDirectory";
import { AppLanguageSelector } from "../AppLanguageSelector";
import { ShowWhatsNewOnUpdate } from "../ShowWhatsNewOnUpdate";
import { ThemeSelector } from "../ThemeSelector";
import { LogDirectory } from "../debug";

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [name, setName] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getName(), getVersion()]).then(
      ([appName, appVersion]) => {
        if (!active) return;
        if (appName.status === "fulfilled") setName(appName.value);
        if (appVersion.status === "fulfilled") setVersion(appVersion.value);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const openProjectLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error("Failed to open project link:", error);
      toast.error(t("settings.about.refresh.linkError"));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="px-1 text-xl font-semibold">
        {t("settings.about.title")}
      </h1>
      <section
        aria-label={t("settings.about.refresh.appDetails")}
        className="rounded-xl border border-logo-primary/30 bg-logo-primary/10 p-5"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-logo-primary/15 text-logo-primary">
            <AudioLines size={30} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-2xl font-semibold">
              {name || t("settings.about.refresh.appName")}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {t("settings.about.refresh.tagline")}
            </p>
          </div>
          <span
            role="status"
            className="rounded-full border border-logo-primary/20 bg-background px-3 py-1.5 text-xs tabular-nums"
          >
            {loading
              ? t("settings.about.refresh.loadingVersion")
              : version
                ? t("settings.about.refresh.versionLabel", { version })
                : t("settings.about.refresh.versionUnavailable")}
          </span>
        </div>
      </section>

      <SettingsSection
        icon={Palette}
        title={t("settings.about.refresh.preferences")}
        description={t("settings.about.refresh.preferencesDescription")}
      >
        <AppLanguageSelector descriptionMode="tooltip" grouped />
        <ThemeSelector descriptionMode="tooltip" grouped />
        <ShowWhatsNewOnUpdate descriptionMode="tooltip" grouped />
      </SettingsSection>

      <section
        aria-label={t("settings.about.refresh.projectLinks")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <button
          type="button"
          onClick={() =>
            void openProjectLink("https://github.com/cjpais/Handy")
          }
          className="group flex items-start gap-3 rounded-xl border border-line bg-background p-4 text-start transition-colors hover:border-logo-primary/40 hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-logo-primary"
        >
          <Github
            size={20}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ink-2"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {t("settings.about.sourceCode.title")}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-2">
              {t("settings.about.sourceCode.description")}
            </span>
            <span className="mt-3 block text-xs font-medium text-logo-primary">
              {t("settings.about.sourceCode.button")}
            </span>
          </span>
          <ExternalLink
            size={14}
            aria-hidden="true"
            className="shrink-0 text-ink-3"
          />
        </button>
        <button
          type="button"
          onClick={() => void openProjectLink("https://handy.computer/donate")}
          className="group flex items-start gap-3 rounded-xl border border-line bg-background p-4 text-start transition-colors hover:border-logo-primary/40 hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-logo-primary"
        >
          <Heart
            size={20}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-logo-primary"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {t("settings.about.supportDevelopment.title")}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-2">
              {t("settings.about.supportDevelopment.description")}
            </span>
            <span className="mt-3 block text-xs font-medium text-logo-primary">
              {t("settings.about.supportDevelopment.button")}
            </span>
          </span>
          <ExternalLink
            size={14}
            aria-hidden="true"
            className="shrink-0 text-ink-3"
          />
        </button>
      </section>

      <SettingsSection
        icon={FolderOpen}
        title={t("settings.about.refresh.storage")}
        description={t("settings.about.refresh.storageDescription")}
      >
        <AppDataDirectory descriptionMode="tooltip" grouped />
        <LogDirectory grouped />
      </SettingsSection>

      <SettingsSection
        icon={Sparkles}
        title={t("settings.about.acknowledgments.title")}
        description={t("settings.about.refresh.creditsDescription")}
      >
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">
            {t("settings.about.acknowledgments.ggml.title")}
          </h3>
          <p className="text-xs leading-relaxed text-ink-2">
            {t("settings.about.acknowledgments.ggml.description")}
          </p>
          <p className="text-sm leading-relaxed text-ink-2">
            {t("settings.about.acknowledgments.ggml.details")}
          </p>
        </div>
      </SettingsSection>
    </div>
  );
};
