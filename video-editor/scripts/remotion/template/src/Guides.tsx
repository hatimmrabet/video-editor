/* Safe-zone guides — shown in the studio only when "guides": true in project.json.
   The Instagram areas that cover the screen, proportional to the same 1080x1920 canvas as
   safe_check.js used. Instagram's own UI only exists on a vertical, phone-shaped output —
   a 16:9 recording has no such overlay to dodge, so there is nothing to guide there (#136). */
import {W, H} from './theme';
const SX = W / 1080, SY = H / 1920;
export const ZONES = H >= W ? [
  {k:'top',     x:0,      y:0,      w:W,      h:150*SY},
  {k:'bottom',  x:0,      y:1620*SY,w:W,      h:300*SY},
  {k:'caution', x:0,      y:1500*SY,w:W,      h:120*SY},
  {k:'right',   x:900*SX, y:1100*SY,w:180*SX, h:650*SY},
] : [];
export const Guides: React.FC = () => (
  <>{ZONES.map((z,i) => (
    <div key={i} style={{position:'absolute', left:z.x, top:z.y, width:z.w, height:z.h,
      background:'rgba(255,0,60,0.22)', outline:'3px solid rgba(255,0,60,0.85)', pointerEvents:'none'}} />
  ))}</>
);
