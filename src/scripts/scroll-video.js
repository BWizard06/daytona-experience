import { clamp } from "./experience-timeline.js";

// A complete local source stays seekable on hosts that ignore HTTP Range.
// Keep each clip lazy: one fetch, no parallel native media download.
export function createScrollVideo(video) {
  const listeners = new AbortController();
  let download;
  let objectURL;
  let revision = 0;
  let frame = 0;
  let progress = 0;
  let requested = false;
  let loading = false;
  let failed = false;
  let priming = false;
  let primed = false;
  let destroyed = false;

  function schedule() {
    if (!frame && requested && !destroyed)
      frame = requestAnimationFrame(flush);
  }

  function flush() {
    frame = 0;
    if (failed || video.readyState < 1 || video.seeking ||
        !Number.isFinite(video.duration)) return;
    // Hidden/preloaded clips can leave play() pending. Metadata already lets
    // us seek; once a frame arrives, stop playback without waiting for it.
    if (priming && video.readyState >= 2) {
      video.pause();
      priming = false;
      primed = true;
    }
    const time = progress * Math.max(0, video.duration - 1 / 30);
    if (Math.abs(video.currentTime - time) > 1 / 45) {
      try { video.currentTime = time; } catch {}
    } else if (video.readyState >= 2) {
      // Reveal only the decoded frame for the latest scroll position.
      video.classList.add("has-frame");
    }
  }

  function primeDecoder() {
    if (priming || primed || !objectURL || destroyed) return;
    priming = true;
    const attempt = revision;
    // iOS can stop at metadata until muted playback starts. Pause immediately:
    // both forward and reverse playback remain controlled by the scroll.
    video.play().then(() => {
      if (attempt !== revision) return;
      video.pause();
      primed = true;
    }).catch(() => {
      // Seeking may still work. A real gesture can retry blocked playback.
    }).finally(() => {
      if (attempt !== revision) return;
      priming = false;
      schedule();
    });
  }

  function reset() {
    revision++;
    requested = loading = failed = priming = primed = false;
    download?.abort();
    download = undefined;
    cancelAnimationFrame(frame);
    frame = 0;
    video.pause();
    video.classList.remove("has-frame");
    video.removeAttribute("src");
    video.load();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = undefined;
  }

  function load() {
    if (destroyed || loading || failed || objectURL || !video.dataset.src) return;
    requested = loading = true;
    download = new AbortController();
    const { signal } = download;
    const attempt = revision;
    (async () => {
      try {
        const response = await fetch(video.dataset.src, { signal });
        if (!response.ok) throw new Error(`Video request failed (${response.status})`);
        const blob = await response.blob();
        if (signal.aborted || attempt !== revision) return;
        if (!blob.size || (blob.type && !blob.type.startsWith("video/") &&
            blob.type !== "application/octet-stream"))
          throw new Error("Video response did not contain media");
        objectURL = URL.createObjectURL(blob);
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.src = objectURL;
        video.load();
        loading = false;
        primeDecoder();
        schedule();
      } catch {
        if (signal.aborted || attempt !== revision) return;
        loading = false;
        failed = true;
      }
    })();
  }

  const options = { signal: listeners.signal };
  for (const event of ["loadedmetadata", "loadeddata", "canplay", "seeked"])
    video.addEventListener(event, schedule, options);
  video.addEventListener("error", () => {
    if (!requested) return;
    failed = true;
    video.classList.remove("has-frame");
  }, options);

  return {
    load,
    reset,
    setProgress(value) {
      progress = clamp(value);
      schedule();
    },
    retry() {
      if (!requested || destroyed) return;
      if (failed) { reset(); load(); }
      else { primeDecoder(); schedule(); }
    },
    destroy() {
      destroyed = true;
      listeners.abort();
      reset();
    },
  };
}
