import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Radio } from "@/components/ui/Radio";
import { Button } from "@/components/ui/Button";
import { Radio as LiveIcon, HardDrive } from "lucide-react";
import type { ModelInfo } from "@/bindings";
import { formatModelSize } from "@/lib/utils/format";
import {
  getTranslatedModelName,
  getTranslatedModelDescription,
} from "../../lib/utils/modelTranslation";
interface ModelDropdownProps {
  models: ModelInfo[];
  currentModelId: string;
  locked?: boolean;
  onModelSelect: (modelId: string) => void;
}
const ModelDropdown: React.FC<ModelDropdownProps> = ({
  models,
  currentModelId,
  locked = false,
  onModelSelect,
}) => {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const downloadedModels = models.filter((model) => model.is_downloaded);
  useEffect(() => {
    const selected = panel.current?.querySelector<HTMLButtonElement>(
      'button[aria-pressed="true"]:not(:disabled)',
    );
    (
      selected ||
      panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    )?.focus();
  }, []);
  return (
    <div
      ref={panel}
      className="absolute bottom-full start-0 mb-2 w-80 max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto bg-background border border-line rounded-xl shadow-lg z-50"
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        const buttons = Array.from(
          panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        if (!buttons.length) return;
        event.preventDefault();
        const current = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (current +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  buttons.length) %
                buttons.length;
        buttons[next].focus();
      }}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 text-xs font-medium text-ink-2">
        <HardDrive size={14} aria-hidden="true" />
        {t("settings.models.installedCount", {
          count: downloadedModels.length,
        })}
      </div>
      {locked && (
        <p className="px-3 py-2 text-xs text-ink-2" role="status">
          {t("modelSelector.lockedWhileTranscribing")}
        </p>
      )}
      <div className="p-1.5 space-y-1">
        {downloadedModels.map((model) => (
          <Button
            key={model.id}
            variant="ghost"
            size="sm"
            disabled={locked}
            aria-pressed={model.id === currentModelId}
            onClick={() => {
              if (!locked) onModelSelect(model.id);
            }}
            className={`w-full !p-3 text-start focus-visible:ring-2 focus-visible:ring-logo-primary ${model.id === currentModelId ? "bg-logo-primary/10" : ""}`}
          >
            <span className="flex items-start gap-2.5">
              <span className="mt-0.5">
                <Radio checked={model.id === currentModelId} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-text">
                  {getTranslatedModelName(model, t)}
                </span>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-2">
                  {getTranslatedModelDescription(model, t)}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-normal text-ink-2">
                  {model.supports_streaming && (
                    <span className="inline-flex items-center gap-1 rounded bg-logo-primary/10 px-1.5 py-0.5 text-logo-primary">
                      <LiveIcon size={11} aria-hidden="true" />
                      {t("settings.models.liveText")}
                    </span>
                  )}
                  {model.is_custom && <span>{t("modelSelector.custom")}</span>}
                  <span>{formatModelSize(model.size_mb)}</span>
                  {model.id === currentModelId && (
                    <span className="ms-auto font-medium text-logo-primary">
                      {t("modelSelector.selected")}
                    </span>
                  )}
                </span>
              </span>
            </span>
          </Button>
        ))}
        {!downloadedModels.length && (
          <p className="p-3 text-sm text-ink-2">
            {t("modelSelector.noModelsAvailable")}
          </p>
        )}
      </div>
    </div>
  );
};
export default ModelDropdown;
