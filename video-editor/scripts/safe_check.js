/* ═══ Safe-zone + hook check ═══
   node safe_check.js <workdir>            → checks and prints the verdict
   node safe_check.js <workdir> --shot     → also writes build/safe-zone-check.jpg (worst frame, zones overlaid in red)

   Why: Instagram covers the bottom of the reel with the caption + audio + account buttons,
   and the right side with the like/share buttons. Any text that enters those zones
   disappears for the viewer, and you don't see it in the preview.

   How: draw the same frame twice, swapping in a flat color for the video image each time —
   whatever's left unchanged is your graphics. Count your ink pixels inside each danger zone.
   The bounds are adjusted via <work>/config/safe.json if needed.                          */
const path=require('path'), fs=require('fs');
const {fileUrl,launchOptions,resolvePuppeteer}=require('./lib/platform');
const {load:loadConfig}=require('./lib/config');
const W=path.resolve(process.argv[2])+path.sep;
const SHOT=process.argv.includes('--shot');
const CFG=JSON.parse(fs.readFileSync(W+'build/sound-cues.json','utf8'));
const PCFG=loadConfig(W);   // project.config.json — see docs/design/project-config.md
const THEME=Object.assign({},PCFG.theme||{},{faceAnchor:(PCFG.crop||{}).faceAnchor});
const caps=JSON.parse(fs.readFileSync(W+'build/captions.json','utf8'));
const FPS=30, OUT_D=CFG.outro, DUR=caps.total+OUT_D;

/* Danger zones — the fraction of ink allowed inside each */
const DEF={
  zones:[
    {k:'top of screen (account name + follow button)', x:0,   y:0,    w:1080, h:150, hard:true,  max:0.004},
    {k:'bottom of screen (Instagram caption + audio)',  x:0,   y:1620, w:1080, h:300, hard:true,  max:0.002},
    {k:'bottom caution belt',                            x:0,   y:1500, w:1080, h:120, hard:false, max:0.010},
    {k:'right of screen (like · comment · share)',       x:950, y:1100, w:130,  h:650, hard:true,  max:0.010}   /* 1%: below this = a card edge, not text */
  ],
  hook_max:0.5            // the first caption must appear within the first half second
};
const SAFE=fs.existsSync(W+'config/safe.json')?{...DEF,...JSON.parse(fs.readFileSync(W+'config/safe.json','utf8'))}:DEF;

/* Two flat colors (red and green) standing in for the video image.
   We draw each moment twice: the pixel that changes between them = where the video is,
   the one that stays put = your graphics. This way the check never depends on theme colors. */
const FLAT_A='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=';
const FLAT_B='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR4nGNg+M9AGhrVMKph+GoAAJHq/wEkpOWMAAAAAElFTkSuQmCC';

(async()=>{
  /* ── 1) the hook: when does the first caption appear ── */
  const first=caps.cards[0];
  const hook=first?first.s:99;
  const hookOK=hook<=SAFE.hook_max;

  if(!fs.existsSync(W+'compose.html')){
    console.log('— hook —');
    console.log(hookOK?`✅ first caption at ${hook.toFixed(2)}s`
      :`❌ first caption at ${hook.toFixed(2)}s — must be before ${SAFE.hook_max}`);
    console.log('ℹ️  no compose.html — pixel check is for the light engine only.');
    console.log('   For Remotion: set "guides": true in config/safe.json then remotion/remotion.sh <work> studio — see the red zones live.');
    process.exit(hookOK?0:3);
  }

  /* ── 2) the safe zone ── */
  const puppeteer=resolvePuppeteer();
  const b=await puppeteer.launch(launchOptions());
  const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.setCacheEnabled(false);   // don't read a cached copy of compose.html
  await p.goto(fileUrl(W+'compose.html'),{waitUntil:'networkidle0'});
  const FF=THEME.font||'Cairo';
  await p.evaluate(()=>new Promise(r=>{const l=document.getElementById('LOGO');
    if(!l||l.complete)return r(); l.onload=r; l.onerror=r; setTimeout(r,3000);}));
  await p.evaluate((c,o,t)=>window.init({cards:c.cards,total:c.total,outro:o,theme:t}),caps,OUT_D,THEME);
  /* ⚠️ after init, not before — the non-Cairo font is injected inside init (same bug as #4) */
  await p.evaluate(async f=>{
    const W=['400','600','700','800','900'];
    await Promise.all(W.map(w=>document.fonts.load(w+' 60px '+f)));
    await document.fonts.ready;
  },FF);

  /* Sample times: every 0.4s + the start/mid of each caption + the outro */
  const T=new Set();
  for(let t=0;t<DUR;t+=0.4) T.add(+t.toFixed(2));
  for(const c of caps.cards){T.add(+(c.s+0.25).toFixed(2));T.add(+((c.s+c.e)/2).toFixed(2));}
  for(let t=caps.total;t<DUR;t+=0.3) T.add(+t.toFixed(2));
  const times=[...T].filter(t=>t>=0&&t<DUR).sort((a,b)=>a-b);

  const res=await p.evaluate(async(times,zones,bg,FA,FB)=>{
    const cv=document.getElementById('cv'), X=cv.getContext('2d',{willReadFrequently:true});
    const hx=h=>{h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
    const B=hx(bg||"#F3EFEA"), W=1080, H=1920, EDGE=24;   /* frame-edge margin — image edges bleeding in gives a false alarm */
    const out=zones.map(z=>({k:z.k,hard:z.hard,max:z.max,worst:0,at:0}));
    let skipped=0;
    const near=(v,a,d)=>Math.abs(v-a)<d;
    for(const t of times){
      await window.setFrame(FA); window.draw(t); const A=X.getImageData(0,0,W,H).data;
      await window.setFrame(FB); window.draw(t); const C=X.getImageData(0,0,W,H).data;
      // a sample where nothing changed between the two colors = an invalid measurement (the video didn't render) — skip it
      let moved=0;
      for(let i=0;i<A.length;i+=4){ if(Math.abs(A[i]-C[i])>25){moved++;} }
      if(moved/(W*H) < 0.05){ skipped++; continue; }
      // the video card's border (frame + shadow) isn't text — ignore a band around it
      let R=null; try{ R=window.vrect?window.vrect(t):null; }catch(e){}
      const onEdge=(x,y)=>{
        if(!R) return false;
        const inY = y>R.y-14 && y<R.y+R.h+14, inX = x>R.x-14 && x<R.x+R.w+14;
        return (inY && (near(x,R.x,14)||near(x,R.x+R.w,14))) || (inX && (near(y,R.y,14)||near(y,R.y+R.h,14)));
      };
      zones.forEach((z,zi)=>{
        let ink=0;
        const x1=Math.max(EDGE,z.x), x2=Math.min(W-EDGE,z.x+z.w);
        const y1=Math.max(EDGE,z.y), y2=Math.min(H-EDGE,z.y+z.h);
        for(let y=y1;y<y2;y++){
          const row=y*W*4;
          for(let x=x1;x<x2;x++){
            const i=row+x*4;
            if(onEdge(x,y)) continue;
            // changed between the two colors = the video itself, not your graphics
            if(Math.abs(A[i]-C[i])>25||Math.abs(A[i+1]-C[i+1])>25||Math.abs(A[i+2]-C[i+2])>25) continue;
            const r=A[i],g=A[i+1],b=A[i+2];
            // background or a faint shadow over it (card shadows aren't text — don't count them)
            if(Math.abs(r-B[0])<=50&&Math.abs(g-B[1])<=50&&Math.abs(b-B[2])<=50) continue;
            if(r<18&&g<18&&b<18) continue;                                                   // black shadow
            ink++;
          }
        }
        const f=ink/Math.max(1,(x2-x1)*(y2-y1));
        if(f>out[zi].worst){out[zi].worst=f;out[zi].at=t;}
      });
    }
    return {out, skipped};
  },times,SAFE.zones,THEME.bg||'#F3EFEA',FLAT_A,FLAT_B);
  const skipped=res.skipped||0; const zones=res.out||res;

  /* ── 3) the report ── */
  const pct=x=>(x*100).toFixed(2)+'%';
  console.log('— hook —');
  console.log(hookOK?`✅ first caption at ${hook.toFixed(2)}s`
    :`❌ first caption at ${hook.toFixed(2)}s — late. Must be before ${SAFE.hook_max} (half the viewers drop off in the first second)`);
  console.log('— safe zone (sample of '+(times.length-skipped)+' frame(s)'+(skipped?' · '+skipped+' skipped':'')+') —');
  let bad=[];
  for(const z of zones){
    const ok=z.worst<=z.max;
    if(!ok&&z.hard) bad.push(z);
    console.log(`${ok?'✅':(z.hard?'❌':'⚠️ ')} ${z.k}: ${pct(z.worst)} of the area at ${z.at.toFixed(2)}s (allowed ${pct(z.max)})`);
  }
  const worst=zones.slice().sort((a,b)=>(b.worst/b.max)-(a.worst/a.max))[0];

  if(SHOT&&worst&&bad.length){   /* a real frame with the zones overlaid in red — only if there's an actual violation */
    if(fs.existsSync(W+'build/frames-source')){
      const NVF=fs.readdirSync(W+'build/frames-source').filter(f=>f.endsWith('.jpg')).length;
      const i=Math.min(NVF,Math.max(1,Math.round(worst.at*FPS)+1));
      await p.evaluate(s=>window.setFrame(s),fileUrl(W+'build/frames-source/'+String(i).padStart(5,'0')+'.jpg'));
    }else{ await p.evaluate(s=>window.setFrame(s),FLAT_A); }   // no frames: the flat color is enough for a preview
    const d=await p.evaluate((t,zones)=>{
      window.draw(t);
      const X=document.getElementById('cv').getContext('2d');
      X.save();
      for(const z of zones){
        X.fillStyle='rgba(255,0,60,0.24)'; X.fillRect(z.x,z.y,z.w,z.h);
        X.strokeStyle='rgba(255,0,60,0.9)'; X.lineWidth=4; X.strokeRect(z.x,z.y,z.w,z.h);
      }
      X.restore();
      return document.getElementById('cv').toDataURL('image/jpeg',0.9);
    },worst.at,SAFE.zones);
    fs.mkdirSync(W+'build',{recursive:true});
    fs.writeFileSync(W+'build/safe-zone-check.jpg',Buffer.from(d.split(',')[1],'base64'));
    console.log('🖼  '+W+'build/safe-zone-check.jpg — the frame at '+worst.at.toFixed(2)+'s, red zones are what Instagram covers');
  }
  await b.close();

  if(bad.length||!hookOK){ console.log('\n❌ Don\'t deliver before fixing this: move the element above the belt, or shrink it.'); process.exit(3); }
  console.log('\n✅ Everything is inside the safe zone.');
})();
