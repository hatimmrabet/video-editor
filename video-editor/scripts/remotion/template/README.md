# Remotion template — the skill's only rendering engine

You don't run this by hand. `scripts/remotion/remotion.sh` copies it into the work
directory and fills in its data.

| File | What's in it |
|---|---|
| `src/plan.json` | Generated automatically by `render_data.py` from `<work>/timeline.json`: theme + duration + the layout schedule + scenes + overlays + end-card copy, output times and word timings already resolved |
| `src/Ad.tsx` | The composition: the video cards + every layer |
| `src/Footage.tsx` | The cut itself: one `<Sequence>` per kept source span, straight out of `public/video.mp4`, with its zoom/anchor/filter — and the voice, played once, faded at each seam |
| `src/stage.ts` | The clock of the layouts: which one is on screen at `t` and how the video card moves into the next. It holds no layout or transition of its own |
| `src/layouts/` | The layouts (FULL, SPLIT, LOWER, HIDDEN) and every constant that shapes them; `Background.tsx` is the HIDDEN layout's backdrop |
| `src/transitions/` | The transitions between layouts, the easing curves, and the enter/exit rise scenes and captions share |
| `src/scenes/` | The scenes: one definition per keyword, its component, and `SceneList.tsx`, the only scene renderer |
| `src/filters/` | The looks that can be given to the person's video |
| `src/options/` | What the domains have in common — how an option declares its parameters and how a choice is read — and `check.ts`, which audits the render data |
| `src/VideoOverlays.tsx` | Draws each active entry's `overlay[]` (a logo/badge) on the video card itself, clipped to its rect |
| `src/Captions.tsx` | The caption cards with the spoken word highlighted, shown a page at a time |
| `src/capPages.ts` | Wraps a caption card's words and splits them into pages of at most 2 lines — shared by `Captions.tsx` and `stage.ts` so the two never disagree on line count |
| `src/Outro.tsx` | The end card — its copy comes from plan.json |
| `src/Chrome.tsx` | The account badge. There is no progress bar |

To know what a layout, transition, scene or filter accepts, read its file: each option is one
file named after its UPPERCASE keyword.

WARNING: `public/video.mp4` is `build/source-joined.mp4`, uncut, and it must be tagged bt709 —
`prepare_source.py` re-tags it that way. A raw iPhone HDR source (bt2020/HLG) comes out orange
in the browser.
