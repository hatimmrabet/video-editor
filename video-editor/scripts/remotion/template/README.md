# Remotion template — the skill's second engine

You don't run this by hand. `scripts/remotion/remotion.sh` copies it into the work
directory and fills in its data.

| File | What's in it |
|---|---|
| `src/project.json` | Generated automatically: theme + duration + the video-rect schedule + end-card copy |
| `src/Ad.tsx` | The composition: the video inside a moving card + every layer |
| `src/stage.ts` | The display rects (FULL/DOWN/LOWER) and the transition — the schedule comes from project.json; DOWN flexes per caption lines |
| `src/Scenes.tsx` | **Your part** — the scenes. Only two examples; invent your own |
| `src/Captions.tsx` | The caption cards with the spoken word highlighted |
| `src/Outro.tsx` | The end card — its copy comes from project.json |
| `src/Chrome.tsx` | The account badge and the progress bar |

WARNING: `public/video.mp4` must be tagged bt709 — `reframe.py` already outputs it that way.
A raw iPhone HDR output (bt2020/HLG) comes out orange in the browser.
