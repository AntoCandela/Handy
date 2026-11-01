import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { PenLine } from "lucide-react";
import { SettingsSection } from "./SettingsSection";
import { Button } from "../ui/Button";
interface Profile {
  mode: string;
  model: string;
}
export function WritingProfiles() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [modelStatus, setModelStatus] = useState<
    "ready" | "unavailable" | null
  >(null);
  useEffect(() => {
    let active = true;
    invoke<Profile>("get_writing_profile")
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);
  return (
    <SettingsSection
      icon={PenLine}
      title={t("writingProfiles.title")}
      description={t("writingProfiles.description")}
    >
      <div className="space-y-3 p-4">
        {error && (
          <p role="alert" className="text-sm text-error">
            {t("writingProfiles.error")}
          </p>
        )}
        {profile && (
          <>
            <div className="flex flex-wrap gap-2">
              {["dictation", "cleanup", "english"].map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  disabled={busy}
                  aria-pressed={profile.mode === mode}
                  variant={profile.mode === mode ? "primary-soft" : "secondary"}
                  onClick={() => {
                    setProfile({ ...profile, mode });
                    setSaved(false);
                  }}
                >
                  {t(`writingProfiles.${mode}`)}
                </Button>
              ))}
            </div>
            <label className="block text-xs">
              {t("writingProfiles.model")}
              <input
                disabled={busy}
                className="mt-1 block w-full rounded border border-line bg-background p-2 text-sm"
                value={profile.model}
                maxLength={100}
                onChange={(e) => {
                  setProfile({ ...profile, model: e.target.value });
                  setSaved(false);
                  setModelStatus(null);
                }}
              />
            </label>
            <p className="text-xs leading-relaxed text-ink-2">
              {t("writingProfiles.localHint")}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !profile.model.trim()}
              onClick={async () => {
                setBusy(true);
                setModelStatus(null);
                try {
                  await invoke("check_writing_model", { model: profile.model });
                  setModelStatus("ready");
                } catch {
                  setModelStatus("unavailable");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("writingProfiles.check")}
            </Button>
            {modelStatus && (
              <p role="status" className="text-xs text-ink-2">
                {t(`writingProfiles.${modelStatus}`)}
              </p>
            )}
            <Button
              size="sm"
              disabled={busy || !profile.model.trim()}
              onClick={async () => {
                setBusy(true);
                setError(false);
                try {
                  await invoke("set_writing_profile", { profile });
                  setSaved(true);
                } catch {
                  setError(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("writingProfiles.apply")}
            </Button>
            {saved && (
              <p role="status" className="text-xs text-logo-primary">
                {t("writingProfiles.saved")}
              </p>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  );
}
