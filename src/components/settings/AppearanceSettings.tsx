import { ThemePreview } from "./ThemePreview";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Palette, Check } from "lucide-react";
import { SettingsSection } from "./SettingsSection";
import { ThemeSelector } from "./ThemeSelector";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import "./AppearanceSettings.css";
import { Button } from "../ui/Button";
import {
  presets,
  accents,
  readAppearance,
  saveAppearance,
  defaultAppearance,
  type Appearance,
} from "@/lib/utils/appearance";
export function AppearanceSettings() {
  const { t } = useTranslation();
  const [value, setValue] = useState(readAppearance);
  const [error, setError] = useState(false);
  const change = async (next: Appearance) => {
    setError(false);
    try {
      await saveAppearance(next);
      setValue(next);
    } catch {
      setError(true);
    }
  };
  return (
    <SettingsSection
      icon={Palette}
      title={t("appearance.title")}
      description={t("appearance.description")}
    >
      <ThemeSelector grouped />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={value.preset === preset}
              aria-label={t(`appearance.presets.${preset}`)}
              onClick={() => void change({ ...value, preset })}
              className={`appearance-choice border rounded-lg p-3 text-left ${value.preset === preset ? "border-logo-primary bg-wash" : "border-line"}`}
            >
              <ThemePreview preset={preset} accent={value.accent} />
              <span className="mt-3 flex items-center justify-between gap-2 text-sm font-medium">
                {t(`appearance.presets.${preset}`)}
                {value.preset === preset && (
                  <Check
                    size={15}
                    className="text-logo-primary"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="mt-1 block text-xs text-ink-2">
                {t(`appearance.descriptions.${preset}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <SettingContainer
        grouped
        title={t("appearance.accent")}
        description={t("appearance.accentDescription")}
      >
        <Dropdown
          selectedValue={value.accent}
          options={accents.map((accent) => ({
            value: accent,
            label: t(`appearance.accents.${accent}`),
          }))}
          onSelect={(accent) =>
            void change({ ...value, accent: accent as Appearance["accent"] })
          }
        />
      </SettingContainer>
      <SettingContainer
        grouped
        title={t("appearance.textSize")}
        description={t("appearance.sizeDescription")}
      >
        <Dropdown
          selectedValue={value.size}
          options={["normal", "large"].map((size) => ({
            value: size,
            label: t(`appearance.sizes.${size}`),
          }))}
          onSelect={(size) =>
            void change({ ...value, size: size as Appearance["size"] })
          }
        />
      </SettingContainer>
      <div className="p-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void change({ ...defaultAppearance })}
        >
          {t("appearance.reset")}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-error">
            {t("appearance.error")}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
