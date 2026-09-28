/* Every value comes from plan.json — remotion.sh builds it via render_data.py from <work>/timeline.json and project.config.json.
   Do not hardcode a colour here. */
import P from './plan.json';

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
/* The composition's own size — render_data.py reads it off build/source-joined.mp4, so the
   scene layer follows whatever orientation the source was shot in. 1080x1920 is only a
   fallback for a plan.json missing width/height (e.g. the CI type-check sample). */
export const W = typeof (P as any).width  === 'number' ? (P as any).width  : 1080;
export const H = typeof (P as any).height === 'number' ? (P as any).height : 1920;
export const FPS   = 30;
export const VEND  = P.total;              // end of the video's speech
export const OUTRO = P.outro;              // the end card's duration
export const DUR_F = Math.round((VEND + OUTRO) * FPS);
export const HAS_SFX = !!P.sfx;
export const OUTRO_COPY = P.outro_copy || {recap:[]};
/* The layout schedule: [{s, e, layout, scene, transition}] — layout and transition are the
   author's choices as written (or null), `scene` the scene the span carries (or null). Read
   through the layouts and transitions domains by stage.ts, the only reader. */
export const STAGE = ((P as any).stage as any[] | undefined) || [{s:0, e:1e9, layout:null, scene:null}];
/* The render program: the source spans kept, in output order, each with its own framing —
   {s, e} source seconds, o its output start, filter the author's filter choice or null. `z`/`a`
   are present only when the segment hand-authored them (used verbatim); `measured` is the
   face measurement for this span (build/framing.json via find_face.py), or null. Resolved by
   render_data.py; Footage.tsx is the only reader — it turns `measured` + the active layout's
   own face target into the zoom/anchor actually used, when there is no hand-authored one. */
export type Measured = {cx:number; cy:number; h:number} | null;
export type Piece = {s:number; e:number; o:number; z?:number; a?:[number, number]; measured:Measured; filter:any};
export const PIECES = (((P as any).pieces as Piece[] | undefined) || []);
/* Whether the project asks for the light colour grade on every piece with no filter of its
   own (config/project.config.json <- grade). */
export const GRADE = !!(P as any).grade;
/* The scenes the timeline's entries authored, resolved by render_data.py — always an
   array, possibly empty; scenes/SceneList.tsx is the only renderer. */
export const PLAN_SCENES = ((P as any).scenes as any[] | undefined) || [];
/* Per-entry image/logo overlays (`entry.overlay[]`), output-resolved by render_data.py —
   drawn on the video card itself by VideoOverlays.tsx, not over the whole frame. */
export const OVERLAYS = ((P as any).overlays as any[] | undefined) || [];
/* whether <work>/config/logo.png exists — remotion.sh writes it. A project without a logo
   must still render: every <Img> of it is guarded on this. */
export const HAS_LOGO = !!(P as any).logo;
/* the faint background grid — theme.grid:false turns it off (default on) */
export const GRID = (P as any).theme.grid !== false;
/* "guides": true in plan.json → the red Instagram areas show in the studio (turn them off before rendering) */
export const GUIDES = !!(P as any).guides;
