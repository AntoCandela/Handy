import { TranscriptWorkspace } from "./TranscriptWorkspace";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { Check, Copy, FilePlus, FolderOpen, Star, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { commands, events, type HistoryEntry } from "@/bindings";
import { useOsType } from "@/hooks/useOsType";
import {
  useTranscriptionJobsStore,
  type ActiveJobStatus,
} from "@/stores/transcriptionJobsStore";
import { formatDate, formatDateTime } from "@/utils/dateFormat";
import { AudioPlayer, AudioPlayerGroup } from "../../ui/AudioPlayer";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { copyToClipboard } from "./clipboard";
import { pickAndTranscribeFiles } from "./transcribeFiles";
import {
  dayKey,
  durationLabel,
  finalTranscript,
  rangeStart,
  type HistoryRange,
  type HistoryRow,
} from "./historyView";

interface SearchPage {
  entries: { entry: HistoryEntry; duration_seconds: number | null }[];
  has_more: boolean;
}
const PAGE_SIZE = 30;

export const HistorySettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const osType = useOsType();
  const jobs = useTranscriptionJobsStore((state) => state.jobs);
  const [entries, setEntries] = useState<HistoryRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [range, setRange] = useState<HistoryRange>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(
    async (cursor: number | null = null) => {
      if (cursor !== null && busy.current) return;
      if (cursor === null) {
        generation.current++;
        setLoading(true);
        setEntries([]);
      } else setLoadingMore(true);
      const request = generation.current;
      busy.current = true;
      setError(false);
      try {
        const page = await invoke<SearchPage>("search_history_entries", {
          cursor,
          limit: PAGE_SIZE,
          query,
          savedOnly,
          since: rangeStart(range),
        });
        if (request !== generation.current) return;
        const rows = page.entries.map(({ entry, duration_seconds }) => ({
          ...entry,
          duration_seconds,
        }));
        setEntries((previous) =>
          cursor === null
            ? rows
            : [
                ...previous,
                ...rows.filter(
                  (row) => !previous.some((existing) => existing.id === row.id),
                ),
              ],
        );
        setHasMore(page.has_more);
      } catch (failure) {
        if (request !== generation.current) return;
        console.error("Failed to search history", failure);
        setError(true);
      } finally {
        if (request === generation.current) {
          busy.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, savedOnly, range],
  );

  useEffect(() => {
    void loadPage();
    return () => {
      generation.current++;
      busy.current = false;
    };
  }, [loadPage, refresh]);

  useEffect(() => {
    const unlisten = events.historyUpdatePayload.listen(reload);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [reload]);

  const getAudioUrl = useCallback(
    async (fileName: string) => {
      const result = await commands.getAudioFilePath(fileName);
      if (result.status !== "ok") throw new Error(String(result.error));
      if (osType === "linux") {
        const data = await readFile(result.data);
        return URL.createObjectURL(new Blob([data], { type: "audio/wav" }));
      }
      return convertFileSrc(result.data, "asset");
    },
    [osType],
  );

  const groupLabel = (timestamp: number) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const key = dayKey(timestamp);
    if (key === dayKey(today.getTime() / 1000))
      return t("settings.history.today");
    if (key === dayKey(yesterday.getTime() / 1000))
      return t("settings.history.yesterday");
    return formatDate(String(timestamp), i18n.language);
  };

  return (
    <section
      className="max-w-3xl w-full mx-auto space-y-4"
      aria-label={t("settings.history.title")}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("settings.history.title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="inline-flex items-center gap-2"
            onClick={() => {
              void pickAndTranscribeFiles().catch(() =>
                toast.error(t("settings.history.transcribeFailed")),
              );
            }}
          >
            <FilePlus size={16} aria-hidden="true" />
            <span>{t("settings.history.transcribeFile")}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="inline-flex items-center gap-2"
            onClick={() => {
              void commands
                .openRecordingsFolder()
                .then((result) => {
                  if (result.status !== "ok")
                    toast.error(t("settings.history.folderError"));
                })
                .catch(() => toast.error(t("settings.history.folderError")));
            }}
          >
            <FolderOpen size={16} aria-hidden="true" />
            <span>{t("settings.history.openFolder")}</span>
          </Button>
        </div>
      </header>
      {editingId !== null && (
        <TranscriptWorkspace
          key={editingId}
          id={editingId}
          onClose={() => {
            setEditingId(null);
            reload();
          }}
        />
      )}
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full"
        placeholder={t("settings.history.searchPlaceholder")}
        aria-label={t("settings.history.searchPlaceholder")}
      />
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={savedOnly ? "secondary" : "primary"}
          size="sm"
          aria-pressed={!savedOnly}
          onClick={() => setSavedOnly(false)}
        >
          {t("settings.history.allRecordings")}
        </Button>
        <Button
          variant={savedOnly ? "primary" : "secondary"}
          size="sm"
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly(true)}
        >
          {t("settings.history.savedRecordings")}
        </Button>
        <select
          aria-label={t("settings.history.dateFilter")}
          value={range}
          onChange={(event) => setRange(event.target.value as HistoryRange)}
          className="bg-background border border-line rounded-md px-3 py-1.5 text-sm"
        >
          <option value="all">{t("settings.history.allDates")}</option>
          <option value="today">{t("settings.history.today")}</option>
          <option value="week">{t("settings.history.lastWeek")}</option>
          <option value="month">{t("settings.history.lastMonth")}</option>
        </select>
      </div>
      <div aria-busy={loading || loadingMore} className="space-y-2">
        {loading && (
          <p className="text-sm text-ink-2 py-6" role="status">
            {t("settings.history.loading")}
          </p>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-3 text-sm">
            <span>{t("settings.history.loadError")}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void loadPage(entries[entries.length - 1]?.id ?? null)
              }
            >
              {t("settings.history.tryAgain")}
            </Button>
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="py-8 text-sm text-ink-2">
            {t(
              query || savedOnly || range !== "all"
                ? "settings.history.noMatches"
                : "settings.history.empty",
            )}
          </p>
        )}
        <AudioPlayerGroup>
          {entries.map((entry, index) => (
            <React.Fragment key={entry.id}>
              {(index === 0 ||
                dayKey(entries[index - 1].timestamp) !==
                  dayKey(entry.timestamp)) && (
                <h3 className="pt-4 pb-1 text-xs font-semibold text-ink-2">
                  {groupLabel(entry.timestamp)}
                </h3>
              )}
              <HistoryRowCard
                entry={entry}
                onEdit={() => {
                  if (editingId === null) setEditingId(entry.id);
                }}
                editorOpen={editingId !== null}
                job={jobs[entry.id]}
                getAudioUrl={getAudioUrl}
                onChanged={reload}
              />
            </React.Fragment>
          ))}
        </AudioPlayerGroup>
        {!loading && hasMore && !error && (
          <Button
            variant="secondary"
            size="sm"
            disabled={loadingMore}
            onClick={() =>
              void loadPage(entries[entries.length - 1]?.id ?? null)
            }
          >
            {t(
              loadingMore
                ? "settings.history.loading"
                : "settings.history.loadMore",
            )}
          </Button>
        )}
      </div>
    </section>
  );
};

interface RowProps {
  onEdit: () => void;
  editorOpen: boolean;
  entry: HistoryRow;
  job?: ActiveJobStatus;
  getAudioUrl: (fileName: string) => Promise<string>;
  onChanged: () => void;
}

const HistoryRowCard: React.FC<RowProps> = ({
  entry,
  onEdit,
  editorOpen,
  job,
  getAudioUrl,
  onChanged,
}) => {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [original, setOriginal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"delete" | "retry" | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  useEffect(() => {
    if (!job) setCancelling(false);
  }, [job]);
  const final = finalTranscript(entry);
  const hasFinal =
    entry.post_processed_text !== null &&
    entry.post_processed_text !== entry.transcription_text;
  const text = original ? entry.transcription_text : final;
  const label =
    job?.state === "queued"
      ? t("settings.history.waiting")
      : job?.state === "running" && job.percent > 0
        ? t("settings.history.transcribingPercent", { percent: job.percent })
        : t("settings.history.transcribing");
  const loadAudio = useCallback(
    () => getAudioUrl(entry.file_name),
    [getAudioUrl, entry.file_name],
  );
  const run = async (action: () => Promise<unknown>, errorKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(t(errorKey));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (await copyToClipboard(text)) {
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } else toast.error(t("settings.history.copyError"));
  };
  const toggleSaved = () =>
    run(async () => {
      const result = await commands.toggleHistoryEntrySaved(entry.id);
      if (result.status !== "ok") throw new Error(String(result.error));
      onChanged();
    }, "settings.history.saveError");
  const confirm = () =>
    run(
      async () => {
        if (confirmation === "delete") {
          const result = await commands.deleteHistoryEntry(entry.id);
          if (result.status !== "ok") throw new Error(String(result.error));
          try {
            localStorage.removeItem(`handy-transcript-draft-${entry.id}`);
          } catch {
            /* Entry is already removed from history. */
          }
          onChanged();
        } else await commands.retryHistoryEntryTranscription(entry.id);
        setConfirmation(null);
      },
      confirmation === "delete"
        ? "settings.history.deleteError"
        : "settings.history.transcribeFailed",
    );

  return (
    <article className="border border-line rounded-lg bg-background p-4 space-y-3">
      <h3 className="text-sm font-semibold">{entry.title}</h3>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="text-xs text-ink-2 flex flex-wrap items-center gap-2 min-w-0">
          <time
            dateTime={new Date(entry.timestamp * 1000).toISOString()}
            title={formatDateTime(String(entry.timestamp), i18n.language)}
          >
            {new Intl.DateTimeFormat(i18n.language, {
              hour: "numeric",
              minute: "2-digit",
            }).format(entry.timestamp * 1000)}
          </time>
          <span>
            {entry.duration_seconds === null
              ? t("settings.history.durationUnknown")
              : durationLabel(entry.duration_seconds)}
          </span>
          {hasFinal && (
            <span className="rounded bg-wash px-2 py-0.5">
              {t("settings.history.corrected")}
            </span>
          )}
          {entry.source_name && (
            <span className="truncate max-w-60" title={entry.source_name}>
              {entry.source_name}
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!!job || !text.length}
            className="inline-flex items-center gap-1 text-xs disabled:opacity-40 hover:text-logo-primary"
            aria-label={t(
              original
                ? "settings.history.copyOriginal"
                : "settings.history.copyToClipboard",
            )}
          >
            {copied ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}
            <span>
              {t(copied ? "settings.history.copied" : "settings.history.copy")}
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={entry.saved}
            onClick={() => void toggleSaved()}
            title={t(
              entry.saved ? "settings.history.unsave" : "settings.history.save",
            )}
            aria-label={t(
              entry.saved ? "settings.history.unsave" : "settings.history.save",
            )}
            className={
              entry.saved
                ? "text-logo-primary"
                : "text-ink-2 hover:text-logo-primary"
            }
          >
            <Star size={17} fill={entry.saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <p
        className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-2"} ${job ? "text-ink-2" : "text-text"}`}
      >
        {job
          ? label
          : text ||
            t(
              hasFinal
                ? "settings.history.emptyTranscript"
                : entry.source_name
                  ? "settings.history.notTranscribed"
                  : "settings.history.transcriptionFailed",
            )}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="text-xs text-ink-2 hover:text-logo-primary"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {t(
            expanded
              ? "settings.history.closeTranscript"
              : "settings.history.openTranscript",
          )}
        </button>
        {job ? (
          <button
            type="button"
            disabled={cancelling}
            className="text-xs flex gap-1 items-center"
            onClick={() => {
              setCancelling(true);
              void commands
                .cancelHistoryEntryTranscription(entry.id)
                .catch(() => {
                  setCancelling(false);
                  toast.error(t("settings.history.transcribeFailed"));
                });
            }}
          >
            <X size={14} />
            {t("settings.history.cancelTranscription")}
          </button>
        ) : (
          <details className="text-xs text-ink-2">
            <summary className="cursor-pointer hover:text-logo-primary">
              {t("settings.history.moreActions")}
            </summary>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmation("retry")}
              >
                {t("settings.history.retranscribe")}
              </button>
              <button
                type="button"
                disabled={busy || editorOpen}
                onClick={() => setConfirmation("delete")}
              >
                {t("settings.history.delete")}
              </button>
            </div>
          </details>
        )}
      </div>
      {confirmation && (
        <div
          role="alert"
          className="rounded-md border border-line p-3 text-sm space-y-2"
        >
          <p>
            {t(
              confirmation === "delete"
                ? "settings.history.confirmDelete"
                : hasFinal
                  ? "settings.history.confirmRetryCorrected"
                  : "settings.history.confirmRetry",
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || (editorOpen && confirmation === "delete")}
              onClick={() => void confirm()}
            >
              {t(
                confirmation === "delete"
                  ? "settings.history.delete"
                  : "settings.history.retranscribe",
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              {t("tray.cancel")}
            </Button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="border-t border-line pt-3 space-y-3">
          {!job && !editorOpen && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              {t("workspace.title")}
            </Button>
          )}
          {hasFinal && (
            <button
              type="button"
              className="text-xs text-logo-primary"
              aria-pressed={original}
              onClick={() => setOriginal((value) => !value)}
            >
              {t(
                original
                  ? "settings.history.viewFinal"
                  : "settings.history.viewOriginal",
              )}
            </button>
          )}
          <AudioPlayer
            onLoadRequest={loadAudio}
            knownDuration={entry.duration_seconds}
            className="w-full"
          />
        </div>
      )}
    </article>
  );
};
