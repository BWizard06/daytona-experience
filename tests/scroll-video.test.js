import test from "node:test";
import assert from "node:assert/strict";
import { createScrollVideo } from "../src/scripts/scroll-video.js";
import { getComposition } from "../src/scripts/experience-timeline.js";

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const media = () => new Blob(["complete mp4"], { type: "video/mp4" });

function environment(t) {
  const saved = new Map();
  const set = (name, value) => { saved.set(name, globalThis[name]); globalThis[name] = value; };
  const frames = new Map();
  const films = [];
  let frameId = 0;
  set("requestAnimationFrame", callback => { frames.set(++frameId, callback); return frameId; });
  set("cancelAnimationFrame", id => frames.delete(id));
  set("fetch", async () => new Response(media()));
  t.after(() => {
    films.forEach(film => film.destroy());
    for (const [name, value] of saved) globalThis[name] = value;
  });
  return {
    async settle() {
      for (let i = 0; i < 8; i++) {
        await new Promise(resolve => setImmediate(resolve));
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback());
      }
    },
    film(video = new Video()) {
      const film = createScrollVideo(video);
      films.push(film);
      return film;
    },
  };
}

class Video extends EventTarget {
  dataset = { src: "/experience/race.mp4" };
  src = "";
  duration = NaN;
  readyState = 0;
  paused = true;
  seeking = false;
  time = 0;
  playCalls = 0;
  classList = new Set();
  constructor() { super(); this.classList.remove = this.classList.delete.bind(this.classList); }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === "src") this.src = ""; }
  load() {
    this.readyState = 0;
    this.duration = NaN;
    this.time = 0;
    if (this.src) queueMicrotask(() => {
      this.duration = 8;
      this.readyState = 1;
      this.dispatchEvent(new Event("loadedmetadata"));
      // No loadeddata: reproduce metadata-only preload on mobile.
    });
  }
  async play() {
    this.playCalls++;
    await Promise.resolve();
    this.paused = false;
    this.readyState = 2;
  }
  get currentTime() { return this.time; }
  set currentTime(value) {
    this.time = value;
    this.seeking = true;
    queueMicrotask(() => {
      this.seeking = false;
      this.readyState = 2;
      this.dispatchEvent(new Event("seeked"));
    });
  }
}

test("cold HTTP 200 downloads once, waits for the complete body and catches up to the latest scroll", async t => {
  const env = environment(t);
  const body = deferred();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, blob: () => body.promise }; };
  const video = new Video();
  const film = env.film(video);
  film.load();
  film.load();
  film.setProgress(.2);
  film.setProgress(.75);
  await env.settle();
  assert.equal(calls, 1);
  assert.equal(video.src, "", "no second native HTTP download");
  assert.equal(video.classList.has("has-frame"), false);
  body.resolve(media());
  await env.settle();
  assert.match(video.src, /^blob:/);
  assert.equal(video.currentTime, .75 * (8 - 1 / 30));
  assert.equal(video.paused, true);
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.playCalls, 1);
  assert.equal(video.classList.has("has-frame"), true);
  film.setProgress(.1);
  await env.settle();
  assert.equal(video.currentTime, .1 * (8 - 1 / 30), "reverse scroll also seeks");
});

test("all three chapters catch up independently after a fast jump before loading finishes", async t => {
  const env = environment(t);
  const downloads = new Map();
  globalThis.fetch = async source => {
    const body = deferred();
    downloads.set(source, body);
    return { ok: true, blob: () => body.promise };
  };
  const state = getComposition(.77, 390, 844);
  const clips = ["race", "opening", "movement"].map(name => {
    const video = new Video();
    video.dataset.src = `/experience/${name}.mp4`;
    const film = env.film(video);
    film.load();
    film.setProgress(state[`${name}Time`]);
    return { name, video, film };
  });
  for (const { name, video } of clips.reverse()) {
    downloads.get(video.dataset.src).resolve(media());
    await env.settle();
    assert.equal(video.currentTime, state[`${name}Time`] * (8 - 1 / 30));
    assert.equal(video.classList.has("has-frame"), true);
  }
});

test("failed downloads and media errors retry without a reload or fetching unrequested chapters", async t => {
  const env = environment(t);
  const video = new Video();
  const film = env.film(video);
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Offline"); };
  film.retry();
  assert.equal(calls, 0);
  film.load();
  await env.settle();
  film.load();
  assert.equal(calls, 1, "do not retry every animation frame");
  globalThis.fetch = async () => { calls++; return new Response(media()); };
  film.retry();
  await env.settle();
  const firstURL = video.src;
  assert.match(firstURL, /^blob:/);
  video.dispatchEvent(new Event("error"));
  film.retry();
  await env.settle();
  assert.notEqual(video.src, firstURL);
  assert.equal(calls, 3);
  assert.equal(video.classList.has("has-frame"), true);
});

test("an HTML error response is not used as a video and a gesture can retry", async t => {
  const env = environment(t);
  const video = new Video();
  const film = env.film(video);
  globalThis.fetch = async () => new Response("<html>Unavailable</html>", { headers: { "Content-Type": "text/html" } });
  film.load();
  await env.settle();
  assert.equal(video.src, "");
  globalThis.fetch = async () => new Response(media());
  film.retry();
  await env.settle();
  assert.match(video.src, /^blob:/);
});

test("reduced motion reset aborts downloads and stale completions cannot replace a newer load", async t => {
  const env = environment(t);
  const downloads = [];
  globalThis.fetch = async (_source, { signal }) => {
    const body = deferred();
    downloads.push({ ...body, signal });
    return { ok: true, blob: () => body.promise };
  };
  const video = new Video();
  const film = env.film(video);
  film.load();
  film.reset();
  assert.equal(downloads[0].signal.aborted, true);
  film.retry();
  assert.equal(downloads.length, 1, "reduced motion does not reactivate a clip");
  film.load();
  downloads[1].resolve(media());
  await env.settle();
  const currentURL = video.src;
  downloads[0].resolve(media());
  await env.settle();
  assert.equal(video.src, currentURL);
  film.destroy();
  assert.equal(video.src, "");
  assert.equal(video.paused, true);
});

test("scrolling during a seek is applied when decoding ends, without another scroll event", async t => {
  const env = environment(t);
  const video = new Video();
  const film = env.film(video);
  film.load();
  await env.settle();
  video.seeking = true;
  film.setProgress(.8);
  film.setProgress(.3);
  await env.settle();
  assert.equal(video.currentTime, 0);
  video.seeking = false;
  video.dispatchEvent(new Event("seeked"));
  await env.settle();
  assert.equal(video.currentTime, .3 * (8 - 1 / 30));
});

test("blocked autoplay still allows seeking and can prime again on a gesture", async t => {
  const env = environment(t);
  const video = new Video();
  let attempts = 0;
  video.play = async () => {
    if (++attempts === 1) throw new Error("NotAllowedError");
    video.paused = false;
    video.readyState = 2;
  };
  const film = env.film(video);
  film.setProgress(.4);
  film.load();
  await env.settle();
  assert.equal(video.currentTime, .4 * (8 - 1 / 30));
  film.retry();
  await env.settle();
  assert.equal(attempts, 2);
  assert.equal(video.paused, true);
});

test("a pending play request in a hidden chapter cannot block decoding the requested frame", async t => {
  const env = environment(t);
  const video = new Video();
  const playback = deferred();
  video.play = () => playback.promise;
  const film = env.film(video);
  film.setProgress(.65);
  film.load();
  await env.settle();
  assert.equal(video.currentTime, .65 * (8 - 1 / 30));
  assert.equal(video.classList.has("has-frame"), true);
  assert.equal(video.paused, true);
  film.reset();
  playback.resolve();
  await env.settle();
  assert.equal(video.src, "", "late playback completion must not revive a reset clip");
});
