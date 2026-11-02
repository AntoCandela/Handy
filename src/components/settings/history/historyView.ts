import type { HistoryEntry } from "@/bindings";

export type HistoryRow = HistoryEntry & { duration_seconds: number | null };
export type HistoryRange = "all" | "today" | "week" | "month";

export const finalTranscript = (
  entry: Pick<HistoryEntry, "post_processed_text" | "transcription_text">,
): string => entry.post_processed_text ?? entry.transcription_text;

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function rangeStart(
  range: HistoryRange,
  now = new Date(),
): number | null {
  if (range === "all") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "week") start.setDate(start.getDate() - 6);
  if (range === "month") start.setDate(start.getDate() - 29);
  return Math.floor(start.getTime() / 1000);
}

export function durationLabel(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
