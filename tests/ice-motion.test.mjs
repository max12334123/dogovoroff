import assert from "node:assert/strict";
import test from "node:test";
import { getIceMotion } from "../lib/ice-motion.mjs";

const rect = { left: 100, top: 50, width: 400, height: 600 };

test("getIceMotion stays neutral at the center", () => {
  assert.deepEqual(getIceMotion(300, 350, rect), {
    rotateX: 0,
    rotateY: 0,
    x: 0,
    y: 0,
    lightX: 0,
    lightY: 0,
  });
});

test("getIceMotion produces restrained edge movement", () => {
  assert.deepEqual(getIceMotion(500, 650, rect), {
    rotateX: -1.25,
    rotateY: 1.7,
    x: 4.5,
    y: 3,
    lightX: 2.5,
    lightY: 1.8,
  });
});

test("getIceMotion clamps pointer positions outside the artwork", () => {
  assert.deepEqual(getIceMotion(-500, -500, rect), {
    rotateX: 1.25,
    rotateY: -1.7,
    x: -4.5,
    y: -3,
    lightX: -2.5,
    lightY: -1.8,
  });
});
