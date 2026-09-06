/* Every value comes from project.json — remotion/remotion.sh builds it from project.config.json and caps.json.
   Do not hardcode a colour here. */
import P from './project.json';

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
   default 0.30) — the light engine's FACE_ANCH. remotion.sh writes it into project.json. */
export const FACE_ANCHOR = typeof (P as any).faceAnchor === 'number' ? (P as any).faceAnchor : 0.30;
export const FPS   = 30;
export const VEND  = P.total;              // end of the video's speech
export const OUTRO = P.outro;              // the end card's duration
export const DUR_F = Math.round((VEND + OUTRO) * FPS);
export const HAS_SFX = !!P.sfx;
export const OUTRO_COPY = P.outro_copy || {recap:[]};
export const STAGE = P.stage || [{s:0,e:1e9,m:'FULL'}];
/* config/scenes.json resolved by remotion.sh (issue #18); null when the file is absent —
   Ad.tsx then renders the hand-written Scenes.tsx instead. */
export const SCENES = ((P as any).scenes as any[] | undefined) || null;
/* Transition defaults from scripts/transitions.json (remotion.sh copies them into
   project.json). Fallback = today's exact values, so nothing changes without a project
   setting a non-default. Full vocabulary: docs/design/transitions.md */
const _TXD = {
  sceneToScene: {type:'rect-morph', duration:0.42, easing:'eio'},
  sceneEnter:   {type:'rise', duration:0.20, easing:'ease',   params:{y:28,  scale:true}},
  sceneExit:    {type:'rise', duration:0.13, easing:'linear', params:{y:-10, scale:false}},
};
export const TX = {..._TXD, ...((P as any).transitions || {})} as typeof _TXD;
/* "guides": true in project.json → the red Instagram areas show in the studio (turn them off before rendering) */
export const GUIDES = !!(P as any).guides;
