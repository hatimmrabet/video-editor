/* Every value comes from timeline.json — remotion.sh builds it via render_data.py from <work>/timeline.json and project.config.json. 
   Do not hardcode a colour here. */
import P from './timeline.json';

export const T = {
  bg:  P.theme.bg  || '#101828',
  ink: P.theme.ink || '#F5F7FA',
  acc: P.theme.acc || '#F2B33D',
  clay:P.theme.clay|| P.theme.acc || '#C98B18',
  mut: P.theme.mut || '#98A2B3',
  font:P.theme.font|| 'Cairo',
  handle: P.theme.handle || '',
  badgeUntil: typeof P.theme.badgeUntil === 'number' ? P.theme.badgeUntil : 0,
};
/* where the speaker's face sits inside the video card (project.config.json ← crop.faceAnchor,
   default 0.30) — the light engine's FACE_ANCH. remotion.sh writes it into timeline.json. */
export const FACE_ANCHOR = typeof (P as any).faceAnchor === 'number' ? (P as any).faceAnchor : 0.30;
/* The composition's own size — remotion.sh reads it off build/video-reframed.mp4, so the
   scene layer follows whatever orientation reframe.py produced (#136). 1080x1920 is only a
   fallback for a timeline.json that predates this (or the CI type-check sample). */
export const W = typeof (P as any).width  === 'number' ? (P as any).width  : 1080;
export const H = typeof (P as any).height === 'number' ? (P as any).height : 1920;
export const FPS   = 30;
export const VEND  = P.total;              // end of the video's speech
export const OUTRO = P.outro;              // the end card's duration
export const DUR_F = Math.round((VEND + OUTRO) * FPS);
export const HAS_SFX = !!P.sfx;
export const OUTRO_COPY = P.outro_copy || {recap:[]};
export const STAGE = P.stage || [{s:0,e:1e9,m:'FULL'}];
/* The scenes the timeline's entries authored, resolved by render_data.py (#144) — always an
   array, possibly empty; SceneList.tsx is the only renderer (the hand-written Scenes.tsx
   fallback was retired, issue #147). */
export const SCENES = ((P as any).scenes as any[] | undefined) || [];
/* Per-entry image/logo overlays (`entry.overlay[]`), output-resolved by render_data.py —
   drawn on the video card itself by VideoOverlays.tsx, not over the whole frame. */
export const OVERLAYS = ((P as any).overlays as any[] | undefined) || [];
/* Transition defaults from scripts/transitions.json (remotion.sh copies them into
   timeline.json). Fallback = today's exact values, so nothing changes without a project
   setting a non-default. Full vocabulary: docs/design/transitions.md */
const _TXD = {
  sceneToScene: {type:'rect-morph', duration:0.42, easing:'eio'},
  sceneEnter:   {type:'rise', duration:0.20, easing:'ease',   params:{y:28,  scale:true}},
  sceneExit:    {type:'rise', duration:0.13, easing:'linear', params:{y:-10, scale:false}},
};
export const TX = {..._TXD, ...((P as any).transitions || {})} as typeof _TXD;
/* whether <work>/config/logo.png exists — remotion.sh writes it. A project without a logo
   must still render: every <Img> of it is guarded on this (it used to abort the render). */
export const HAS_LOGO = !!(P as any).logo;
/* the faint background grid — theme.grid:false turns it off (default on) */
export const GRID = (P as any).theme.grid !== false;
/* "guides": true in timeline.json → the red Instagram areas show in the studio (turn them off before rendering) */
export const GUIDES = !!(P as any).guides;
