/* Loads the theme's font, and blocks the render until the EXACT weight/size capPages.ts
   measures text with is actually usable — `document.fonts.ready` alone is not enough: the
   browser only fetches a @font-face weight once something asks for it, so `ready` can
   resolve before weight 800 (what captions render in) has ever been requested. Without
   this, the very first canvas measurement — the one every page/line count gets cached
   from — runs against a fallback font and never gets a second chance. */
import {continueRender, delayRender} from 'remotion';
import {T} from './theme';
import {CAP_FS} from './capPages';
const h = delayRender('font');
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(T.font) +
  ':wght@400;600;700;800;900&display=swap';
link.onload  = () => document.fonts.load(`800 ${CAP_FS}px ${T.font}`).catch(() => {}).then(() => continueRender(h));
link.onerror = () => continueRender(h);   // the CSS never arrived, so there is nothing to load — don't wait on it
document.head.appendChild(link);
