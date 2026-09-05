/* ═══ Speech passing behind the person (Arabic kashida) ═══
   node fx/behind_text.js <work> plan            → lists the suitable sentences
   node fx/behind_text.js <work> build 1 9       → cuts the person out for these sentences, writes build/person-cutout.json
   node fx/behind_text.js <work> build 2:6-8     → specific words within a sentence
   node fx/behind_text.js <work> cutout 23.8-26.6 → "standing in front of the panel": no card, you're the element
   node fx/behind_text.js <work> headout 23.8-26.6 → "head outside the rectangle": video in a card, your head pokes above its edge
   node fx/behind_text.js <work> off             → cancels the effect

   How it works: macOS has person segmentation built into the system (Vision). We cut the
   speaker's body out of every frame, draw the word stretched with the kashida underneath
   it, then draw their body back on top — so the kashida alone passes behind the head and
   the letters stay visible on either side.  Needs: macOS + swiftc (free with Xcode tools) + ffmpeg. */
const path=require('path'), fs=require('fs'), cp=require('child_process');
const W=path.resolve(process.argv[2])+path.sep, MODE=process.argv[3]||'plan';
const SC=path.dirname(path.resolve(process.argv[1]))+path.sep;
const caps=JSON.parse(fs.readFileSync(W+'build/captions.json','utf8'));
const FPS=30, MAXW=4, MINDUR=0.85;

const words=c=>c.w.map(w=>w.t).join(' ');
if(MODE==='off'){ try{fs.unlinkSync(W+'build/person-cutout.json');}catch(e){} console.log('Effect cancelled.'); process.exit(0); }

if(MODE==='plan'){
  console.log('Sentences suitable for having their speech pass behind the person (short and clear):');
  let n=0;
  caps.cards.forEach((c,i)=>{
    const dur=c.w[c.w.length-1].e-c.w[0].s;
    if(c.w.length>MAXW||dur<MINDUR) return;
    n++;
    console.log(`  ${i+1}  [${c.s.toFixed(2)}]  ${words(c)}   (${c.w.length} words · ${dur.toFixed(2)}s)${i===0?'  ← the hook, the strongest one':''}`);
  });
  if(!n) console.log('  No short sentence found — pick specific words instead: build 2:6-8 (words 6→8 of sentence 2)');
  console.log('\n⚠️ Pick one or two at most — repeated every sentence, it loses its effect.');
  console.log('Then: node fx/behind_text.js <work> build <sentence numbers>');
  process.exit(0);
}

if(MODE==='cutout'||MODE==='headout'){
  /* "standing in front of the panel": cut the speaker out over a full time range, draw them over the design with no card */
  const m=String(process.argv[4]||'').match(/^([\d.]+)-([\d.]+)$/);
  if(!m){ console.log('Give me a range in seconds: cutout 23.8-26.6'); process.exit(2); }
  const a=Math.max(0,parseFloat(m[1])), b=Math.min(caps.total,parseFloat(m[2]));
  if(!(b>a)){ console.log('Invalid range'); process.exit(2); }
  if(!fs.existsSync(W+'build/frames-source')){ console.log('❌ no build/frames-source folder'); process.exit(3); }
  const NVF2=fs.readdirSync(W+'build/frames-source').filter(f=>f.endsWith('.jpg')).length;
  const f0=Math.max(1,Math.floor(a*FPS)+1), f1=Math.min(NVF2,Math.ceil(b*FPS)+1);
  fs.mkdirSync(W+'build/person-cutout/src',{recursive:true}); fs.mkdirSync(W+'build/person-cutout/mask',{recursive:true}); fs.mkdirSync(W+'build/person-cutout/person',{recursive:true});
  const BIN2=W+'build/person-cutout/personmask';
  if(!fs.existsSync(BIN2)){
    try{ cp.execSync('swiftc -O -o '+JSON.stringify(BIN2)+' '+JSON.stringify(SC+'personmask.swift'),{stdio:'pipe'}); }
    catch(e){ console.log('❌ needs the Xcode tools: xcode-select --install'); process.exit(4); }
  }
  let n=0;
  for(let f=f0;f<=f1;f++){ const id=String(f).padStart(5,'0');
    if(fs.existsSync(W+'build/frames-source/'+id+'.jpg')){ fs.copyFileSync(W+'build/frames-source/'+id+'.jpg', W+'build/person-cutout/src/'+id+'.jpg'); n++; } }
  console.log('Cutout frames:',n,'— cutting you out from the background…');
  cp.execSync(JSON.stringify(BIN2)+' '+JSON.stringify(W+'build/person-cutout/src')+' '+JSON.stringify(W+'build/person-cutout/mask')+' accurate 2.5',{stdio:'inherit'});
  cp.execSync('ffmpeg -v error -start_number '+f0+' -i '+JSON.stringify(W+'build/person-cutout/src/%05d.jpg')+
    ' -start_number '+f0+' -i '+JSON.stringify(W+'build/person-cutout/mask/%05d.png')+' -frames:v '+(f1-f0+1)+
    ' -filter_complex "[1:v]format=gray,scale=1080:1920[a];[0:v][a]alphamerge,format=rgba"'+
    ' -start_number '+f0+' -y '+JSON.stringify(W+'build/person-cutout/person/%05d.png'),{stdio:'pipe'});
  const prev=fs.existsSync(W+'build/person-cutout.json')?JSON.parse(fs.readFileSync(W+'build/person-cutout.json','utf8')):{lines:[],ranges:[],faces:{}};
  const key=MODE==='headout'?'headouts':'cutouts';
  prev[key]=(prev[key]||[]).concat([[a,b]]);
  prev.ranges=(prev.ranges||[]).concat([[f0,f1]]);
  const meta=JSON.parse(fs.readFileSync(W+'build/person-cutout/mask/meta.json','utf8'));
  prev.faces=prev.faces||{};
  for(const mm of meta) if(mm.face) prev.faces[parseInt(mm.f,10)]=mm.face;
  fs.writeFileSync(W+'build/person-cutout.json',JSON.stringify(prev,null,1));
  console.log('✅ '+(MODE==='headout'?'"head outside the rectangle"':'"standing in front of the panel"')+' ready from',a,'to',b,'seconds.');
  console.log('   Render: node render_frames.js '+W+' range '+a+' '+b);
  process.exit(0);
}
if(MODE!=='build'){ console.log('Commands: plan · build · cutout · headout · off'); process.exit(2); }
/* "2" = the whole sentence · "2:6-8" = words 6→8 within sentence 2 */
const pick=process.argv.slice(4).map(a=>{
  const m=String(a).match(/^(\d+)(?::(\d+)-(\d+))?$/); if(!m) return null;
  const i=parseInt(m[1],10)-1; if(i<0||i>=caps.cards.length) return null;
  const n=caps.cards[i].w.length;
  return {i, from:m[2]?Math.max(0,parseInt(m[2],10)-1):0, to:m[3]?Math.min(n-1,parseInt(m[3],10)-1):n-1};
}).filter(Boolean);
if(!pick.length){ console.log('Give me sentence numbers: build 1 9   or   build 2:6-8'); process.exit(2); }
if(!fs.existsSync(W+'build/frames-source')){ console.log('❌ no build/frames-source folder — extract the frames first'); process.exit(3); }

/* 1) build the cutout tool once */
const BIN=W+'build/person-cutout/personmask';
fs.mkdirSync(W+'build/person-cutout/src',{recursive:true}); fs.mkdirSync(W+'build/person-cutout/mask',{recursive:true}); fs.mkdirSync(W+'build/person-cutout/person',{recursive:true});
if(!fs.existsSync(BIN)){
  try{ cp.execSync('swiftc -O -o '+JSON.stringify(BIN)+' '+JSON.stringify(SC+'personmask.swift'),{stdio:'pipe'}); }
  catch(e){ console.log('❌ could not build the cutout tool — needs the Xcode tools: xcode-select --install'); process.exit(4); }
}

/* 2) only the needed frames (not the whole video) */
const NVF=fs.readdirSync(W+'build/frames-source').filter(f=>f.endsWith('.jpg')).length;
const lines=[], ranges=[];
for(const sel of pick){
  const c=caps.cards[sel.i];
  const ws=c.w.slice(sel.from, sel.to+1);
  const a=Math.max(0,ws[0].s-0.20), b=Math.min(caps.total,ws[ws.length-1].e+0.45);
  const f0=Math.max(1,Math.floor(a*FPS)+1), f1=Math.min(NVF,Math.ceil(b*FPS)+1);
  ranges.push([f0,f1]);
  lines.push({card:sel.i, s:a, e:b, words:ws.map(w=>({t:w.t,s:w.s,e:w.e}))});
}
let copied=0;
for(const [f0,f1] of ranges) for(let f=f0;f<=f1;f++){
  const id=String(f).padStart(5,'0');
  if(fs.existsSync(W+'build/frames-source/'+id+'.jpg')){ fs.copyFileSync(W+'build/frames-source/'+id+'.jpg', W+'build/person-cutout/src/'+id+'.jpg'); copied++; }
}
console.log('Effect frames:',copied,'— cutting the person out of them…');

/* 3) the cutout + face data */
cp.execSync(JSON.stringify(BIN)+' '+JSON.stringify(W+'build/person-cutout/src')+' '+JSON.stringify(W+'build/person-cutout/mask')+' accurate 2.5',{stdio:'inherit'});

/* 4) merge the mask as transparency → the person alone (each range on its own) */
for(const [f0,f1] of ranges){
  cp.execSync('ffmpeg -v error -start_number '+f0+' -i '+JSON.stringify(W+'build/person-cutout/src/%05d.jpg')+
    ' -start_number '+f0+' -i '+JSON.stringify(W+'build/person-cutout/mask/%05d.png')+
    ' -frames:v '+(f1-f0+1)+
    ' -filter_complex "[1:v]format=gray,scale=1080:1920[a];[0:v][a]alphamerge,format=rgba"'+
    ' -start_number '+f0+' -y '+JSON.stringify(W+'build/person-cutout/person/%05d.png'),{stdio:'pipe'});
}

const meta=JSON.parse(fs.readFileSync(W+'build/person-cutout/mask/meta.json','utf8'));
const faces={};
for(const m of meta) if(m.face) faces[parseInt(m.f,10)]=m.face;
fs.writeFileSync(W+'build/person-cutout.json',JSON.stringify({lines,ranges,faces},null,1));
console.log('✅ build/person-cutout.json ready —',lines.length,'sentence(s) with speech passing behind the person.');
console.log('   Now render: node render_frames.js '+W+' all --force');
