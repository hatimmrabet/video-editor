/* CARD_STACK — cards that pop in one by one, then flip with a check mark.
   What it does and accepts: ../CARD_STACK.ts */
import {clamp01 as cl, lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, onACC, rgba} from '../../util';
import {CARD_STACK} from '../CARD_STACK.ts';

const back = ease('BACK');
const easeOut = ease('EASE_OUT');

// A card's own pop/flip take this long in real seconds, off `itemReveal`, never a share of
// the scene: an item several segments into a growing list is already long settled by the
// time ITS segment's own instance mounts, whatever that segment's own length is.
const POP_S = 0.32, FLIP_DELAY_S = 0.26, FLIP_S = 0.22;

type Props = {t: number; prog: number; wordIndex: number; area: Rect; itemReveal?: (number | null)[] | null;
  theme: {acc: string; ink: string; font: string};
  params: Params<typeof CARD_STACK.params>};

export default function CardStack({t, prog, wordIndex, theme, params, area, itemReveal}: Props) {
  const {items, columns: cols} = params;
  const rows = Math.ceil(items.length / cols);
  const gapX = aw(area, 0.035), gapY = ah(area, 0.025);
  const marginX = aw(area, 0.06), marginY = ah(area, 0.05);
  // the grid fits whatever area it is given — SPLIT sized it for this many items, but FULL's
  // headroom band has not, so the cards shrink to stay inside either one. The width ceiling
  // scales with `cols` too: fixed at a share tuned for two side by side, a single column (the
  // vertical-video default) would get squeezed to that same narrow width for no reason.
  const cw = Math.min((area.w - 2 * marginX - (cols - 1) * gapX) / cols, aw(area, 0.9 / cols));
  const ch = Math.min((area.h - 2 * marginY - (rows - 1) * gapY) / rows, ah(area, 0.22));
  const fontSize = Math.max(22, Math.min(46, ch * 0.32));
  const gridW = cols * cw + (cols - 1) * gapX;
  const gridH = rows * ch + (rows - 1) * gapY;
  const cx0 = ax(area, 0.5) - gridW / 2, cy0 = ay(area, 0.5) - gridH / 2;

  return (
    <>
      {items.map((label, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const cx = cx0 + cw / 2 + c * (cw + gapX);
        const cy = cy0 + ch / 2 + r * (ch + gapY);
        // Off the item's own real appearance time when one is known (itemReveal — carries
        // over from an earlier segment for a card that is not new here) so an already-settled
        // card never replays its entrance; a fixed fraction of `prog` otherwise, spread across
        // this scene alone, for the plain single-segment case.
        const revealT = itemReveal?.[i];
        const k = revealT != null ? cl((t - revealT) / POP_S) : cl((prog - (0.05 + (i / items.length) * 0.4)) / 0.14);
        if (k <= 0) return null;
        const fk = !params.checkmark ? 0
          : params.sync === 'WORDS' ? cl(wordIndex - i + 1)
          : revealT != null ? cl((t - revealT - FLIP_DELAY_S) / FLIP_S)
          : cl((prog - params.flipAt - i * 0.04) / 0.2);
        const acc = fk > 0.5;
        return (
          <div key={i} style={{position: 'absolute', left: cx - cw / 2, top: cy - ch / 2, width: cw, height: ch,
            transform: `scale(${lerp(0.7, 1, back(k))}) rotate(${lerp(-3 * (i % 2 ? -1 : 1), 0, easeOut(k))}deg)`,
            background: acc ? theme.acc : rgba(theme.ink, 0.03),
            border: `2.5px solid ${rgba(theme.ink, 0.09)}`, borderRadius: 34,
            boxShadow: `0 18px 44px ${rgba(theme.ink, acc ? 0.22 : 0.14)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: theme.font, fontWeight: 800, fontSize, color: acc ? onACC(theme.acc) : theme.ink}}>
            {params.checkmark && fk > 0.15 && (
              <span style={{position: 'absolute', left: cw * 0.09, fontSize: fontSize * 0.87, color: acc ? onACC(theme.acc) : theme.acc}}>✓</span>
            )}
            {String(label)}
          </div>
        );
      })}
    </>
  );
}
