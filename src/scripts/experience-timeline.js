export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mix = (a, b, p) => a + (b - a) * p;
const range = (p, from, to) => clamp((p - from) / (to - from));
const ease = (p) => {
  p = clamp(p);
  return p * p * (3 - 2 * p);
};
const fade = (p, a, b) => ease(range(p, a, b));
const window = (p, a, b, c, d) => fade(p, a, b) * (1 - fade(p, c, d));
export const CHAPTERS = [0, 0.215, 0.47, 0.77, 1];
export function getComposition(progress, width, height) {
  const p = clamp(progress),
    mobile = width < 760,
    compact = mobile && height < 700;
  const arrival = fade(p, 0.325, 0.405),
    entering = fade(p, 0.53, 0.595),
    returning = fade(p, 0.962, 0.99);
  const baseX = width * (mobile ? 0.51 : 0.695),
    baseY = height * (mobile ? (compact ? 0.7 : 0.62) : 0.51);
  const portraitScale = Math.min(
    (height * (mobile ? (compact ? 0.43 : 0.56) : 0.82)) / 1080,
    (width * (mobile ? 0.88 : 0.44)) / 620,
  );
  const centerScale = Math.min(
    (height * (mobile ? 0.62 : 0.82)) / 1080,
    (width * 0.88) / 620,
  );
  const openingTime =
    p < 0.8 ? fade(p, 0.605, 0.708) : 1 - fade(p, 0.885, 0.956);
  const macro = fade(openingTime, 0.43, 0.84);
  const mechanismScale = Math.max(width / 1920, height / 1080);
  let x = mix(width * 0.56, baseX, arrival),
    y = baseY;
  x = mix(x, width / 2, entering);
  y = mix(y, height / 2, entering);
  let scale = mix(
    mix(portraitScale, centerScale, entering),
    mechanismScale,
    macro,
  );
  if (p >= 0.94) {
    x = mix(width / 2, baseX, returning);
    y = mix(height / 2, baseY, returning);
    scale = mix(
      mix(centerScale, mechanismScale, macro),
      portraitScale,
      returning,
    );
  }
  const handoff = fade(p, 0.71, 0.716) * (1 - fade(p, 0.874, 0.88));
  const movementTime = p < 0.8 ? fade(p, 0.72, 0.8) : 1 - fade(p, 0.8, 0.872);
  const movementScale =
    mechanismScale * (1 + 0.08 * fade(movementTime, 0, 0.12));
  const arrivalOpacity = fade(p, 0.337, 0.375),
    studioArrival = fade(p, 0.315, 0.34);
  const raceProgress = range(p, 0, 0.295);
  return {
    chapter: p < 0.16 ? 0 : p < 0.385 ? 1 : p < 0.71 ? 2 : p < 0.98 ? 3 : 4,
    raceTime: mix(raceProgress, ease(raceProgress), 0.65),
    raceOpacity: 1 - studioArrival,
    racePosition: `${mix(68, 50, fade(p, 0, 0.295))}% 50%`,
    wristOpacity: window(p, 0.295, 0.31, 0.315, 0.34),
    studioOpacity: studioArrival,
    openingOpacity: arrivalOpacity * (1 - handoff),
    openingTime,
    openingFilmOpacity: fade(openingTime, 0, 0.08),
    openingActive: p > 0.3,
    portrait: { x, y, scale },
    movementOpacity: handoff,
    movementTime,
    movementActive: p > 0.7 && p < 0.89,
    movement: { x: width / 2, y: height / 2, scale: movementScale },
    studioDark: fade(openingTime, 0.52, 0.9),
    copy: {
      origin: 1 - fade(p, 0.015, 0.11),
      driver: window(p, 0.165, 0.19, 0.235, 0.265),
      icon: window(p, 0.385, 0.43, 0.525, 0.565),
      within: window(p, 0.73, 0.75, 0.815, 0.85),
      return: fade(p, 0.982, 0.994),
    },
    shade: Math.max(
      1 - studioArrival,
      0.7 * window(p, 0.73, 0.75, 0.815, 0.85),
    ),
    invitation: 1 - fade(p, 0, 0.018),
    credit: fade(p, 0.985, 0.998),
  };
}
