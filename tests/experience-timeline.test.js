import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAPTERS,
  getComposition,
} from "../src/scripts/experience-timeline.js";
const scene = (p) => getComposition(p, 1440, 900);

test("chapter navigation lands on the matching readable chapter", () => {
  ["origin", "driver", "icon", "within", "return"].forEach((name, i) => {
    const s = scene(CHAPTERS[i]);
    assert.ok(s.copy[name] > 0.95, name);
    assert.equal(s.chapter, i, name);
  });
});

test("the race responds immediately and dissolves without an empty black interval", () => {
  assert.ok(scene(0.005).raceTime > 0);
  for (let i = 300; i <= 430; i++) {
    const s = scene(i / 1000);
    assert.ok(Math.abs(s.raceOpacity + s.studioOpacity - 1) < 1e-10);
    assert.ok(
      !(s.raceOpacity > 0.05 && s.openingOpacity > 0.05),
      "no double watch",
    );
  }
  assert.ok(scene(0.405).portrait.x > scene(0.325).portrait.x);
});

test("portrait, case opening and closing share one continuous frame", () => {
  assert.equal(scene(0.605).openingTime, 0);
  assert.equal(scene(0.72).openingTime, 1);
  assert.equal(scene(0.72).movementTime, 0);
  assert.equal(scene(0.8).movementTime, 1);
  assert.equal(scene(0.872).movementTime, 0);
  assert.equal(scene(0.885).openingTime, 1);
  assert.equal(scene(0.956).openingTime, 0);
  assert.equal(scene(1).openingOpacity, 1);
  assert.equal(scene(1).movementOpacity, 0);
  assert.deepEqual(scene(0.47).portrait, scene(1).portrait);
  assert.ok(scene(0.605).portrait.scale * 1080 <= 900 * 0.82);
  for (const p of [0.71, 0.713, 0.716, 0.874, 0.877, 0.88]) {
    const s = scene(p);
    assert.ok(Math.abs(s.openingOpacity + s.movementOpacity - 1) < 1e-10);
    assert.equal(s.studioDark, 1);
  }
});

test("five viewport sizes have finite, bounded, continuous and reversible compositions", () => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [2560, 1440],
  ]) {
    const forward = [];
    for (let i = 0; i <= 1000; i++) {
      const s = getComposition(i / 1000, width, height);
      forward.push(s);
      for (const v of Object.values(s.portrait)) assert.ok(Number.isFinite(v));
      for (const key of [
        "raceOpacity",
        "wristOpacity",
        "studioOpacity",
        "openingOpacity",
        "movementOpacity",
        "openingTime",
        "movementTime",
      ])
        assert.ok(s[key] >= 0 && s[key] <= 1, key);
      for (const v of Object.values(s.copy)) assert.ok(v >= 0 && v <= 1);
      if (i > 0) {
        const before = forward[i - 1].portrait;
        assert.ok(Math.abs(s.portrait.x - before.x) < width * 0.02);
        assert.ok(Math.abs(s.portrait.scale - before.scale) < 0.09);
      }
    }
    for (let i = 1000; i >= 0; i--)
      assert.deepEqual(getComposition(i / 1000, width, height), forward[i]);
  }
});
