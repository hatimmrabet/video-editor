# Remotion template — the skill's second engine

You don't run this by hand. `scripts/remotion/remotion.sh` copies it into the work
directory and fills in its data.

| File | What's in it |
|---|---|
| `src/timeline.json` | Generated automatically by `render_data.py`: theme + duration + the video-rect schedule + scenes + overlays + end-card copy |
| `src/Ad.tsx` | The composition: the video inside a moving card + every layer |
| `src/stage.ts` | The display rects (FULL/DOWN/LOWER/HIDDEN) and the transition — the schedule comes from timeline.json; DOWN flexes per caption lines |
| `src/SceneList.tsx` | Dispatches each active entry's `scene` to its motif — the only scene renderer |
| `src/VideoOverlays.tsx` | Draws each active entry's `overlay[]` (a logo/badge) on the video card itself, clipped to its rect |
| `src/Captions.tsx` | The caption cards with the spoken word highlighted, shown a page at a time |
| `src/capPages.ts` | Wraps a caption card's words and splits them into pages of at most 2 lines — shared by `Captions.tsx` and `stage.ts` so the two never disagree on line count |
| `src/Background.tsx` | The face-optional ambient background, shown instead of the video wherever an entry's `video.layout` is `HIDDEN` |
| `src/Outro.tsx` | The end card — its copy comes from timeline.json |
| `src/Chrome.tsx` | The account badge. There is no progress bar |

WARNING: `public/video.mp4` must be tagged bt709 — `reframe.py` already outputs it that way.
A raw iPhone HDR output (bt2020/HLG) comes out orange in the browser.
