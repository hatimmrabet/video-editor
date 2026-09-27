/* STAMP — a label stamped onto the screen, with a ring that pulses outward.
   What it does and accepts: ../STAMP.ts */
import {lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, onACC, rgba} from '../../util';
import {STAMP} from '../STAMP.ts';

const back = ease('BACK');

type Props = {enter: number; area: Rect; theme: {acc: string; ink: string; font: string}; params: Params<typeof STAMP.params>};

export default function Stamp({enter, theme, params, area}: Props) {
  const lead = params.lead ?? '';
  const at = {x: ax(area, params.x), y: ay(area, params.y)};
  const pop = lerp(1.5, 1, back(enter));
  const ink = onACC(theme.acc);

  return (
    <>
      {params.ring && enter < 1 && (
        <div style={{
          position: 'absolute', left: at.x, top: at.y,
          width: 120 + enter * 600, height: 120 + enter * 600,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          border: `6px solid ${theme.acc}`, opacity: (1 - enter) * 0.45,
        }} />
      )}
      <div style={{
        position: 'absolute', left: at.x, top: at.y,
        transform: `translate(-50%,-50%) rotate(${params.rotation}deg) scale(${pop})`,
        display: 'flex', alignItems: 'center', gap: lead ? 26 : 0,
        background: theme.acc, color: ink, borderRadius: 26, padding: '26px 42px',
        fontFamily: theme.font, fontWeight: 900, whiteSpace: 'nowrap',
        boxShadow: `0 16px 40px ${rgba(theme.ink, 0.26)}`,
      }}>
        {lead && <span dir="ltr" style={{fontSize: 58}}>{lead}</span>}
        <span style={{fontSize: 52}}>{params.text}</span>
      </div>
    </>
  );
}
