import assert from "node:assert/strict";
import { correctionCandidate } from "./correctionCandidate";
assert.equal(
  correctionCandidate("I use handee daily", "I use Handy daily"),
  "Handy",
);
assert.equal(correctionCandidate("I write code", "I write code today"), null);
assert.equal(correctionCandidate("hello friend", "Hello friend"), null);
assert.equal(
  correctionCandidate(
    "one two three four five",
    "a totally rewritten long unrelated sentence",
  ),
  null,
);
assert.equal(
  correctionCandidate(
    "Use \u30a2\u30ad\u30e9 today",
    "Use \u30a2\u30ad\u30b3 today",
  ),
  "\u30a2\u30ad\u30b3",
);
console.log("Correction candidate regressions passed");
