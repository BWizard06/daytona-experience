import test from "node:test";
import assert from "node:assert/strict";
import {
  getComposition,
  CHAPTERS,
} from "../src/scripts/experience-timeline.js";
import {
  getTourProgress,
  getTourTime,
  TOUR_DURATION,
  sceneToScroll,
  scrollToScene,
} from "../src/scripts/experience-playback.js";

test("manual scrolling remains monotonic and navigation round-trips exactly", () => {
  let previous = -1;
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    const scene = scrollToScene(p);
    assert.ok(scene > previous);
    assert.ok(Math.abs(sceneToScroll(scene) - p) < 1e-10);
    previous = scene;
  }
  for (const chapter of CHAPTERS)
    assert.ok(
      Math.abs(scrollToScene(sceneToScroll(chapter)) - chapter) < 1e-10,
    );
  assert.equal(scrollToScene(-1), 0);
  assert.equal(scrollToScene(2), 1);
});

test("still scenes use less scroll travel and case opening has more precision", () => {
  assert.ok(sceneToScroll(0.525) - sceneToScroll(0.405) < 0.05);
  assert.ok(sceneToScroll(0.708) - sceneToScroll(0.605) > 0.12);
});

test("the guided experience starts immediately, keeps later reading holds and finishes at the ending", () => {
  let previous = 0;
  const reading = { origin: 0, driver: 0, icon: 0, within: 0, return: 0 };
  for (let time = 0; time <= TOUR_DURATION; time += 0.1) {
    const progress = getTourProgress(time);
    assert.ok(progress >= previous && progress <= 1);
    const { copy } = getComposition(progress, 1440, 900);
    for (const name of Object.keys(reading))
      if (copy[name] > 0.95) reading[name] += 0.1;
    previous = progress;
  }
  assert.equal(getTourProgress(0), 0);
  assert.ok(getTourProgress(0.1) > 0);
  assert.ok(reading.driver >= 4);
  assert.ok(reading.icon >= 3);
  assert.ok(reading.within >= 4);
  assert.equal(getTourProgress(TOUR_DURATION), 1);
  assert.equal(getTourProgress(TOUR_DURATION + 10), 1);
});

test("play can continue from any manually selected scene without a jump", () => {
  for (let i = 0; i <= 1000; i++) {
    const progress = i / 1000;
    assert.ok(
      Math.abs(getTourProgress(getTourTime(progress)) - progress) < 1e-10,
    );
  }
});

test("movement framing covers the viewport after the matched entrance", () => {
  const [a, b, c, d, tx, ty] = [
    0.984251, 0.000951, -0.000951, 0.966183, -18.2917, -15.6698,
  ];
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1440, 900],
    [1920, 1080],
    [2560, 1080],
  ]) {
    const { movement, movementTime } = getComposition(0.76, width, height);
    assert.ok(movementTime > 0.12);
    const determinant = a * d - b * c;
    for (const [x, y] of [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ]) {
      const px = (x - movement.x) / movement.scale - tx;
      const py = (y - movement.y) / movement.scale - ty;
      const sx = (d * px - c * py) / determinant;
      const sy = (-b * px + a * py) / determinant;
      assert.ok(Math.abs(sx) < 960 && Math.abs(sy) < 540, `${width}×${height}`);
    }
  }
});
