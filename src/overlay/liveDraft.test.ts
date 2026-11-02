import assert from "node:assert/strict";
import { LiveDraft } from "./liveDraft";

const draft = new LiveDraft();
assert.equal(draft.update("I have a cat"), "I have a cat");
draft.edit("I have a dog");
assert.equal(
  draft.update("I have a cat and a bird"),
  "I have a dog and a bird",
);
assert.equal(
  draft.update("I have a cat and a boat"),
  "I have a dog and a boat",
);
draft.edit("I have a dog and a ship");
assert.equal(
  draft.update("I have a cat and a boat. More speech."),
  "I have a dog and a ship. More speech.",
);

const tentative = new LiveDraft();
tentative.update("I like ca");
tentative.edit("I like dogs");
assert.equal(
  tentative.update("I like cats and birds"),
  "I like dogs and birds",
);

const deletion = new LiveDraft();
deletion.update("delete all of this");
deletion.edit("");
assert.equal(
  deletion.update("delete all of this then continue"),
  " then continue",
);

const retracted = new LiveDraft();
retracted.update("I have a cat");
retracted.edit("I have a dog");
assert.equal(retracted.update("I have a"), "I have a dog");
assert.equal(retracted.update(""), "I have a dog");
assert.equal(
  retracted.update("I have a cat and a bird"),
  "I have a dog and a bird",
);

const unicode = new LiveDraft();
unicode.update("Caffè ☕ 猫");
unicode.edit("Caffè ☕ 犬");
assert.equal(unicode.update("Caffè ☕ 猫 很好"), "Caffè ☕ 犬 很好");

const final = new LiveDraft();
final.update("hello world");
final.edit("Hello, friend");
assert.equal(
  final.update("Hello world. More words."),
  "Hello, friend. More words.",
);

const unchanged = new LiveDraft();
unchanged.update("tentative wrong word");
assert.equal(
  unchanged.update("Final corrected output."),
  "Final corrected output.",
);
assert.equal(unchanged.edited, false);
assert.equal(new LiveDraft().text, "");

const excessive = new LiveDraft();
excessive.update("old ".repeat(600));
excessive.edit("Protected correction");
assert.throws(() => excessive.update("new ".repeat(600)));
assert.equal(excessive.text, "Protected correction");
console.log("Live draft regression checks passed");
