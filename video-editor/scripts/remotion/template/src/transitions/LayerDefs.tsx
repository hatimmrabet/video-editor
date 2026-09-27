import type {LayerDefs as Defs} from './types.ts';

/* The SVG filters a layer's `filter: url(#...)` points at, drawn from the numbers the
   transition computed for this frame. */
export const LayerDefs: React.FC<{defs?: Defs}> = ({defs}) => {
  const g = defs?.glitch;
  if (!g) return null;
  return (
    <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
      <filter id="glitch" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        {/* horizontal bands of noise displace the picture sideways: the torn slices */}
        <feTurbulence type="fractalNoise" baseFrequency="0.002 0.35" numOctaves={1} seed={Math.floor(g.seed)} result="bands" />
        <feDisplacementMap in="SourceGraphic" in2="bands" scale={g.scale} xChannelSelector="R" yChannelSelector="G" result="sliced" />
        {/* the three colour channels, red and blue pulled apart */}
        <feColorMatrix in="sliced" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
        <feColorMatrix in="sliced" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
        <feColorMatrix in="sliced" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
        <feOffset in="red" dx={g.shift} dy={0} result="redShifted" />
        <feOffset in="blue" dx={-g.shift} dy={0} result="blueShifted" />
        <feBlend in="redShifted" in2="green" mode="screen" result="redGreen" />
        <feBlend in="redGreen" in2="blueShifted" mode="screen" />
      </filter>
    </svg>
  );
};
