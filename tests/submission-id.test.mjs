import assert from "node:assert/strict";
import test from "node:test";
import { createSubmissionId } from "../lib/submission-id.mjs";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

test("submission IDs remain valid when randomUUID is unavailable", () => {
  const cryptoImpl = {
    getRandomValues(bytes) {
      bytes.fill(0xab);
      return bytes;
    },
  };

  const id = createSubmissionId(cryptoImpl);
  assert.match(id, UUID_V4);
  assert.equal(id, "abababab-abab-4bab-abab-abababababab");
});

test("submission ID generation fails closed when no secure random source exists", () => {
  assert.equal(createSubmissionId({}), "");
});
