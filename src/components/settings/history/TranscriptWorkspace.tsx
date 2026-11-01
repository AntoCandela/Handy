import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/Button";
import { copyToClipboard } from "./clipboard";
import { correctionCandidate } from "./correctionCandidate";
interface Workspace {
  title: string;
  text: string;
  revision: number;
  originals: string[];
}
export function TranscriptWorkspace({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const [loaded, setLoaded] = useState<Workspace | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    invoke<Workspace>("get_transcript_workspace", { id })
      .then((data) => {
        if (active) {
          setLoaded(data);
          setDraftRevision(data.revision);
          setTitle(data.title);
          setText(data.text);
          try {
            const draft = JSON.parse(
              localStorage.getItem(`handy-transcript-draft-${id}`) || "null",
            );
            if (
              draft &&
              typeof draft.title === "string" &&
              typeof draft.text === "string" &&
              Number.isSafeInteger(draft.revision)
            ) {
              setTitle(draft.title);
              setText(draft.text);
              setDraftRevision(draft.revision);
              if (draft.revision !== data.revision) setError(true);
            }
          } catch {
            /* An unreadable draft does not prevent opening the saved transcript. */
          }
        }
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [id]);
  const dirty = loaded && (text !== loaded.text || title !== loaded.title);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (dirty)
        localStorage.setItem(
          `handy-transcript-draft-${id}`,
          JSON.stringify({ title, text, revision: draftRevision }),
        );
      else localStorage.removeItem(`handy-transcript-draft-${id}`);
    } catch {
      /* The saved database version is still safe. */
    }
  }, [id, loaded, title, text, dirty, draftRevision]);
  const save = async () => {
    if (!loaded || busy || draftRevision !== loaded.revision) return;
    setBusy(true);
    setError(false);
    try {
      await invoke("save_transcript_edit", {
        id,
        title,
        text,
        expected: loaded.revision,
      });
      const word = correctionCandidate(loaded.text, text);
      if (word) {
        try {
          const counts: Record<string, number> = JSON.parse(
            localStorage.getItem("handy-correction-counts") || "{}",
          );
          counts[word] =
            (typeof counts[word] === "number" ? counts[word] : 0) + 1;
          localStorage.setItem(
            "handy-correction-counts",
            JSON.stringify(counts),
          );
          if (
            counts[word] >= 2 &&
            !(getSetting("custom_words") || []).includes(word)
          )
            setSuggestion(word);
        } catch {
          /* Vocabulary suggestions never prevent saving a transcript. */
        }
      }
      setLoaded({ ...loaded, title, text, revision: loaded.revision + 1 });
      setDraftRevision(loaded.revision + 1);
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="space-y-3 rounded-lg border border-logo-primary/30 p-3"
      aria-label={t("workspace.title")}
    >
      {error && (
        <p role="alert" className="text-sm text-error">
          {t(
            loaded && draftRevision !== loaded.revision
              ? "workspace.conflict"
              : "workspace.error",
          )}
        </p>
      )}
      {loaded && (
        <>
          <label className="block text-xs">
            {t("workspace.name")}
            <input
              className="mt-1 w-full rounded border border-line bg-background p-2 text-sm"
              maxLength={200}
              value={title}
              disabled={busy}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label className="block text-xs">
            {t("workspace.transcript")}
            <textarea
              className="mt-1 min-h-40 w-full resize-y rounded border border-line bg-background p-2 text-sm leading-relaxed"
              value={text}
              disabled={busy}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <p className="text-xs text-ink-2">{t("workspace.preserved")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={
                busy ||
                !dirty ||
                !title.trim() ||
                draftRevision !== loaded.revision
              }
              onClick={() => void save()}
            >
              {t("workspace.save")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void copyToClipboard(text).then((ok) => {
                  if (!ok) setError(true);
                })
              }
            >
              {t("settings.history.copy")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const blob = new Blob([text], {
                  type: "text/plain;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${title.replace(/[<>:"/\\|?*]/g, "_").slice(0, 100) || "transcript"}.txt`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              {t("workspace.export")}
            </Button>
          </div>
          {saved && (
            <p role="status" className="text-xs text-logo-primary">
              {t("workspace.saved")}
            </p>
          )}
          {suggestion && (
            <div className="space-y-2 rounded bg-wash p-3 text-sm">
              <p>{t("workspace.suggestion", { word: suggestion })}</p>
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await updateSetting("custom_words", [
                      ...new Set([
                        ...(getSetting("custom_words") || []),
                        suggestion,
                      ]),
                    ]);
                    if ((getSetting("custom_words") || []).includes(suggestion))
                      setSuggestion("");
                    else setError(true);
                  } catch {
                    setError(true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("workspace.approve")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSuggestion("")}
              >
                {t("workspace.dismiss")}
              </Button>
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-xs text-ink-2">
              {t("workspace.originals")}
            </summary>
            {loaded.originals.map((original, index) => (
              <p
                key={index}
                className="mt-2 whitespace-pre-wrap rounded bg-wash p-3 text-sm"
              >
                {original}
              </p>
            ))}
          </details>
        </>
      )}
      {!loaded && !error && (
        <p role="status">{t("settings.history.loading")}</p>
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || !!dirty}
        onClick={onClose}
      >
        {t("workspace.close")}
      </Button>
      {dirty && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (loaded) {
              setTitle(loaded.title);
              setText(loaded.text);
              setDraftRevision(loaded.revision);
              setError(false);
            }
          }}
        >
          {t("workspace.discard")}
        </Button>
      )}
    </div>
  );
}
