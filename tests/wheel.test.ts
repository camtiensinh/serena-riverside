import assert from "node:assert/strict";
import test from "node:test";
import { chooseWheelWinner } from "../src/lib/wheel";

const entries = [
  { id: "a", name: "An", team: "A" },
  { id: "b", name: "Bình", team: "B" },
];

test("A configured winner overrides random selection", () => {
  const winner = chooseWheelWinner(entries, "b", () => 0);
  assert.equal(winner?.id, "b");
});

test("Random selection remains available without a configured winner", () => {
  const winner = chooseWheelWinner(entries, null, () => 1);
  assert.equal(winner?.id, "b");
});

test("An unavailable configured winner never silently falls back to random", () => {
  assert.equal(chooseWheelWinner(entries, "missing", () => 0), null);
});
