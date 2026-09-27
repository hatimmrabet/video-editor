/* The speaker's footage, cut straight out of the source: one <Sequence> per piece of the
   render program (PIECES, theme.ts), each playing its own span of public/video.mp4 — which
   is build/source-joined.mp4 itself. There is no pre-cut video: this IS the cut, and the
   render is the only encode.

   Frames: a piece starts at round(o·FPS) and runs until the next piece starts, so rounding
   never opens a gap or an overlap between two pieces; the source is entered at round(s·FPS),
   within half a frame of the cut in timeline.json. A piece shorter than a frame has no
   frame of its own and is skipped.

   Video and sound are separate on purpose: <Footage> is drawn once per video layer — two
   of them mid-dissolve, none on a HIDDEN entry — and is always muted; <FootageAudio> plays
   the voice exactly once, whatever the layers are doing. */
import {Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {PIECES, FPS, W, H, VEND, GRADE} from './theme';
import type {Piece} from './theme';
import type {Rect} from './geometry.ts';
import {css} from './filters/index.ts';
import {arrangementAt} from './stage';
import type {FaceTarget} from './layouts/index.ts';

const SRC = staticFile('video.mp4');
const SEAM = 0.001;    // seconds: closer than this, two pieces continue the same take

const CENTRE: [number, number] = [0.5, 0.4];   // no measurement at all: a generic, safe crop

/* A piece's effective (anchor, zoom). A hand-authored zoom/anchor is used exactly as
   written. Otherwise, the piece's own MEASURED face (build/framing.json, find_face.py) is
   scaled so its real height lands on `face.h` — the active layout's own target height — and
   anchored at the measured centre; the clamp keeps a bad or noisy measurement from ever
   producing an absurd crop. No measurement at all: a generic, centred crop. */
function resolveCrop(p: Piece, face: FaceTarget): {anchor: [number, number]; zoom: number} {
  if (p.z != null && p.a) return {anchor: p.a, zoom: p.z};
  const m = p.measured;
  if (!m || m.h <= 0) return {anchor: CENTRE, zoom: 1.0};
  return {anchor: [m.cx, m.cy], zoom: Math.max(0.6, Math.min(3.0, face.h / m.h))};
}

// A filter change at a seam eases across this many seconds instead of jump-cutting: the
// outgoing piece keeps playing — fading out — a little past its own montage boundary while
// the incoming piece, stacked on top of it, fades in over it. The same overlap a spliced
// dissolve uses, so it works for any pair of filters without either one knowing the other
// exists. A seam with no filter change (most of them) gets 0 frames of it: free.
const FILTER_FADE_S = 0.2;
const FILTER_FADE_FRAMES = Math.round(FILTER_FADE_S * FPS);

// Dropped here, before SEAM_FADE is computed, not just at SPANS below: a piece shorter than
// a frame would otherwise still count as the "neighbour" two real, adjacent pieces compare
// their filters against, hiding a genuine filter change at the seam that actually survives.
const RAW = PIECES.map((p, i) => ({
  p, from: Math.round(p.o * FPS),
  to: Math.round((i + 1 < PIECES.length ? PIECES[i + 1].o : VEND) * FPS),
  filter: css(p.filter, GRADE),
})).filter(r => r.to > r.from);

// One shared fade per seam, not one per piece either side of it, so the outgoing piece's
// fade-out and the incoming piece's fade-in always cover exactly the same frames — clamped
// to at most half of whichever neighbour is shorter, so a fade can never outlive a piece.
const SEAM_FADE = RAW.map((r, i) => {
  if (i + 1 >= RAW.length || RAW[i + 1].filter === r.filter) return 0;
  const durHere = r.to - r.from, durNext = RAW[i + 1].to - RAW[i + 1].from;
  return Math.max(0, Math.min(FILTER_FADE_FRAMES, Math.floor(durHere / 2), Math.floor(durNext / 2)));
});

/* Each piece's filter, crop and face target are read once, on load: a bad choice fails
   immediately, worded for the author. The layout is resolved from the piece's own output
   start (p.o) — a piece belongs to one segment, so its layout never changes mid-piece, even
   while its on-screen RECT is still animating through a transition. */
const SPANS = RAW.map(({p, from, to, filter}, i) => {
  const trim = Math.round(p.s * FPS);
  const target: FaceTarget = arrangementAt(p.o).face;
  const {anchor, zoom} = resolveCrop(p, target);
  return {p, from, dur: to - from, trim, trimEnd: trim + (to - from), filter,
    anchor, zoom, target, fadeIn: i > 0 ? SEAM_FADE[i - 1] : 0, fadeOut: SEAM_FADE[i],
    // Against RAW's own neighbours (a sub-frame piece already dropped above), never PIECES —
    // once RAW is filtered the two indices no longer line up.
    seamIn:  i === 0 || Math.abs(RAW[i - 1].p.e - p.s) > SEAM,
    seamOut: i + 1 === RAW.length || Math.abs(RAW[i + 1].p.s - p.e) > SEAM};
}).filter(x => x.dur > 0);

/* One piece of footage inside one video rect — the crop Footage's own header explains, plus
   the cross-fade SEAM_FADE gave it at either edge (0 frames, most of the time). `frame` is
   relative to this piece's own <Sequence>, so 0 is always its montage start; a fade-out
   plays past `dur` into the borrowed tail `trimAfter` already accounts for. */
const FootagePiece: React.FC<{rect: Rect; span: (typeof SPANS)[number]}> = ({rect, span}) => {
  const {trim, trimEnd, filter, anchor, zoom, target, fadeIn, fadeOut, dur} = span;
  const frame = useCurrentFrame();
  const opacity = Math.max(0, Math.min(1,
    fadeIn > 0 ? (frame + 1) / fadeIn : 1,
    fadeOut > 0 ? (dur + fadeOut - frame) / fadeOut : 1));
  const k = Math.max(rect.w / W, rect.h / H) * zoom;
  const bw = W * k, bh = H * k;
  const left = rect.w * target.x - anchor[0] * bw;
  const top = rect.h * target.y - anchor[1] * bh;
  return (
    <div style={{position:'absolute', left, top, width:bw, height:bh, filter, opacity}}>
      <OffthreadVideo src={SRC} muted trimBefore={trim} trimAfter={trimEnd + fadeOut}
        style={{width:'100%', height:'100%', objectFit:'cover'}} />
    </div>
  );
};

/* The footage inside one video rect. A single crop: the source is scaled so it covers the
   rect (at zoom 1), then `anchor` (a point on the SOURCE frame, 0-1) is placed exactly at
   `target` (a point WITHIN the rect, 0-1) and the whole thing scaled further by `zoom` —
   the same crop an ffmpeg `crop` + `scale` would make, never a different aspect. `filter` is
   a CSS filter (filters/), none unless the entry or the opt-in `grade` asked for one. */
export const Footage: React.FC<{rect: Rect}> = ({rect}) => (
  <>{SPANS.map((span, i) => (
    <Sequence key={i} from={span.from} durationInFrames={span.dur + span.fadeOut} layout="none">
      <FootagePiece rect={rect} span={span} />
    </Sequence>
  ))}</>
);

/* A short fade at every seam — where two pieces do not continue the same take — so a jump
   cut never clicks. Remotion samples `volume` once per video frame, so at 30 fps the fade
   is the seam's own frame played at a reduced level (its centre sits ~17 ms from the cut),
   not a sample-accurate ramp. Loudness is master_audio.sh's job, not this one's. */
const FADE = 0.025;
const edgeFade = (dur: number, fadeIn: boolean, fadeOut: boolean) => (f: number) => {
  const t = (f + 0.5) / FPS;
  return Math.max(0, Math.min(1, fadeIn ? t / FADE : 1, fadeOut ? (dur / FPS - t) / FADE : 1));
};

export const FootageAudio: React.FC = () => (
  <>{SPANS.map(({from, dur, trim, trimEnd, seamIn, seamOut}, i) => (
    <Sequence key={i} from={from} durationInFrames={dur} layout="none">
      <Audio src={SRC} trimBefore={trim} trimAfter={trimEnd} volume={edgeFade(dur, seamIn, seamOut)} />
    </Sequence>
  ))}</>
);
