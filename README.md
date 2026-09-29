# Daytona — Every Second Matters

An independent, cinematic tribute to the Rolex Cosmograph Daytona, exploring design, motion and storytelling. A personal project by [Ben Brändle](https://braendle.tech/de/), with no affiliation to Rolex.

## The experience

Five chapters take the viewer from a vintage racing circuit to the driver's wrist, the Daytona, its mechanical world, and back to the assembled watch. Scroll in either direction or press **Play** for a guided journey with reading pauses. Manual scrolling takes over immediately; Play resumes from the current scene.

## How it works

Built with **Astro**, **vanilla JavaScript** and **CSS**. A shared scroll timeline controls video seeking, transitions, typography and positioning. Videos load as their chapters approach; reduced motion and a static fallback keep the story accessible without animation or JavaScript.

Visuals were created with **Higgsfield** and prepared with **FFmpeg**. The site ships as static HTML, CSS, JavaScript and media—no backend or API keys required.

## Development

Requires Node.js **22.12+**.

```sh
npm ci
npm run dev
```

```sh
npm test          # Timeline and playback checks
npm run build    # Static output in dist/
npm run preview  # Preview the production build
```

Deploy `dist/` to any static web host. `src/` contains the page and scroll experience, `public/` its media, and `tests/` the timeline tests. Private references, recordings, experiments and generated build files are excluded from Git.
