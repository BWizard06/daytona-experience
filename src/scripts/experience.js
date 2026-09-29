import { CHAPTERS, clamp, getComposition } from "./experience-timeline.js";
import {
  TOUR_DURATION,
  getTourProgress,
  getTourTime,
  sceneToScroll,
  scrollToScene,
} from "./experience-playback.js";

const MOVEMENT_ALIGNMENT =
  "matrix(0.984251,0.000951,-0.000951,0.966183,-18.2917,-15.6698)";
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

export function mountExperience(root) {
  const find = (name) => root.querySelector(`[data-${name}]`);
  const stage = root.querySelector(".experience__stage");
  const staticStory = root.querySelector(".static-story");
  const copies = [...root.querySelectorAll("[data-copy]")];
  const links = [...root.querySelectorAll(".chapter-nav [data-chapter]")];
  const tourButtons = [...root.querySelectorAll("[data-tour]")];
  const motionButton = find("motion");
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const videos = {
    race: find("race-video"),
    opening: find("opening-video"),
    movement: find("movement-video"),
  };
  const elements = Object.fromEntries(
    [
      "race-layer",
      "wrist",
      "studio",
      "opening-layer",
      "movement-layer",
      "shade",
      "invitation",
      "progress",
      "counter",
      "credit",
    ].map((name) => [name, find(name)]),
  );
  const listeners = new AbortController();
  const { signal } = listeners;

  let reduced = prefersReduced.matches;
  try {
    const saved = localStorage.getItem("daytona-motion");
    if (saved) reduced = saved === "reduced";
  } catch {}

  let frame = 0,
    previous = 0,
    current = 0,
    target = 0;
  let start = 0,
    distance = 1,
    width = innerWidth,
    height = innerHeight,
    chapter = -1;
  let destroyed = false,
    playing = false,
    tourTime = null,
    expectedScroll = null;

  function wake() {
    if (!frame && !reduced && !destroyed && !document.hidden)
      frame = requestAnimationFrame(tick);
  }

  function updateTourControls() {
    root.classList.toggle("is-playing", playing);
    for (const button of tourButtons) {
      button.setAttribute("aria-pressed", String(playing));
      button.setAttribute(
        "aria-label",
        playing ? "Pause guided experience" : "Play guided experience",
      );
      button.disabled = reduced;
      button.querySelector("[data-tour-label]").textContent = playing
        ? "Pause"
        : "Play";
    }
  }

  function pauseTour(reset = false) {
    playing = false;
    expectedScroll = null;
    if (reset) tourTime = null;
    updateTourControls();
  }

  function toggleTour() {
    if (reduced) return;
    if (playing) {
      pauseTour();
      return;
    }
    if (current >= 0.999) {
      current = target = 0;
      tourTime = 0;
      window.scrollTo({ top: start, behavior: "instant" });
    }
    tourTime ??= getTourTime(current);
    expectedScroll = scrollY;
    playing = true;
    previous = 0;
    updateTourControls();
    wake();
  }

  function load(video) {
    if (video.dataset.started || reduced) return;
    video.dataset.started = "true";
    video.src = video.dataset.src;
    video.preload = "auto";
    video.load();
  }

  for (const video of Object.values(videos)) {
    const decoded = () => {
      if (video.readyState >= 2) video.classList.add("has-frame");
      wake();
    };
    video.addEventListener("loadeddata", decoded, { signal });
    video.addEventListener("seeked", decoded, { signal });
    video.addEventListener("loadedmetadata", wake, { signal });
    video.addEventListener(
      "error",
      () => {
        video.classList.remove("has-frame");
        video.dataset.failed = "true";
        wake();
      },
      { signal },
    );
  }

  function seek(video, fraction) {
    if (
      !video.dataset.started ||
      video.dataset.failed ||
      !Number.isFinite(video.duration)
    )
      return;
    const time = clamp(fraction) * Math.max(0, video.duration - 1 / 30);
    if (!video.seeking && Math.abs(video.currentTime - time) > 1 / 45) {
      try {
        video.currentTime = time;
      } catch {}
    }
  }

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    start = root.getBoundingClientRect().top + scrollY;
    distance = Math.max(1, root.offsetHeight - height);
    target = scrollToScene((scrollY - start) / distance);
    current = target;
    wake();
  }

  function paint(progress) {
    const state = getComposition(progress, width, height);
    const e = elements,
      portrait = state.portrait,
      movement = state.movement;
    e["race-layer"].style.opacity = String(state.raceOpacity);
    e["race-layer"].style.setProperty("--race-position", state.racePosition);
    e.wrist.style.opacity = String(state.wristOpacity);
    e.studio.style.opacity = String(state.studioOpacity);
    e.studio.style.setProperty("--studio-dark", String(state.studioDark));
    e.studio.style.setProperty("--light-x", `${(portrait.x / width) * 100}%`);
    e["opening-layer"].style.transform =
      `translate3d(${portrait.x}px,${portrait.y}px,0) scale(${portrait.scale}) translate(-960px,-540px)`;
    e["opening-layer"].style.opacity = String(state.openingOpacity);
    e["opening-layer"].style.setProperty(
      "--film-opacity",
      String(state.openingFilmOpacity),
    );
    e["opening-layer"].style.visibility = state.openingActive
      ? "visible"
      : "hidden";
    e["movement-layer"].style.transform =
      `translate3d(${movement.x}px,${movement.y}px,0) scale(${movement.scale}) ${MOVEMENT_ALIGNMENT} translate(-960px,-540px)`;
    e["movement-layer"].style.opacity = String(state.movementOpacity);
    e["movement-layer"].style.visibility = state.movementActive
      ? "visible"
      : "hidden";
    e.shade.style.opacity = String(state.shade);
    e.invitation.style.opacity = String(state.invitation);
    e.invitation.inert = state.invitation < 0.1;
    e.invitation.style.visibility =
      state.invitation > 0.005 ? "visible" : "hidden";
    e.progress.style.transform = `scaleX(${sceneToScroll(progress)})`;
    e.credit.style.opacity = String(state.credit);

    for (const copy of copies) {
      const opacity = state.copy[copy.dataset.copy];
      copy.style.opacity = String(opacity);
      copy.style.transform = `translate3d(0,${(1 - opacity) * 20}px,0)`;
      copy.style.visibility = opacity > 0.005 ? "visible" : "hidden";
      copy.setAttribute("aria-hidden", String(opacity < 0.1));
      copy.inert = opacity < 0.1;
    }

    if (chapter !== state.chapter) {
      chapter = state.chapter;
      e.counter.textContent = `0${chapter + 1}`;
      links.forEach((link, index) => {
        if (index === chapter) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
    }

    seek(videos.race, state.raceTime);
    if (progress > 0.18) load(videos.opening);
    if (progress > 0.54) load(videos.movement);
    if (state.openingActive) seek(videos.opening, state.openingTime);
    if (state.movementActive) seek(videos.movement, state.movementTime);
  }

  function tick(now) {
    frame = 0;
    if (reduced || destroyed) return;
    const elapsed = Math.min(64, previous ? now - previous : 0);
    previous = now;

    if (playing) {
      tourTime = Math.min(TOUR_DURATION, tourTime + elapsed / 1000);
      current = target = getTourProgress(tourTime);
      expectedScroll = Math.round(start + distance * sceneToScroll(current));
      window.scrollTo({ top: expectedScroll, behavior: "instant" });
      if (tourTime >= TOUR_DURATION) pauseTour();
    } else {
      target = scrollToScene((scrollY - start) / distance);
      current +=
        (target - current) * (1 - Math.exp(-Math.max(1, elapsed) / 75));
      if (Math.abs(target - current) < 0.00002) current = target;
    }

    paint(current);
    if (playing || Math.abs(target - current) > 0.00002) wake();
  }

  function setMotion(value, preserve = true) {
    const oldProgress = current;
    pauseTour(true);
    reduced = value;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    root.classList.toggle("is-enhanced", !reduced);
    root.classList.toggle("is-reduced", reduced);
    staticStory.hidden = !reduced;
    motionButton.setAttribute("aria-pressed", String(reduced));
    motionButton.setAttribute(
      "aria-label",
      reduced ? "Use full motion" : "Use reduced motion",
    );
    find("motion-label").textContent = reduced ? "off" : "on";
    updateTourControls();

    if (reduced) {
      Object.values(videos).forEach((video) => video.pause());
      paint(0);
      elements["opening-layer"].style.visibility = "hidden";
      elements["movement-layer"].style.visibility = "hidden";
      elements.invitation.style.visibility = "hidden";
      elements.invitation.inert = true;
      if (preserve) window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      load(videos.race);
      measure();
      if (preserve) {
        window.scrollTo({
          top: start + distance * sceneToScroll(oldProgress),
          behavior: "instant",
        });
        current = oldProgress;
      }
      wake();
    }
  }

  root.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-tour]")) toggleTour();
      const navigation = event.target.closest("[data-chapter], [data-replay]");
      if (navigation && !reduced) {
        event.preventDefault();
        pauseTour(true);
        const index = Number(navigation.getAttribute("data-chapter") || 0);
        window.scrollTo({
          top: start + distance * sceneToScroll(CHAPTERS[index]),
          behavior: "smooth",
        });
      }
      if (event.target.closest(".skip-experience")) {
        event.preventDefault();
        setMotion(true, false);
        staticStory.scrollIntoView();
      }
    },
    { signal },
  );

  motionButton.addEventListener(
    "click",
    () => {
      setMotion(!reduced);
      try {
        localStorage.setItem("daytona-motion", reduced ? "reduced" : "full");
      } catch {}
    },
    { signal },
  );

  const takeControl = () => pauseTour(true);
  window.addEventListener("wheel", takeControl, { passive: true, signal });
  window.addEventListener("touchmove", takeControl, { passive: true, signal });
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest("[data-tour]")
      )
        takeControl();
    },
    { passive: true, signal },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" ||
        (SCROLL_KEYS.has(event.key) &&
          !(event.key === " " && event.target.closest?.("[data-tour]")))
      )
        takeControl();
    },
    { signal },
  );
  window.addEventListener(
    "scroll",
    () => {
      if (
        playing &&
        expectedScroll !== null &&
        Math.abs(scrollY - expectedScroll) > 2
      )
        pauseTour(true);
      if (!playing) tourTime = null;
      wake();
    },
    { passive: true, signal },
  );
  window.addEventListener(
    "resize",
    () => {
      pauseTour(true);
      measure();
    },
    { passive: true, signal },
  );
  window.addEventListener("pageshow", measure, { signal });
  prefersReduced.addEventListener(
    "change",
    (event) => setMotion(event.matches),
    { signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        pauseTour();
        if (frame) cancelAnimationFrame(frame);
        frame = previous = 0;
      } else measure();
    },
    { signal },
  );

  setMotion(reduced, false);

  return () => {
    destroyed = true;
    listeners.abort();
    if (frame) cancelAnimationFrame(frame);
    Object.values(videos).forEach((video) => video.pause());
  };
}
