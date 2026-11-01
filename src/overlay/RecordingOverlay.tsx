import { Mic, Cpu } from "lucide-react";
import { LiveDraft } from "./liveDraft";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useOsType } from "@/hooks/useOsType";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import "./RecordingOverlay.css";
import { commands, events } from "@/bindings";
import type {
  StreamPhase,
  StreamPhaseEvent,
  StreamTextEvent,
  StreamWorkKind,
} from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import type { ModelStateEvent } from "@/lib/types/events";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "recording" | "streaming" | "transcribing" | "processing";
type ResizeDirection = Parameters<
  ReturnType<typeof getCurrentWindow>["startResizeDragging"]
>[0];

// Number of reactive bars in the waveform (the simple, smoothed style shared by
// every overlay form). Mic levels arrive as 16 FFT buckets; we take the first N.
const WAVE_BARS = 9;

// Only call out a model load in the Live preview once it has run this long.
// Warm loads finish in well under this (~0.2s on Apple Silicon, ~1.5s on a
// Windows CPU backend), so the common case never flashes a loading notice while
// the user is speaking; cold loads can take 40s+.
const SLOW_MODEL_LOAD_MS = 2000;

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const canAdjust = useOsType() === "windows";
  const [customLayout, setCustomLayout] = useState(false);
  const draftRef = useRef(new LiveDraft());
  const [draftText, setDraftText] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState(false);
  const [mergeError, setMergeError] = useState(false);
  const finalRef = useRef<{ id: string; raw: string; text: string } | null>(
    null,
  );
  const composingRef = useRef(false);
  const queuedRawRef = useRef<string | null>(null);
  const editBusyRef = useRef(false);
  const selectionRef = useRef<
    [number, number, "forward" | "backward" | "none"] | null
  >(null);
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  // `Stream::play()` returning does not mean hardware callbacks are flowing.
  // Stay visually in an arming state until the backend processes the first
  // actual microphone sample chunk.
  const [captureReady, setCaptureReady] = useState(false);
  // Recording starts while the model loads in the background. Say so, otherwise
  // a cold start looks like an empty Live preview that ignores speech, then a
  // hung "Transcribing..." spinner. Once recording stops, any in-flight load is
  // the wait, so the working label reflects it immediately; the Live notice
  // waits for the load to be slow so fast loads don't flash it mid-speech.
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadSlow, setModelLoadSlow] = useState(false);
  const modelLoadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Latched per Live session: once the loading notice has opened the panel, keep
  // it open after the load so it doesn't collapse and reopen when text arrives.
  const [loadNoticeShown, setLoadNoticeShown] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(WAVE_BARS).fill(0));
  const [streamText, setStreamText] = useState<StreamTextEvent>({
    committed: "",
    tentative: "",
  });
  const [phase, setPhase] = useState<StreamPhase>("listening");
  const [workKind, setWorkKind] = useState<StreamWorkKind>("transcribing");
  const [elapsed, setElapsed] = useState(0);
  const [sessionInfo, setSessionInfo] = useState({ microphone: "", model: "" });
  // Bumped on each new streaming session so the Live card remounts fresh (replays
  // the pop-in, and never animates in from the previous panel's open size).
  const [session, setSession] = useState(0);
  // Overlay placement (top vs bottom of the screen). The Live panel grows downward
  // from a top overlay (oldest line under the pill) and upward from a bottom one.
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  // True once live text overflows the cap. A top overlay fades its top edge only
  // while overflowing, so the resting first line stays crisp flush under the pill.
  const [overflowing, setOverflowing] = useState(false);

  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  // Live-text scroll-back: the text region "sticks" to the newest line while the
  // user is at the bottom; if they scroll up to read history, auto-follow pauses
  // until they scroll back down.
  const capRef = useRef<HTMLDivElement | HTMLTextAreaElement | null>(null);
  const pinnedRef = useRef(true);
  const direction = getLanguageDirection(i18n.language);

  const updateDraft = useCallback((raw: string) => {
    const el = capRef.current;
    if (el instanceof HTMLTextAreaElement && document.activeElement === el) {
      selectionRef.current = [
        el.selectionStart,
        el.selectionEnd,
        el.selectionDirection,
      ];
    }
    try {
      setDraftText(draftRef.current.update(raw));
      setMergeError(false);
      return true;
    } catch {
      setMergeError(true);
      return false;
    }
  }, []);

  const submitDraft = useCallback(async () => {
    const final = finalRef.current;
    if (!final || editBusyRef.current || composingRef.current) return;
    editBusyRef.current = true;
    setEditPending(true);
    setEditError(false);
    try {
      await invoke("submit_overlay_edit", {
        id: final.id,
        text: draftRef.current.text,
      });
    } catch {
      editBusyRef.current = false;
      setEditPending(false);
      setEditError(true);
    }
  }, []);

  const finishDraft = useCallback(() => {
    const final = finalRef.current;
    if (!final || composingRef.current) return;
    if (!updateDraft(draftRef.current.edited ? final.raw : final.text)) return;
    void submitDraft();
  }, [updateDraft, submitDraft]);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenEditor = await listen<{
        id: string;
        raw: string;
        text: string;
      }>("overlay-editor-finalize", (event) => {
        finalRef.current = event.payload;
        finishDraft();
      });
      const unlistenLayout = await listen<boolean>(
        "overlay-layout-custom",
        (event) => {
          setCustomLayout(event.payload);
        },
      );
      let showGeneration = 0;
      const unlistenShow = await listen("show-overlay", async (event) => {
        const generation = ++showGeneration;
        const overlayState = event.payload as OverlayState;
        // Reset synchronously before settings I/O. A fast microphone can emit
        // recording-ready while the awaits below are in flight; resetting after
        // them would overwrite that event and leave the overlay stuck arming.
        if (overlayState === "recording" || overlayState === "streaming") {
          draftRef.current = new LiveDraft();
          setDraftText("");
          finalRef.current = null;
          composingRef.current = false;
          queuedRawRef.current = null;
          selectionRef.current = null;
          setMergeError(false);
          editBusyRef.current = false;
          setEditPending(false);
          setEditError(false);
          setCaptureReady(false);
          setElapsed(0);
          setSessionInfo({ microphone: "", model: "" });
          smoothedLevelsRef.current = Array(16).fill(0);
          setLevels(Array(WAVE_BARS).fill(0));
          setStreamText({ committed: "", tentative: "" });
        }

        setState(overlayState);
        if (overlayState === "streaming") {
          setPhase("listening");
          setWorkKind("transcribing");
          setElapsed(0);
          setLoadNoticeShown(false);
          setSession((s) => s + 1); // remount the card fresh for this session
        }
        setIsVisible(true);
        await syncLanguageFromSettings();
        // The Live panel flows downward from a top overlay and upward from a
        // bottom one; read the placement so the layout can flip to match.
        try {
          const settings = await commands.getAppSettings();
          if (settings.status === "ok") {
            const [models, microphones] = await Promise.all([
              commands.getAvailableModels(),
              commands.getAvailableMicrophones(),
            ]);
            if (generation !== showGeneration) return;
            setSessionInfo({
              microphone:
                (settings.data.selected_microphone &&
                settings.data.selected_microphone.toLowerCase() !== "default"
                  ? settings.data.selected_microphone
                  : microphones.status === "ok"
                    ? microphones.data.find((m) => m.is_default)?.name
                    : undefined) || t("recordingExperience.defaultMicrophone"),
              model:
                models.status === "ok"
                  ? models.data.find(
                      (m) => m.id === settings.data.selected_model,
                    )?.name || ""
                  : "",
            });
            setPosition(
              settings.data.overlay_position === "top" ? "top" : "bottom",
            );
          }
        } catch {
          // Keep the previous/default placement if settings can't be read.
        }
      });

      const unlistenHide = await listen("hide-overlay", () => {
        showGeneration++;
        editBusyRef.current = false;
        finalRef.current = null;
        setEditPending(false);
        setIsVisible(false);
        setCaptureReady(false);
      });

      const unlistenReady = await listen("recording-ready", () => {
        setElapsed(0);
        setCaptureReady(true);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        // Exponential smoothing across the 16 buckets, then take the first N
        // bars for the shared waveform.
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.7 + target * 0.3;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, WAVE_BARS));
      });

      const unlistenStream = await events.streamTextEvent.listen((event) => {
        if (finalRef.current) return;
        setStreamText(event.payload);
        const raw = event.payload.committed + event.payload.tentative;
        if (composingRef.current) queuedRawRef.current = raw;
        else updateDraft(raw);
      });

      const unlistenPhase = await events.streamPhaseEvent.listen((event) => {
        const payload: StreamPhaseEvent = event.payload;
        setPhase(payload.phase);
        if (payload.kind) setWorkKind(payload.kind);
      });

      // The backend ends every `loading_started` with exactly one of completed
      // or failed, so only those end a load. Other events (e.g. `unloaded` from
      // the idle watcher) aren't ordered against an in-flight load and must not
      // clear it.
      const unlistenModel = await listen<ModelStateEvent>(
        "model-state-changed",
        (event) => {
          const type = event.payload.event_type;
          if (type === "loading_started") {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(true);
            setModelLoadSlow(false);
            modelLoadTimerRef.current = setTimeout(
              () => setModelLoadSlow(true),
              SLOW_MODEL_LOAD_MS,
            );
          } else if (
            type === "loading_completed" ||
            type === "loading_failed"
          ) {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(false);
            setModelLoadSlow(false);
          }
        },
      );

      return () => {
        unlistenEditor();
        unlistenShow();
        unlistenHide();
        unlistenReady();
        unlistenLevel();
        unlistenStream();
        unlistenPhase();
        unlistenLayout();
        unlistenModel();
        clearTimeout(modelLoadTimerRef.current);
      };
    };

    let disposed = false;
    let cleanup: (() => void) | undefined;
    void setupEventListeners().then((unlisten) => {
      if (disposed) unlisten();
      else cleanup = unlisten;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [finishDraft, updateDraft]);

  // Elapsed capture timer starts only once microphone samples are flowing.
  useEffect(() => {
    if (
      (state !== "streaming" && state !== "recording") ||
      !isVisible ||
      !captureReady ||
      (state === "streaming" && phase === "working")
    )
      return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, phase, isVisible, captureReady]);

  // Stick to the bottom as text streams in — but only while pinned, so a user who
  // has scrolled up to read history isn't yanked back down by the next chunk.
  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    // Fade the top edge only once text actually overflows the cap.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    if (el instanceof HTMLTextAreaElement && selectionRef.current) {
      el.setSelectionRange(...selectionRef.current);
      selectionRef.current = null;
    }
    if (pinnedRef.current && document.activeElement !== el)
      el.scrollTop = el.scrollHeight;
  }, [streamText, draftText]);

  // `session` re-runs this when a new Live session starts mid-load (e.g. a
  // retry during a cold load), since the reset doesn't change the other deps.
  useEffect(() => {
    if (modelLoadSlow && state === "streaming") setLoadNoticeShown(true);
  }, [modelLoadSlow, state, session]);

  // Each fresh streaming session starts pinned to the bottom, fade cleared.
  useEffect(() => {
    pinnedRef.current = true;
    setOverflowing(false);
  }, [session]);

  if (!isVisible) return null;

  // Re-pin when the user is within ~a line of the bottom; unpin otherwise.
  const handleStreamScroll = () => {
    const el = capRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const transcribingLabel = modelLoading
    ? t("overlay.loadingModel")
    : t("overlay.transcribing");

  const adjust = (event: React.MouseEvent, direction: string | null = null) => {
    if (!canAdjust || event.button !== 0) return;
    // Controls retain their own click behavior; text remains selectable.
    if (!direction && (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    void invoke("begin_overlay_adjustment")
      .then(() =>
        direction
          ? getCurrentWindow().startResizeDragging(direction as ResizeDirection)
          : getCurrentWindow().startDragging(),
      )
      .catch(console.error);
  };

  const resizeHandles = canAdjust
    ? [
        "North",
        "South",
        "East",
        "West",
        "NorthEast",
        "NorthWest",
        "SouthEast",
        "SouthWest",
      ].map((edge) => (
        <div
          key={edge}
          className={`overlay-resize overlay-resize-${edge}`}
          title={t("overlay.resize")}
          onMouseDown={(event) => adjust(event, edge)}
        />
      ))
    : null;

  // ---- Shared building blocks (one visual language for every overlay form) ----
  const waveform = (
    <div className={`swave ${captureReady ? "ready" : "arming"}`}>
      {levels.map((v, i) => (
        <i
          key={i}
          style={{
            height: `${Math.max(3, Math.min(18, 3 + Math.pow(v, 0.7) * 15))}px`,
          }}
        />
      ))}
    </div>
  );

  const cancelBtn = (
    <button
      className="sx"
      aria-label={t("tray.cancel")}
      onClick={() => commands.cancelOperation()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M4 4 L12 12 M12 4 L4 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  const microphoneLabel =
    sessionInfo.microphone.toLowerCase() === "default"
      ? t("recordingExperience.defaultMicrophone")
      : sessionInfo.microphone;
  const listeningRow = (showTimer: boolean, showCancel: boolean) => (
    <div
      className={`sbase listening-base ${canAdjust ? "overlay-drag" : ""}`}
      title={canAdjust ? t("overlay.move") : undefined}
      onMouseDown={(event) => adjust(event)}
    >
      <div className="recording-status">
        <div className="recording-heading">
          <span className={`sdot ${captureReady ? "ready" : "arming"}`} />
          <span className="recording-label" role="status">
            {t(
              captureReady
                ? "recordingExperience.listening"
                : "recordingExperience.starting",
            )}
          </span>
          {waveform}
        </div>
        <div className="recording-details">
          {microphoneLabel && (
            <span className="recording-device" title={microphoneLabel}>
              <Mic aria-hidden="true" />
              <span>{microphoneLabel}</span>
            </span>
          )}
          {sessionInfo.model && (
            <span
              className="recording-device recording-model"
              title={sessionInfo.model}
            >
              <Cpu aria-hidden="true" />
              <span>{sessionInfo.model}</span>
            </span>
          )}
        </div>
      </div>
      <div className="sbase-r">
        {showTimer && <span className="stimer">{fmtTime(elapsed)}</span>}
        {showCancel && cancelBtn}
      </div>
    </div>
  );

  // spinner (left) | label (center) | cancel (right) — same 3-zone grid as the
  // listening row, so the label is centered.
  const workingRow = (label: string, showCancel: boolean) => (
    <div
      className={`sbase ${canAdjust ? "overlay-drag" : ""}`}
      title={canAdjust ? t("overlay.move") : undefined}
      onMouseDown={(event) => adjust(event)}
    >
      <div className="sbase-l">
        <span className="sspinner" />
      </div>
      <span className="swork-label">{label}</span>
      <div className="sbase-r">{showCancel && cancelBtn}</div>
    </div>
  );

  // ---- Live overlay: a pill that sculpts open into a panel ----
  if (state === "streaming") {
    const hasText =
      draftText.length > 0 ||
      draftRef.current.edited ||
      streamText.committed.length > 0 ||
      streamText.tentative.length > 0;
    const working = phase === "working";
    // While listening, a slow model load opens the panel with a notice where the
    // text would be, so speech that isn't transcribing yet doesn't look ignored.
    const loadingNotice = modelLoadSlow && !working && !hasText;
    // Keep the panel open whenever there's text — even while finalizing — so the
    // transcript stays put under a working spinner instead of collapsing and
    // squishing the text mid-stream. Only fall back to the small working pill
    // when there was no text to preserve.
    const open = hasText || loadingNotice || (loadNoticeShown && !working);
    const collapsed = working && !hasText;

    return (
      <div dir={direction} className={`ov-stage ${position}`}>
        <div
          key={session}
          className={`scard ${customLayout && canAdjust ? "custom-layout" : ""} ${open ? "open" : ""} ${collapsed ? "working" : ""} ${
            isVisible ? "" : "leaving"
          }`}
        >
          {open && resizeHandles}
          {editError && (
            <div className="editor-error" role="alert">
              {t("overlay.editorPasteFailed")}
              <button disabled={editPending} onClick={() => void submitDraft()}>
                {t("overlay.editorPaste")}
              </button>
            </div>
          )}
          {mergeError && (
            <div className="editor-error" role="alert">
              {t("overlay.editorMergeFailed")}
            </div>
          )}
          <div className="stext">
            <div className="stext-clip">
              {canAdjust && !loadingNotice ? (
                <textarea
                  className="stext-cap live-editor"
                  ref={(element) => {
                    capRef.current = element;
                  }}
                  aria-label={t("overlay.editorText")}
                  value={draftText}
                  readOnly={editPending}
                  spellCheck
                  onScroll={handleStreamScroll}
                  onChange={(event) => {
                    draftRef.current.edit(event.target.value);
                    setDraftText(event.target.value);
                  }}
                  onCompositionStart={() => {
                    composingRef.current = true;
                  }}
                  onCompositionEnd={(event) => {
                    draftRef.current.edit(event.currentTarget.value);
                    composingRef.current = false;
                    if (finalRef.current) finishDraft();
                    else if (queuedRawRef.current !== null)
                      updateDraft(queuedRawRef.current);
                    queuedRawRef.current = null;
                  }}
                />
              ) : (
                <div
                  className={`stext-cap ${overflowing ? "overflowing" : ""}`}
                  ref={(element) => {
                    capRef.current = element;
                  }}
                  onScroll={handleStreamScroll}
                >
                  <p>
                    {loadingNotice && (
                      <span className="sloading">
                        {t("overlay.loadingModel")}
                      </span>
                    )}
                    <span className="committed">
                      {streamText.committed ? streamText.committed + " " : ""}
                    </span>
                    <span className="tentative">{streamText.tentative}</span>
                    {/* Drop the blinking caret once finalizing — it's no longer
                      capturing, and a static spinner conveys the work. */}
                    {!working && !loadingNotice && <span className="scaret" />}
                  </p>
                </div>
              )}
            </div>
          </div>
          {working
            ? workingRow(
                workKind === "polishing"
                  ? t("overlay.processing")
                  : transcribingLabel,
                true,
              )
            : listeningRow(open, true)}
        </div>
      </div>
    );
  }

  // ---- Minimal overlay: exactly one row at a time — waveform (recording), or a
  // spinner + label (transcribing / processing). Never both. The pill animates its
  // width between them; the cancel button is in both rows so it stays put.
  const working = state === "transcribing" || state === "processing";
  const workLabel =
    state === "processing" ? t("overlay.processing") : transcribingLabel;

  return (
    <div
      dir={direction}
      className={`ov-stage ${position} ov-fade ${isVisible ? "show" : ""}`}
    >
      <div
        className={`scard compact ${canAdjust ? "custom-layout" : ""} ${working && isVisible ? "cworking" : ""}`}
      >
        {resizeHandles}
        {working ? workingRow(workLabel, true) : listeningRow(true, true)}
      </div>
    </div>
  );
};

export default RecordingOverlay;
