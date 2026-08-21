import assert from "node:assert/strict";
import test from "node:test";
import { getNextTabIndex } from "../lib/a11y-utils.mjs";

test("getNextTabIndex moves through tabs and wraps at both ends", () => {
  assert.equal(getNextTabIndex("ArrowRight", 5, 6), 0);
  assert.equal(getNextTabIndex("ArrowDown", 1, 6), 2);
  assert.equal(getNextTabIndex("ArrowLeft", 0, 6), 5);
  assert.equal(getNextTabIndex("ArrowUp", 3, 6), 2);
});

test("getNextTabIndex supports Home and End", () => {
  assert.equal(getNextTabIndex("Home", 3, 6), 0);
  assert.equal(getNextTabIndex("End", 1, 6), 5);
});

test("getNextTabIndex ignores unrelated keys and invalid collections", () => {
  assert.equal(getNextTabIndex("Enter", 0, 6), null);
  assert.equal(getNextTabIndex("ArrowRight", 0, 0), null);
});
