import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, MoreHorizontal, Trash2, X } from "lucide-react";
import { DownloadMark } from "@/components/shared/DownloadMark";
import { Radio } from "@/components/ui/Radio";
import { Button } from "@/components/ui/Button";
import { ModelTableRow } from "@/components/shared/modelTable/ModelTableRow";
import { formatModelSize } from "@/lib/utils/format";
import { useModelStore } from "@/stores/modelStore";
import { useModelsLocked } from "@/stores/transcriptionJobsStore";
import {
  cancelDownload,
  pickModel,
  useIsTarget,
  usePlace,
  type Entry,
} from "./modelEntries";

/** A Models page row: the shared table row plus use, stop and delete. */
export const ModelRow: React.FC<{ entry: Entry }> = ({ entry }) => {
  const { t } = useTranslation();
  const place = usePlace(entry.id);
  const target = useIsTarget(entry.id);
  const locked = useModelsLocked();
  const percent = useModelStore(
    (s) => s.downloadProgress[entry.id]?.percentage ?? 0,
  );
  const [asking, setAsking] = useState(false);
  // Pressed while locked: this row says why nothing happened.
  const [told, setTold] = useState(false);
  const askRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!locked) setTold(false);
  }, [locked]);

  useEffect(() => {
    if (asking) askRef.current?.querySelector("button")?.focus();
  }, [asking]);

  const onDisk = place === "active" || place === "ready" || place === "loading";
  const on = place === "active";
  // While History transcribes, the model in use can't change or go away.
  const deletable = onDisk && !(locked && on);
  const inert = locked && place === "ready";
  const size = formatModelSize(entry.sizeMb);
  const download =
    place === "downloading" || place === "checking"
      ? { state: place, percent }
      : null;

  const mark = (() => {
    switch (place) {
      case "active":
        return <Radio checked />;
      case "ready":
        return <Radio checked={false} />;
      case "loading":
        return (
          <Loader2
            className="size-[18px] animate-spin text-ink-3"
            aria-hidden="true"
          />
        );
      case "remote":
        return <DownloadMark />;
      default:
        return null;
    }
  })();

  // Page-only states; the table handles downloads, custom and old models.
  const line = asking ? (
    <span className="text-text">
      {t(on ? "settings.models.deleteAskActive" : "settings.models.deleteAsk", {
        name: entry.name,
        size,
      })}
    </span>
  ) : (locked && on) || (told && inert) ? (
    t("modelSelector.lockedWhileTranscribing")
  ) : place === "loading" ? (
    t("settings.models.loading")
  ) : place === "downloading" && target && !locked ? (
    <span className="tabular-nums">
      {t("settings.models.downloadingThenUse", {
        percent: Math.round(percent),
        total: size,
      })}
    </span>
  ) : undefined;

  // Pressing a download makes it the one to switch to when it's done.
  const act = () => {
    if (asking || on || place === "loading") return;
    if (inert) {
      setTold(true);
      return;
    }
    pickModel(entry.id);
  };

  const slotClass =
    "grid size-[24px] cursor-pointer place-items-center rounded-[7px] text-ink-3 hover:bg-line hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-logo-primary";
  const slot = (() => {
    if (download) {
      const label = t("settings.models.cancelDownload", { name: entry.name });
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cancelDownload(entry.id);
          }}
          title={label}
          aria-label={label}
          className={slotClass}
        >
          <X className="size-[14px]" aria-hidden="true" />
        </button>
      );
    }
    if (deletable) {
      const label = t("settings.models.deleteModel", { name: entry.name });
      return (
        <details className="relative" onClick={(e) => e.stopPropagation()}>
          <summary
            aria-label={t("settings.models.moreActions", { name: entry.name })}
            className={`${slotClass} list-none [&::-webkit-details-marker]:hidden`}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </summary>
          <button
            type="button"
            className="absolute end-0 top-full z-10 flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-background p-3 text-xs shadow-lg"
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              setAsking(true);
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            {label}
          </button>
        </details>
      );
    }
    // Where the trash was: the reason it's gone.
    if (locked && on)
      return <Lock className="size-[13px] text-ink-3" aria-hidden="true" />;
    return <span />;
  })();

  const ask = asking && (
    <span
      ref={askRef}
      className="col-span-2 flex items-center justify-end gap-[6px]"
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setAsking(false);
        }}
      >
        {t("settings.models.cancel")}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setAsking(false);
          void useModelStore.getState().deleteModel(entry.id);
        }}
      >
        {t("common.delete")}
      </Button>
    </span>
  );

  return (
    <ModelTableRow
      entry={entry}
      selected={on}
      mark={mark}
      download={download}
      line={line}
      details={
        !asking && (
          <span className="mt-2 flex max-w-full flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 ${entry.streaming ? "bg-logo-primary/10 text-logo-primary" : "bg-wash text-ink-2"}`}
            >
              {t(
                entry.streaming
                  ? "settings.models.liveText"
                  : "settings.models.afterRecording",
              )}
            </span>
            {entry.translate && (
              <span className="text-ink-2">
                {t("modelTable.tags.translate")}
              </span>
            )}
            {(place === "ready" || place === "remote") && (
              <button
                type="button"
                disabled={inert}
                onClick={(e) => {
                  e.stopPropagation();
                  act();
                }}
                className="rounded-md border border-line px-2 py-0.5 font-medium hover:border-logo-primary/40 hover:bg-logo-primary/10 disabled:opacity-40"
              >
                {t(
                  place === "remote"
                    ? locked
                      ? "settings.models.download"
                      : "settings.models.downloadAndUse"
                    : "settings.models.useModel",
                )}
              </button>
            )}
            {on && (
              <span className="font-medium text-logo-primary">
                {t("settings.models.selectedLabel")}
              </span>
            )}
          </span>
        )
      }
      slot={slot}
      tail={ask || undefined}
      inert={inert}
      onDisk={onDisk}
      onActivate={act}
      onKeyDown={(e) => {
        // Escape closes the delete question from its buttons too.
        if (e.key === "Escape" && asking) {
          e.preventDefault();
          e.stopPropagation();
          setAsking(false);
          (e.currentTarget as HTMLElement).focus();
          return;
        }
        if (e.target !== e.currentTarget) return;
        if ((e.key === "Delete" || e.key === "Backspace") && deletable) {
          e.preventDefault();
          setAsking(true);
        }
      }}
      hint={place === "remote" ? t("settings.models.download") : undefined}
    />
  );
};
