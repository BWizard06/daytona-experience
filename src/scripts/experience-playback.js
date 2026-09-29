const clamp = (value) => Math.min(1, Math.max(0, value));

const SCROLL_POINTS = [
  [0, 0],
  [0.15, 0.165],
  [0.28, 0.295],
  [0.31, 0.337],
  [0.355, 0.405],
  [0.39, 0.525],
  [0.465, 0.605],
  [0.6, 0.708],
  [0.615, 0.72],
  [0.725, 0.8],
  [0.825, 0.872],
  [0.84, 0.885],
  [0.955, 0.956],
  [1, 1],
];

function mapProgress(value, input, output) {
  const p = clamp(value);
  for (let i = 1; i < SCROLL_POINTS.length; i++) {
    const from = SCROLL_POINTS[i - 1],
      to = SCROLL_POINTS[i];
    if (p <= to[input]) {
      const fraction = (p - from[input]) / (to[input] - from[input]);
      return from[output] + fraction * (to[output] - from[output]);
    }
  }
  return 1;
}

export const scrollToScene = (progress) => mapProgress(progress, 0, 1);
export const sceneToScroll = (progress) => mapProgress(progress, 1, 0);

const TOUR = [
  { from: 0, to: 0.215, seconds: 12 },
  { from: 0.215, to: 0.215, seconds: 4 },
  { from: 0.215, to: 0.47, seconds: 8 },
  { from: 0.47, to: 0.47, seconds: 3 },
  { from: 0.47, to: 0.605, seconds: 4 },
  { from: 0.605, to: 0.77, seconds: 10 },
  { from: 0.77, to: 0.77, seconds: 4 },
  { from: 0.77, to: 0.8, seconds: 3 },
  { from: 0.8, to: 0.956, seconds: 12 },
  { from: 0.956, to: 1, seconds: 4 },
];

export const TOUR_DURATION = TOUR.reduce(
  (total, step) => total + step.seconds,
  0,
);

export function getTourProgress(seconds) {
  let time = Math.max(0, seconds);
  for (const step of TOUR) {
    if (time <= step.seconds) {
      return step.from + ((step.to - step.from) * time) / step.seconds;
    }
    time -= step.seconds;
  }
  return 1;
}

export function getTourTime(progress) {
  const p = clamp(progress);
  let elapsed = 0;
  for (const step of TOUR) {
    if (p <= step.from) return elapsed;
    if (p < step.to)
      return elapsed + (step.seconds * (p - step.from)) / (step.to - step.from);
    elapsed += step.seconds;
  }
  return TOUR_DURATION;
}
