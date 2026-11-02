import assert from "node:assert/strict";
import { finalTranscript, rangeStart } from "./historyView";

// An intentionally cleared correction must not resurrect the original speech.
assert.equal(
  finalTranscript({ transcription_text: "original", post_processed_text: "" }),
  "",
);
assert.equal(
  finalTranscript({
    transcription_text: "original",
    post_processed_text: null,
  }),
  "original",
);
assert.equal(
  finalTranscript({
    transcription_text: "original",
    post_processed_text: "corrected",
  }),
  "corrected",
);

// Calendar filters start at local midnight, including across month/DST boundaries.
const now = new Date(2026, 9, 28, 15, 30);
assert.equal(rangeStart("all", now), null);
assert.equal(rangeStart("today", now), new Date(2026, 9, 28).getTime() / 1000);
assert.equal(rangeStart("week", now), new Date(2026, 9, 22).getTime() / 1000);
assert.equal(rangeStart("month", now), new Date(2026, 8, 29).getTime() / 1000);
assert.equal(now.getHours(), 15);
console.log("History display regressions passed");
