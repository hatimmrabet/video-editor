/* Safe-zone guides — shown in the studio only when "guides": true in project.json.
   The Instagram areas that cover the screen, same numbers as safe_check.js. */
export const ZONES = [
  {k:'top',     x:0,   y:0,    w:1080, h:150},
  {k:'bottom',  x:0,   y:1620, w:1080, h:300},
  {k:'caution', x:0,   y:1500, w:1080, h:120},
  {k:'right',   x:900, y:1100, w:180,  h:650},
];
export const Guides: React.FC = () => (
  <>{ZONES.map((z,i) => (
    <div key={i} style={{position:'absolute', left:z.x, top:z.y, width:z.w, height:z.h,
      background:'rgba(255,0,60,0.22)', outline:'3px solid rgba(255,0,60,0.85)', pointerEvents:'none'}} />
  ))}</>
);
