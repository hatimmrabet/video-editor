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
import {Audio, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {PIECES, FPS, W, H, FACE_ANCHOR, VEND} from './theme';
import type {Rect} from './stage';

const SRC = staticFile('video.mp4');
const SEAM = 0.001;    // seconds: closer than this, two pieces continue the same take

const SPANS = PIECES.map((p, i) => {
  const from = Math.round(p.o * FPS);
  const to = Math.round((i + 1 < PIECES.length ? PIECES[i + 1].o : VEND) * FPS);
  const trim = Math.round(p.s * FPS);
  return {p, from, dur: to - from, trim, trimEnd: trim + (to - from),
    seamIn:  i === 0 || Math.abs(PIECES[i - 1].e - p.s) > SEAM,
    seamOut: i + 1 === PIECES.length || Math.abs(PIECES[i + 1].s - p.e) > SEAM};
}).filter(x => x.dur > 0);

/* The footage inside one video rect. The source frame is fitted `cover` into the rect with
   the face held at FACE_ANCHOR vertically; the piece's zoom then crops INSIDE that frame,
   anchored at `a` — the same crop an ffmpeg `crop` + `scale` would make, never a different
   aspect. `f` is a CSS filter, null unless the entry or the opt-in `grade` asked for one. */
export const Footage: React.FC<{rect: Rect}> = ({rect}) => {
  const k = Math.max(rect.w / W, rect.h / H);
  const bw = W * k, bh = H * k;
  const left = (rect.w - bw) * 0.5, top = (rect.h - bh) * FACE_ANCHOR;
  return (
    <>{SPANS.map(({p, from, dur, trim, trimEnd}, i) => (
      <Sequence key={i} from={from} durationInFrames={dur} layout="none">
        <div style={{position:'absolute', left, top, width:bw, height:bh,
          transform:`scale(${p.z})`, transformOrigin:`${p.a[0] * 100}% ${p.a[1] * 100}%`,
          filter:p.f ?? undefined}}>
          <OffthreadVideo src={SRC} muted trimBefore={trim} trimAfter={trimEnd}
            style={{width:'100%', height:'100%', objectFit:'cover'}} />
        </div>
      </Sequence>
    ))}</>
  );
};

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
