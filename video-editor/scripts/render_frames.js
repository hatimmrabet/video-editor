/* يركّب الفيديو + الموشن قرافيكس ويطلع فريمات.
   node render_frames.js <workdir> all                       ← يكمّل من وين وقف (يتخطّى الموجود)
   node render_frames.js <workdir> all --force               ← يعيد الرسم من الصفر
   node render_frames.js <workdir> range 12.0 18.5           ← يعيد رسم نافذة وحدة بس (بعد تعديل مشهد)
   node render_frames.js <workdir> preview 4.6 12.3 31.0     */
const path=require('path'), fs=require('fs');
const {fileUrl,launchOptions,resolvePuppeteer}=require('./lib/platform');
const {load:loadConfig}=require('./lib/config');
const W=path.resolve(process.argv[2])+path.sep;
const CFG=JSON.parse(fs.readFileSync(W+'build/sound-cues.json','utf8'));       // فيه outro
const PCFG=loadConfig(W);   // project.config.json — راجع docs/design/project-config.md
const THEME=Object.assign({},PCFG.theme||{},{faceAnchor:(PCFG.crop||{}).faceAnchor});
const BEHIND=fs.existsSync(W+'build/person-cutout.json')?JSON.parse(fs.readFileSync(W+'build/person-cutout.json','utf8')):null;  // الكلام ورا الشخص
const OUT_D=CFG.outro, FPS=30;
(async()=>{
  const puppeteer=resolvePuppeteer();
  const mode=process.argv[3]||'all';
  const caps=JSON.parse(fs.readFileSync(W+'build/captions.json','utf8'));
  const NVF=fs.readdirSync(W+'build/frames-source').filter(f=>f.endsWith('.jpg')).length;
  const dur=caps.total+OUT_D;
  const b=await puppeteer.launch(launchOptions());
  const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.setCacheEnabled(false);   // لا تقرأ نسخة مخبّأة من compose.html
  await p.goto(fileUrl(W+'compose.html'),{waitUntil:'networkidle0'});
  const FF=THEME.font||'Cairo';
  await p.evaluate(()=>new Promise(r=>{const l=document.getElementById('LOGO');l.complete?r():l.onload=r;}));
  await p.evaluate((c,o,t,b)=>window.init({cards:c.cards,total:c.total,outro:o,theme:t,behind:b}),caps,OUT_D,THEME,BEHIND);
  /* ⚠️ انتظار الخط لازم يجي **بعد** init: الخط اللي مو Cairo يُحقن داخل init نفسها،
     فانتظاره قبلها = انتظار لا شي، والنتيجة أول الفيديو بخط بديل ثم ينقلب بالنص.
     وكل الأوزان تُحمّل — الوزن 600 كان ناقصاً فيطلع بخط بديل لحاله. */
  const fontOK=await p.evaluate(async f=>{
    const W=['400','600','700','800','900'];
    await Promise.all(W.map(w=>document.fonts.load(w+' 60px '+f)));
    await document.fonts.ready;
    return W.every(w=>document.fonts.check(w+' 60px '+f));
  },FF);
  if(!fontOK) console.log('⚠️ الخط '+FF+' ما اكتمل تحميله — الرسم بيكمل بخط بديل');
  const grab=async(t,file,q)=>{
    const i=Math.min(NVF,Math.max(1,Math.round(t*FPS)+1));
    const id=String(i).padStart(5,'0');
    await p.evaluate(s=>window.setFrame(s),fileUrl(W+'build/frames-source/'+id+'.jpg'));
    if(BEHIND){                                   // صورة الشخص المقصوص لهالفريم (إن وُجدت)
      const inR=BEHIND.ranges.some(r=>i>=r[0]&&i<=r[1]);
      const pf=W+'build/person-cutout/person/'+id+'.png';
      const ok=inR&&fs.existsSync(pf);
      await p.evaluate((s,f)=>window.setPerson(s,f), ok?fileUrl(pf):null, (BEHIND.faces&&BEHIND.faces[i])||null);
    }
    const d=await p.evaluate((t,q)=>{window.draw(t);return window.shot(q);},t,q);
    fs.writeFileSync(file,Buffer.from(d.split(',')[1],'base64'));
  };
  if(mode==='preview'){
    fs.mkdirSync(W+'build/prev',{recursive:true});
    for(const t of process.argv.slice(4).map(Number)){await grab(t,W+'build/prev/t'+t.toFixed(2)+'.jpg',0.9);console.log('معاينة',t);}
  }else{
    fs.mkdirSync(W+'build/frames-composited',{recursive:true});
    const n=Math.round(dur*FPS);
    const force=process.argv.includes('--force');
    let i0=0,i1=n;                       // نافذة زمنية اختيارية — تُعاد كتابتها دائماً
    if(mode==='range'){
      const a=Number(process.argv[4]), b=Number(process.argv[5]);
      if(!isFinite(a)||!isFinite(b)) throw new Error('range يحتاج وقتين: <من> <إلى>');
      i0=Math.max(0,Math.floor(a*FPS)); i1=Math.min(n,Math.ceil(b*FPS)+1);
    }
    const done=f=>{try{return fs.statSync(f).size>2000;}catch(e){return false;}};
    let skipped=0,drawn=0;
    for(let i=i0;i<i1;i++){
      const f=W+'build/frames-composited/'+String(i).padStart(5,'0')+'.jpg';
      if(mode==='all'&&!force&&done(f)){skipped++;continue;}
      await grab(i/FPS,f,0.95); drawn++;
      if(drawn%150===1)console.log('فريم',i,'/',i1);
    }
    if(skipped)console.log('تخطّى',skipped,'فريماً جاهزاً (استئناف) — --force يعيد الكل');
    console.log('تم',drawn,'فريم مرسوم من',n,'— المدة',dur.toFixed(3));
    if(mode!=='range'){                  // ناقص فريم = تجميع مكسور، لازم ينكشف الحين
      let miss=0; for(let i=0;i<n;i++) if(!done(W+'build/frames-composited/'+String(i).padStart(5,'0')+'.jpg')) miss++;
      if(miss)console.log('⚠️ ناقص',miss,'فريماً — أعد التشغيل قبل encode.sh');
    }
  }
  await b.close();
})();
