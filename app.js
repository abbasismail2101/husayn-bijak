'use strict';
/* ---------- utilities ---------- */
const NS='http://www.w3.org/2000/svg';
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>Array.from(el.querySelectorAll(s));
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const store={
  get(k,d){try{const v=localStorage.getItem('hb_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('hb_'+k,JSON.stringify(v));}catch(e){}}
};
const main=$('#screen');
let stars=store.get('stars',0);
let progress=store.get('write',{});
let soundOn=store.get('sound',true);
let penSeen=false;

/* ---------- audio: Abbas's recorded voice, device-voice fallback, effects, nature sounds ---------- */
/* Voices: Ayah's own recordings, "Hafiz" (ElevenLabs child voice) and, for Iqra', a qari's recordings of every
   letter with fathah/kasrah/dammah (long vowels made from the same clips). Iqra' uses the qari unless Ayah is chosen. */
const VOICE={},V_AYAH={},V_HAFIZ={},V_QARI={};
let iqVoice=store.get('iqVoice','qari');
let voiceSet=store.get('voiceSet','hafiz');
let VOICE_VER=0;
function buildVoice(){VOICE_VER++;for(const k in VOICE)delete VOICE[k];Object.assign(VOICE,V_AYAH);if(voiceSet==='hafiz')for(const k in V_HAFIZ)if(!k.startsWith('iq'))VOICE[k]=V_HAFIZ[k];
  if(iqVoice==='qari'&&Object.keys(V_QARI).length){for(const k in VOICE)if(k.startsWith('iq:'))delete VOICE[k];Object.assign(VOICE,V_QARI);}}
Promise.all(['audio/voice.json','audio/hafiz.json','audio/qari.json'].map(u=>fetch(u).then(r=>r.json()).catch(()=>({})))).then(([a,h,q])=>{
  for(const k in a)V_AYAH[k]='audio/'+a[k];for(const k in h)V_HAFIZ[k]='audio/'+h[k];for(const k in q)V_QARI[k]='audio/'+q[k];buildVoice();});
function vkey(t){return String(t).toLowerCase().replace(/[!.,?]/g,'').replace(/\s+/g,' ').trim();}
let voices=[];
function loadVoices(){try{voices=speechSynthesis.getVoices()||[];}catch(e){}}
if('speechSynthesis' in window){loadVoices();try{speechSynthesis.onvoiceschanged=loadVoices;}catch(e){}}
function findVoice(prefixes){for(const p of prefixes){const v=voices.find(v=>v.lang&&v.lang.toLowerCase().replace('_','-').startsWith(p));if(v)return v;}return null;}
function tts(text){return new Promise(res=>{
  if(!('speechSynthesis' in window)||!text)return res();
  try{const u=new SpeechSynthesisUtterance(text);const v=findVoice(['ms','id']);if(v){u.voice=v;u.lang=v.lang;}else u.lang='ms-MY';u.rate=.85;u.pitch=1.1;
    let done=false;const fin=()=>{if(!done){done=true;res();}};u.onend=fin;u.onerror=fin;setTimeout(fin,Math.max(1500,text.length*120));speechSynthesis.speak(u);}catch(e){res();}
});}
const player=new Audio();player.preload='auto';
let playTok=0,liveNodes=[];
function stopVoice(){playTok++;try{player.pause();}catch(e){}try{speechSynthesis.cancel();}catch(e){}
  liveNodes.forEach(n=>{try{n.stop();}catch(e){}});liveNodes=[];duck(false);}
function playClip(src,tok){return new Promise(res=>{
  if(tok!==playTok)return res();
  let done=false;const fin=()=>{if(!done){done=true;player.onended=null;player.onerror=null;res();}};
  player.onended=fin;player.onerror=fin;player.src=src;
  const p=player.play();if(p&&p.catch)p.catch(fin);setTimeout(fin,8000);
});}
/* Recorded clips are decoded once, silence trimmed, then scheduled back to back on the Web Audio clock,
   so syllables join without the gaps an <audio> element leaves between files. */
const BUF={};
function trimBuf(c,b){
  const d=b.getChannelData(0);let mx=0;for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>mx)mx=v;}
  const thr=mx*.04,sr=b.sampleRate;let a=0,z=d.length-1;while(a<z&&Math.abs(d[a])<thr)a++;while(z>a&&Math.abs(d[z])<thr)z--;
  a=Math.max(0,a-Math.round(sr*.012));z=Math.min(d.length-1,z+Math.round(sr*.045));
  const o=c.createBuffer(1,z-a+1,sr);const od=o.getChannelData(0);od.set(d.subarray(a,z+1));
  /* vowel onset: first 20 ms frame that is loud and voiced (low zero-crossing rate); fricatives like س ش come before it */
  const F=Math.round(sr*.02),fr=[];for(let i=0;i+F<=od.length;i+=F){let e=0,zc=0;for(let j=i;j<i+F;j++){e+=od[j]*od[j];if(j>i&&(od[j]>0)!==(od[j-1]>0))zc++;}fr.push([Math.sqrt(e/F),zc/F]);}
  const em=Math.max(...fr.map(x=>x[0]),1e-6);const k=fr.findIndex(x=>x[0]>em*.3&&x[1]<.12);o.onset=k<0?0:k*.02;
  return o;}
function getBuf(src){
  if(BUF[src])return BUF[src];
  const c=ac();if(!c)return Promise.reject();
  return BUF[src]=fetch(src).then(r=>r.arrayBuffer()).then(ab=>new Promise((res,rej)=>c.decodeAudioData(ab,res,rej))).then(b=>trimBuf(c,b)).catch(e=>{delete BUF[src];throw e;});}
async function playJoined(srcs,gap,tok,caps){
  const c=ac();if(!c)throw 0;
  const bufs=await Promise.all(srcs.map(getBuf));
  if(tok!==playTok)return;
  let t=c.currentTime+.04;
  bufs.forEach((b,i)=>{
    const n=c.createBufferSource(),g=c.createGain();n.buffer=b;
    const dur=caps&&caps[i]?Math.min(b.duration,(b.onset||0)+caps[i]):b.duration; /* Iqra' is read short: cap drawn-out vowels after the onset */
    const fi=.008,fo=Math.min(dur<b.duration?.07:.035,dur/3);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+fi);g.gain.setValueAtTime(1,t+dur-fo);g.gain.linearRampToValueAtTime(0,t+dur);
    n.connect(g);g.connect(master);n.start(t);n.stop(t+dur+.01);liveNodes.push(n);
    t+=dur+(i<bufs.length-1?gap:0);
  });
  while(tok===playTok&&c.currentTime<t)await sleep(40);
}
/* say(parts): each part is a phrase key ('kuda', 'Hebat!') or an Iqra' key ('iq:بa').
   Runs of recorded clips play joined (Iqra' syllables overlap slightly so a word sounds like one word);
   a part with no recording falls back to the device voice (never for Iqra'). */
let curSay=Promise.resolve();
function say(parts,opt={}){const p=sayInner(parts,opt);curSay=p.catch(()=>{});return p;}
const MISSING=new Set();
async function sayInner(parts,opt={}){
  if(!soundOn||parts==null)return;
  const arr=(Array.isArray(parts)?parts:[parts]).filter(p=>p!==''&&p!=null);
  stopVoice();const tok=playTok;duck(true);
  let run=[],runIq=true,runLong=[];
  const flush=async()=>{if(!run.length)return;const srcs=run,lg=runLong;run=[];runLong=[];
    const gap=opt.gap!=null?opt.gap:(runIq?-.03:.09);
    const word=runIq&&gap<0;
    const caps=runIq?srcs.map((_,i)=>lg[i]?null:(word&&i<srcs.length-1?.17:.32)):null;
    try{await playJoined(srcs,gap,tok,caps);}catch(e){for(const s of srcs){if(tok!==playTok)return;await playClip(s,tok);}}};
  for(const p of arr){
    if(tok!==playTok)return;
    const isIq=String(p).startsWith('iq:');const k=isIq?String(p):vkey(p);
    if(VOICE[k]){if(run.length&&runIq!==isIq)await flush();if(!run.length)runIq=isIq;run.push(VOICE[k]);runLong.push(/[*n+]$/.test(k));}
    else{await flush();MISSING.add(k);console.warn('[audio] missing',k);} /* never fall back to the robot voice */
  }
  await flush();
  if(tok===playTok)duck(false);
}

/* effects + ambience, synthesised with Web Audio (no files) */
let AC=null,master=null,ambGain=null,ambOn=store.get('amb',true),ambBlocked=false,ambNodes=null,birdTimer=null;
function ac(){
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=.9;master.connect(AC.destination);}catch(e){return null;}}
  if(AC.state==='suspended')AC.resume().catch(()=>{});
  return AC;
}
function env(g,t,a,peak,d){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
function blip(c,f,t,dur,type,vol,f2){const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);env(g,t,.008,vol,dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05);}
const SFX={
  ok(c){const t=c.currentTime;blip(c,880,t,.18,'sine',.22);blip(c,1320,t+.11,.32,'sine',.2);},
  bad(c){const t=c.currentTime;blip(c,330,t,.22,'triangle',.18,230);},
  star(c,i){const t=c.currentTime;blip(c,1568*Math.pow(1.19,i),t,.35,'sine',.12);blip(c,3136*Math.pow(1.19,i),t+.02,.2,'sine',.05);},
  tap(c){const t=c.currentTime;blip(c,700,t,.06,'sine',.12,900);},
  whoosh(c){const t=c.currentTime,n=c.createBufferSource(),g=c.createGain(),fl=c.createBiquadFilter();n.buffer=noiseBuf(c);fl.type='bandpass';fl.frequency.setValueAtTime(400,t);fl.frequency.exponentialRampToValueAtTime(2400,t+.5);env(g,t,.15,.12,.45);n.connect(fl);fl.connect(g);g.connect(master);n.start(t);n.stop(t+.7);}
};
function sfx(name,arg){if(!soundOn)return;const c=ac();if(c&&SFX[name])try{SFX[name](c,arg);}catch(e){}}
let _noise=null;
function noiseBuf(c){if(_noise)return _noise;const b=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return _noise=b;}
function chirp(c,t,out){
  const kind=Math.random();
  if(kind<.55){const n=rint(2,5),base=2600+Math.random()*1800;for(let i=0;i<n;i++){const o=c.createOscillator(),g=c.createGain(),s=t+i*(.09+Math.random()*.05);o.frequency.setValueAtTime(base*1.25,s);o.frequency.exponentialRampToValueAtTime(base*.8,s+.07);env(g,s,.006,.05,.07);o.connect(g);g.connect(out);o.start(s);o.stop(s+.1);}}
  else{const o=c.createOscillator(),g=c.createGain(),lf=c.createOscillator(),lg=c.createGain(),f=1700+Math.random()*700;o.frequency.setValueAtTime(f,t);o.frequency.linearRampToValueAtTime(f*1.45,t+.32);lf.frequency.value=28;lg.gain.value=60;lf.connect(lg);lg.connect(o.frequency);env(g,t,.04,.035,.34);o.connect(g);g.connect(out);o.start(t);lf.start(t);o.stop(t+.42);lf.stop(t+.42);}
}
function ambStart(){
  if(!soundOn||!ambOn||ambBlocked||document.hidden||ambNodes)return;
  const c=ac();if(!c)return;
  ambGain=c.createGain();ambGain.gain.value=0;ambGain.connect(master);ambGain.gain.setTargetAtTime(1,c.currentTime,1.2);
  const src=c.createBufferSource();src.buffer=noiseBuf(c);src.loop=true;
  const ins=c.createBiquadFilter();ins.type='bandpass';ins.frequency.value=5200;ins.Q.value=9;
  const ig=c.createGain();ig.gain.value=.012;const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=22;lg.gain.value=.01;lfo.connect(lg);lg.connect(ig.gain);
  const wind=c.createBiquadFilter();wind.type='lowpass';wind.frequency.value=380;const wg=c.createGain();wg.gain.value=.03;
  const wl=c.createOscillator(),wlg=c.createGain();wl.frequency.value=.08;wlg.gain.value=.02;wl.connect(wlg);wlg.connect(wg.gain);
  src.connect(ins);ins.connect(ig);ig.connect(ambGain);src.connect(wind);wind.connect(wg);wg.connect(ambGain);
  src.start();lfo.start();wl.start();
  ambNodes=[src,lfo,wl];
  const loop=()=>{if(!ambNodes)return;chirp(c,c.currentTime+.05,ambGain);if(Math.random()<.35)chirp(c,c.currentTime+.6,ambGain);birdTimer=setTimeout(loop,2200+Math.random()*5200);};
  birdTimer=setTimeout(loop,900);
}
function ambStop(){
  clearTimeout(birdTimer);if(!ambNodes)return;const nodes=ambNodes,g=ambGain;ambNodes=null;ambGain=null;
  try{g.gain.setTargetAtTime(0,AC.currentTime,.25);}catch(e){}
  setTimeout(()=>{nodes.forEach(n=>{try{n.stop();}catch(e){}});try{g.disconnect();}catch(e){}},1200);
}
function ambSync(){if(soundOn&&ambOn&&!ambBlocked&&!document.hidden)ambStart();else ambStop();}
function duck(on){if(ambGain&&AC)try{ambGain.gain.setTargetAtTime(on?.2:1,AC.currentTime,.15);}catch(e){}}
document.addEventListener('visibilitychange',ambSync);
document.addEventListener('pointerdown',()=>{ac();ambSync();},{once:false,passive:true});

const SPK_ON='<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SPK_OFF='<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
const BIRD='<svg viewBox="0 0 24 24"><path d="M3 15c3 0 5-2 6-5 1-3 3-5 6-5 2 0 3 1 4 2l2 .5-2 1.5c0 6-4 10-10 10-3 0-5-1-6-4z"/><circle cx="15.5" cy="8" r=".6"/></svg>';
function renderSound(){
  $('#btnSound').innerHTML=`<img src="img/${soundOn?'ic-speaker':'ic-mute'}.webp" alt="">`;
  const a=$('#btnAmb');a.innerHTML='<img src="img/ic-bird.webp" alt="">';a.classList.toggle('off',!(ambOn&&soundOn));a.setAttribute('aria-pressed',String(ambOn&&soundOn));
}
$('#btnSound').onclick=()=>{soundOn=!soundOn;store.set('sound',soundOn);renderSound();if(!soundOn)stopVoice();else sfx('tap');ambSync();};
$('#btnAmb').onclick=()=>{ambOn=!ambOn;store.set('amb',ambOn);if(ambOn&&!soundOn){soundOn=true;store.set('sound',true);}renderSound();ambSync();};

/* ---------- header / navigation ---------- */
let backFn=null,cleanup=null;
function setBar(title,back){$('#barTitle').textContent=title;backFn=back||null;$('#btnBack').hidden=!back;}
$('#btnBack').onclick=()=>{if(backFn)backFn();};
function renderStars(popIt){const el=$('#starCount');$('b',el).textContent=stars;if(popIt){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}}
function addStars(n){if(n<=0)return;stars+=n;store.set('stars',stars);addModuleStar(n);renderStars(true);}
let keepVoice=false; /* set just before go() when a clip that started on the previous screen must finish */
function go(fn,...args){
  if(cleanup){try{cleanup();}catch(e){}cleanup=null;}
  if(!keepVoice)stopVoice();keepVoice=false;ambBlocked=false;lastSay=null;document.body.classList.remove('quiet');
  main.className='';main.scrollTop=0;
  const tok=playTok; /* taken before the screen runs: if it speaks on its own, the guide line stays quiet */
  fn(...args);
  ambSync();requestAnimationFrame(fitBubble);setTimeout(fitBubble,400);
  setTimeout(async()=>{await Promise.race([curSay,sleep(4000)]);const b=$('.m-bubble',main);if(!b||tok!==playTok)return;const t=b.textContent.trim();
    const last=t.split(/(?<=[.!?])\s+/).pop();const u=VOICE[vkey(t)]?t:(VOICE[vkey(last)]?last:null);
    if(u){if(lastSay==null)lastSay=u;talk(1800);say(u);}},450);
}

/* ---------- mascot & celebration ---------- */
/* pick, but never the same one twice in a row */
const _nr={};function pickNR(a,k){let v,t=0;do{v=pick(a);}while(v===_nr[k]&&a.length>1&&++t<10);_nr[k]=v;return v;}
const PRAISE=['Hebat!','Pandainya!','Bagus sangat!','Wah, betul!','MasyaAllah, pandai!','Syabas, Husayn!'];
const TRY=['Hampir! Cuba lagi.','Tak apa, cuba sekali lagi.','Jom cuba lagi, boleh punya!'];
const PARADE=['🐘','🦒','🐢','🐒','🦁','🐯','🐰','🦓','🐪','🦘','🐧','🐊'];
const GUIDES={'🐘':{k:'gajah',c:'teal'},'🐵':{k:'orangutan',c:'mango'},'🦒':{k:'kenyalang',c:'hib'},'🐢':{k:'penyu',c:'plum'}};
function guideHTML(k,c){return `<button type="button" class="guide g-${c}" aria-label="Dengar lagi"><span class="shadow"></span><img src="img/${k}.webp" alt=""></button>`;}
function mascot(animal,text){const g=GUIDES[animal]||GUIDES['🦒'];return `<div class="mascot g-${g.c}"><div class="m-bubble" role="status"><span class="bt">${text}</span></div>${guideHTML(g.k,g.c)}</div>`;}
let talkTimer=null,lastSay=null;
function talk(ms){const g=$('.mascot .guide',main);if(!g)return;clearTimeout(talkTimer);
  g.classList.add('talk');talkTimer=setTimeout(()=>g.classList.remove('talk'),Math.max(1500,ms||2400));}
/* tap the guide: it hops and repeats what it last said */
main.addEventListener('click',e=>{const g=e.target.closest('.guide');if(!g)return;
  g.classList.remove('happy','sad','hop');void g.offsetWidth;g.classList.add('hop');sfx('tap');
  if(lastSay){talk(2000);say(lastSay);}});
/* the guide's bubble never scrolls: shrink the text until it fits */
function bubbleOver(b){const t=$('.bt',b);if(!t)return false;const cs=getComputedStyle(b);
  return t.offsetHeight+parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom)>b.clientHeight+1;}
function fitBubble(){$$('.m-bubble',main).forEach(b=>{b.style.fontSize='';let fs=parseFloat(getComputedStyle(b).fontSize),n=0;
  while(bubbleOver(b)&&fs>11&&n++<40){fs-=1;b.style.fontSize=fs+'px';}});}
window.addEventListener('resize',()=>requestAnimationFrame(fitBubble));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitBubble);
function mascotSay(text,mood,speak=true,parts){
  const m=$('.mascot',main);if(!m)return;
  const bb=$('.m-bubble',m);bb.innerHTML='<span class="bt"></span>';$('.bt',bb).textContent=text;fitBubble();
  const a=$('.guide',m);a.classList.remove('happy','sad');void a.offsetWidth;if(mood)a.classList.add(mood);
  talk(600+String(text).length*70);
  if(mood==='happy')sfx('ok');else if(mood==='sad')sfx('bad');
  if(speak)setTimeout(()=>say(parts||text),mood==='happy'?380:(mood==='sad'?250:0));
}
function celebrate(level){
  const fx=$('#fx');const cx=innerWidth/2,cy=innerHeight*.45;
  const cols=['var(--mango)','var(--hib)','var(--leaf)','var(--teal)','var(--plum)'];
  for(let i=0;i<16;i++){
    const s=document.createElement('span');s.className='spark';
    const ang=Math.random()*Math.PI*2,dist=90+Math.random()*170;
    s.style.left=cx+'px';s.style.top=cy+'px';s.style.setProperty('--c',pick(cols));
    s.style.setProperty('--dx',Math.cos(ang)*dist+'px');s.style.setProperty('--dy',Math.sin(ang)*dist+'px');
    fx.appendChild(s);setTimeout(()=>s.remove(),1100);
  }
  if(level>=3)party();
}
function confetti(n){const fx=$('#fx');const cols=['var(--mango)','var(--hib)','var(--leaf)','var(--teal)','var(--plum)'];
  for(let i=0;i<n;i++){const c=document.createElement('span');c.className='confetti';c.style.left=Math.random()*100+'vw';c.style.setProperty('--c',pick(cols));
    c.style.setProperty('--t',(1.8+Math.random()*1.6)+'s');c.style.setProperty('--dx',(Math.random()*120-60)+'px');c.style.setProperty('--r',(Math.random()*900-450)+'deg');c.style.animationDelay=(Math.random()*.6)+'s';
    fx.appendChild(c);setTimeout(()=>c.remove(),4200);}}
function party(){
  sfx('whoosh');confetti(70);
  const d=document.createElement('div');d.className='party';
  d.innerHTML='<video src="video/raikan.mp4" muted playsinline autoplay></video>';
  document.body.appendChild(d);const v=$('video',d);let gone=false;
  const close=()=>{if(gone)return;gone=true;d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(()=>d.remove(),320);};
  d.onclick=close;v.onended=close;v.onerror=close;setTimeout(close,4600);
}

/* ---------- MENULIS: glyph stroke data (100 x 120 grid; lines at 15, 45, 85, 110) ---------- */
const G={
a:['M67.3,55 A20,20 0 1 0 67.3,75','M70,45 L70,85'],
b:['M30,15 L30,85','M30,65 A20,20 0 0 1 70,65 A20,20 0 0 1 30,65'],
c:['M65.3,52.1 A20,20 0 1 0 65.3,77.9'],
d:['M67.3,55 A20,20 0 1 0 67.3,75','M70,15 L70,85'],
e:['M30,65 L70,65 A20,20 0 1 0 65.3,77.9'],
f:['M66,22 C61,13 46,12 46,28 L46,85','M32,45 L62,45'],
g:['M67.3,55 A20,20 0 1 0 67.3,75','M70,45 L70,100 C70,113 48,115 35,104'],
h:['M30,15 L30,85','M30,63 C30,40 70,40 70,63 L70,85'],
i:['M50,45 L50,85','M50,29 L50,30.5'],
j:['M56,45 L56,100 C56,113 38,115 30,104','M56,29 L56,30.5'],
k:['M32,15 L32,85','M66,45 L33,66 L68,85'],
l:['M50,15 L50,85'],
m:['M24,45 L24,85','M24,62 C24,40 50,40 50,62 L50,85','M50,62 C50,40 76,40 76,62 L76,85'],
n:['M30,45 L30,85','M30,63 C30,40 70,40 70,63 L70,85'],
o:['M50,45 A20,20 0 0 0 50,85 A20,20 0 0 0 50,45'],
p:['M30,45 L30,110','M30,65 A20,20 0 0 1 70,65 A20,20 0 0 1 30,65'],
q:['M67.3,55 A20,20 0 1 0 67.3,75','M70,45 L70,110'],
r:['M36,45 L36,85','M36,63 C36,46 52,42 66,48'],
s:['M66,51 C62,44 38,42 37,54 C36,64 64,64 64,75 C64,87 40,89 33,79'],
t:['M50,20 L50,85','M34,45 L66,45'],
u:['M30,45 L30,67 C30,90 70,90 70,67','M70,45 L70,85'],
v:['M30,45 L50,85 L70,45'],
w:['M22,45 L36,85 L50,55 L64,85 L78,45'],
x:['M32,45 L68,85','M68,45 L32,85'],
y:['M30,45 L54,80','M70,45 L40,110'],
z:['M32,45 L68,45 L32,85 L68,85'],
'0':['M50,15 A20,35 0 0 0 50,85 A20,35 0 0 0 50,15'],
'1':['M38,28 L52,15 L52,85'],
'2':['M32,32 C32,10 70,10 68,32 C66,48 40,62 32,85 L70,85'],
'3':['M33,26 C40,10 68,12 66,32 C64,46 52,48 46,49 C58,49 70,54 68,69 C66,90 38,90 32,76'],
'4':['M56,15 L30,62 L72,62','M58,15 L58,85'],
'5':['M36,15 L34,46 C46,38 70,40 69,62 C68,88 40,90 32,76','M36,15 L66,15'],
'6':['M64,20 C56,11 36,14 32,40 C29,62 34,85 50,85 C63,85 69,75 69,65 C69,53 60,46 50,46 C40,46 32,54 32,63'],
'7':['M30,15 L70,15 L44,85'],
'8':['M50,15 C32,15 32,46 50,49 C70,52 70,85 50,85 C30,85 30,52 50,49 C68,46 68,15 50,15'],
'9':['M68,34 C68,22 60,15 50,15 C38,15 32,24 32,34 C32,45 40,52 50,52 C60,52 68,45 68,34 L68,85'],
'10':['M26,28 L38,15 L38,85','M66,15 A15,35 0 0 0 66,85 A15,35 0 0 0 66,15']
};
const LETTERS='abcdefghijklmnopqrstuvwxyz'.split('');
const DIGITS=['1','2','3','4','5','6','7','8','9','10','0'];
const sampleCache={};
function sampleGlyph(ch){
  if(sampleCache[ch])return sampleCache[ch];
  const svg=$('#measure');
  const res=G[ch].map(d=>{
    const p=document.createElementNS(NS,'path');p.setAttribute('d',d);svg.appendChild(p);
    const L=p.getTotalLength();const n=Math.max(2,Math.ceil(L/1.5));const pts=[];
    for(let i=0;i<=n;i++){const q=p.getPointAtLength(L*i/n);pts.push({x:q.x,y:q.y});}
    p.remove();return {d,pts:L<3?pts.map(q=>({x:q.x,y:q.y,a:null})):withTangents(pts,2),len:L};
  });
  return sampleCache[ch]=res;
}
function linesSVG(){return '<line class="gl" x1="0" x2="100" y1="15" y2="15"/><line class="gl mid" x1="0" x2="100" y1="45" y2="45"/><line class="gl base" x1="0" x2="100" y1="85" y2="85"/><line class="gl" x1="0" x2="100" y1="110" y2="110"/>';}
function solidSVG(ch){return sampleGlyph(ch).map(s=>s.len<3?`<circle class="tsolid-dot" cx="${s.pts[0].x}" cy="${s.pts[0].y}" r="3.4"/>`:`<path class="tsolid" d="${s.d}"/>`).join('');}
function traceSVG(ch){
  const st=sampleGlyph(ch);let out='';
  st.forEach(s=>{out+=s.len<3?`<circle class="tdotsh" cx="${s.pts[0].x}" cy="${s.pts[0].y}" r="5.5"/>`:`<path class="tshadow" d="${s.d}"/>`;});
  st.forEach(s=>{out+=s.len<3?`<circle class="tdot" cx="${s.pts[0].x}" cy="${s.pts[0].y}" r="2.4"/>`:`<path class="tdash" d="${s.d}"/>`;});
  st.forEach((s,i)=>{
    if(s.len>=3){
      const k=Math.min(10,s.pts.length-2),a=s.pts[k-1],b=s.pts[k+1],c=s.pts[k];
      const ang=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
      out+=`<path class="tarrow" d="M-2.6,-2.6 L2.8,0 L-2.6,2.6 Z" transform="translate(${c.x} ${c.y}) rotate(${ang})"/>`;
    }
    const p=s.pts[0];
    out+=`<circle class="tstart" cx="${p.x}" cy="${p.y}" r="4.6"/><text class="tnum" x="${p.x}" y="${p.y}">${i+1}</text>`;
  });
  return out;
}
function bbox(pts){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of pts){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;}return {minX:x0,maxX:x1,minY:y0,maxY:y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};}
const CFG={Ts:[6,12],Tt:[3,8],pf:1.5,cos:.85,wc:.6,aspect:1.2,thr:[.85,.7,.5],icp:6,lam:.08,ascl:1.2,shear:.35,mr3:6,mr2:9,er3:9,er2:12,ar:[.6,1.6]};
function withTangents(pts,k){const n=pts.length;return pts.map((p,i)=>{if(n<3)return {x:p.x,y:p.y,a:null};const u=pts[Math.max(0,i-k)],v=pts[Math.min(n-1,i+k)];const dx=v.x-u.x,dy=v.y-u.y;return {x:p.x,y:p.y,a:dx*dx+dy*dy<.04?null:Math.atan2(dy,dx)};});}
function densifyOne(s,step=1.5){if(!s.length)return [];const out=[s[0]];for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i];const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/step);for(let k=1;k<=n;k++)out.push({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n});}return out;}
function densify(strokes){return strokes.flatMap(s=>densifyOne(s));}
function prepInk(strokes,f){return strokes.flatMap((s,si)=>withTangents(densifyOne(s).map(f),3).map(p=>(p.s=si,p)));}
function okA(a,b,c){return a===null||b===null||Math.abs(Math.cos(a-b))>=c;}
function scoreInk(tpl,ink,T){
  const t1=T[0],t2=T[1],c=CFG.cos,p1=t1*CFG.pf,p2=t2*CFG.pf,L2=t2*t2,PL2=p2*p2;
  const cnt={};for(const q of ink)cnt[q.s]=(cnt[q.s]||0)+1;const dotInk=ink.filter(q=>cnt[q.s]<=10);
  const cr=(d,a,b)=>d<=a?1:d>=b?0:(b-d)/(b-a);
  let cov=0,tot=0;const per=[],unc=[];
  let missRun=0,extraRun=0;
  for(const s of tpl){let k=0,run=0;const pool=s.len<3?dotInk:ink;for(const p of s.pts){let m=L2;for(const q of pool){const dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy;if(d2<m&&okA(p.a,q.a,c))m=d2;}const v=cr(Math.sqrt(m),t1,t2);k+=v;if(v<.5){unc.push(p);run++;if(run>missRun)missRun=run;}else run=0;}per.push(k/s.pts.length);cov+=k;tot+=s.pts.length;}
  const all=tpl.flatMap(s=>s.pts);let inside=0,erun=0,prevS=-1;const sh={},sn={},extraPts=[];
  for(const q of ink){let m=PL2;for(const p of all){const dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy;if(d2<m&&okA(p.a,q.a,c))m=d2;}const v=cr(Math.sqrt(m),p1,p2);inside+=v;sh[q.s]=(sh[q.s]||0)+v;sn[q.s]=(sn[q.s]||0)+1;if(q.s!==prevS)erun=0;prevS=q.s;if(v<.5){extraPts.push(q);erun++;if(erun>extraRun)extraRun=erun;}else erun=0;}
  missRun*=1.5;extraRun*=1.5;const extraStroke=Object.keys(sn).some(k=>sh[k]/sn[k]<.3);
  const coverage=cov/tot,precision=ink.length?inside/ink.length:0;
  const big=tpl.map((s,i)=>s.len>=3?per[i]:null).filter(v=>v!==null);
  const minCov=big.length?Math.min(...big):coverage;
  const dotMissing=tpl.some((s,i)=>s.len<3&&per[i]<.2);
  return {coverage,precision,perStroke:per,uncovered:unc,extraPts,extraStroke,dotMissing,missRun,extraRun,score:CFG.wc*(.5*coverage+.5*minCov)+(1-CFG.wc)*precision};
}
function normalizer(ib,tb){
  const iw=Math.max(ib.w,1),ih=Math.max(ib.h,1);let sx,sy;
  if(tb.w<12){sy=tb.h/ih;sx=sy;}
  else{sx=tb.w/iw;sy=tb.h/ih;const A=CFG.aspect;const r=Math.min(A,Math.max(1/A,sx/sy));const g=Math.sqrt(sx*sy);sx=g*Math.sqrt(r);sy=g/Math.sqrt(r);}
  return {sx,sy,map:p=>({x:tb.cx+(p.x-ib.cx)*sx,y:tb.cy+(p.y-ib.cy)*sy}),inv:p=>({x:ib.cx+(p.x-tb.cx)/sx,y:ib.cy+(p.y-tb.cy)/sy})};
}
function gridVec(pts,bb){const v=new Array(9).fill(0);const w=Math.max(bb.w,1),h=Math.max(bb.h,1);for(const p of pts){const cx=Math.min(2,Math.max(0,Math.floor((p.x-bb.minX)/w*3))),cy=Math.min(2,Math.max(0,Math.floor((p.y-bb.minY)/h*3)));v[cy*3+cx]++;}return v.map(x=>x/pts.length);}
function vdist(a,b){let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return d;}
function applyM(M,p){return {x:M[0]*p.x+M[2]*p.y+M[4],y:M[1]*p.x+M[3]*p.y+M[5]};}
function mulM(P,Q){return [P[0]*Q[0]+P[2]*Q[1],P[1]*Q[0]+P[3]*Q[1],P[0]*Q[2]+P[2]*Q[3],P[1]*Q[2]+P[3]*Q[3],P[0]*Q[4]+P[2]*Q[5]+P[4],P[1]*Q[4]+P[3]*Q[5]+P[5]];}
function invM(M){const [a,b,c,d,e,f]=M;const det=a*d-b*c;return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];}
function nearestIdx(p,arr){let m=1e18,bi=0;for(let i=0;i<arr.length;i++){const dx=p.x-arr[i].x,dy=p.y-arr[i].y,d=dx*dx+dy*dy;if(d<m){m=d;bi=i;}}return bi;}
function fitAffine(base,tplAll){
  // refine x'=A x+B y+C, y'=D y+E so the child's letter lines up with the model (slant, stretch), within limits
  let A=1,B=0,C=0,D=1,E=0;const tsub=tplAll.filter((_,i)=>i%2===0);const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  for(let it=0;it<CFG.icp;it++){
    const cur=base.map(p=>({x:A*p.x+B*p.y+C,y:D*p.y+E}));const pairs=[];
    for(let i=0;i<cur.length;i++)pairs.push([base[i],tplAll[nearestIdx(cur[i],tplAll)]]);
    for(const p of tsub)pairs.push([base[nearestIdx(p,cur)],p]);
    const n=pairs.length,lam=n*CFG.lam;let mx=0,my=0,px=0,py=0;
    for(const [q,p] of pairs){mx+=q.x;my+=q.y;px+=p.x;py+=p.y;}mx/=n;my/=n;px/=n;py/=n;
    let Sxx=0,Sxy=0,Syy=0,Sxp=0,Syp=0,Syq=0;
    for(const [q,p] of pairs){const x=q.x-mx,y=q.y-my,u=p.x-px,v=p.y-py;Sxx+=x*x;Sxy+=x*y;Syy+=y*y;Sxp+=x*u;Syp+=y*u;Syq+=y*v;}
    const a11=Sxx+lam,a22=Syy+lam,det=a11*a22-Sxy*Sxy;
    A=((Sxp+lam)*a22-Sxy*Syp)/det;B=(a11*Syp-Sxy*(Sxp+lam))/det;D=(Syq+lam)/(Syy+lam);
    const S=CFG.ascl;D=cl(D,1/S,S);A=cl(A,1/S,S);A=cl(A,D/1.2,D*1.2);B=cl(B,-CFG.shear,CFG.shear);
    C=px-(A*mx+B*my);E=py-D*my;
  }
  return [A,0,B,D,C,E];
}
function alignInk(strokes,ib,tb,tplAll,pre){
  const nm=normalizer(ib,tb);const N=[nm.sx,0,0,nm.sy,tb.cx-ib.cx*nm.sx,tb.cy-ib.cy*nm.sy];
  let M=pre?mulM(N,pre):N;
  const base=densify(strokes).map(p=>applyM(M,p));
  if(CFG.icp>0)M=mulM(fitAffine(base,tplAll),M);
  return M;
}
function judgeWriting(ch,mode,strokes){
  const tpl=sampleGlyph(ch);
  const raw=densify(strokes);
  const tplAll=tpl.flatMap(s=>s.pts);const tb=bbox(tplAll),ib=bbox(raw);
  const tplLen=tpl.reduce((a,s)=>a+s.len,0);
  const inkLen=strokes.reduce((a,s)=>{let l=0;for(let i=1;i<s.length;i++)l+=Math.hypot(s[i].x-s[i-1].x,s[i].y-s[i-1].y);return a+l;},0);
  let T=CFG.Ts,M=[1,0,0,1,0,0];
  if(mode==='tulis'){T=CFG.Tt;M=alignInk(strokes,ib,tb,tplAll,null);}
  const over=inkLen>tplLen*2.4?(tplLen*2.4)/inkLen:1;
  const ink=prepInk(strokes,p=>applyM(M,p));
  const res=scoreInk(tpl,ink,T);res.score*=over;
  let flip=false;
  if(mode==='tulis'){
    const Mir=[-1,0,0,1,2*ib.cx,0];
    const M2=alignInk(strokes,ib,tb,tplAll,Mir);
    const fl=prepInk(strokes,p=>applyM(M2,p));const r2=scoreInk(tpl,fl,T);r2.score*=over;
    const mir=p=>({x:2*ib.cx-p.x,y:p.y});
    const gt=gridVec(tplAll,tb),gi=gridVec(raw,ib),gm=gridVec(raw.map(mir),ib);
    if(r2.score>=CFG.thr[1]&&(r2.score>res.score+.12||(tb.w>=12&&vdist(gm,gt)<vdist(gi,gt)-.1)))flip=true;
  }
  const th=CFG.thr;
  let st=res.score>=th[0]?3:res.score>=th[1]?2:res.score>=th[2]?1:0;
  const short=inkLen<tplLen*.4;
  if(short||flip)st=Math.min(st,1);
  if(res.dotMissing)st=Math.min(st,2);
  let cap=3,why=null;const C=CFG;
  if(res.missRun>C.mr2){cap=1;why='miss';}else if(res.missRun>C.mr3){cap=2;why='miss';}
  if(res.extraRun>C.er2){cap=1;why=why||'extra';}else if(res.extraRun>C.er3){cap=Math.min(cap,2);why=why||'extra';}
  if(res.extraStroke){cap=Math.min(cap,2);why=why||'extra';}
  if(mode==='tulis'&&tb.w>=25){const ri=(ib.h/Math.max(ib.w,1))/(tb.h/tb.w);if(ri<C.ar[0]||ri>C.ar[1]){cap=1;why='shape';}}
  if(mode==='tulis'&&(ch==='a'||ch==='o')){
    // straight right-hand stick: the only thing separating ball-and-stick a from o
    const X=tb.maxX;let hit=0,n=0;
    for(let y=tb.minY;y<=tb.maxY;y+=1.5){n++;if(ink.some(q=>Math.abs(q.x-X)<=4&&Math.abs(q.y-y)<=2&&q.a!==null&&Math.abs(Math.sin(q.a))>=.9))hit++;}
    const stick=hit/n;
    if(ch==='a'&&stick<.65){cap=1;why='miss';}
    if(ch==='o'&&stick>=.75){cap=1;why='extra';}
  }
  st=Math.min(st,cap);
  return {res,st,flip,short,tb,ib,M,Minv:invM(M),tpl,why};
}

/* ---------- HOME ---------- */
const MODULES=[
  {name:'Membaca',sub:'Suku kata, perkataan, ayat',animal:'🐘',color:'sea',fn:()=>screenBacaMenu()},
  {name:'Mengira',sub:'Nombor 1–10, tambah, tolak',animal:'🐵',color:'sun',fn:()=>screenKiraMenu()},
  {name:'Menulis',sub:'Surih dan tulis huruf, nombor',animal:'🦒',color:'leaf',fn:()=>screenTulisMenu('huruf')},
  {name:"Iqra'",sub:"Iqra' 1 hingga 3",animal:'🐢',color:'plum',fn:()=>screenIqraMenu()}
];
function screenHome(){
  setBar('Husayn Bijak',null);
  main.className='full';
  const DOORS=[['teal','gajah','Suku kata'],['mango','orangutan','Nombor'],['hib','kenyalang','Surih huruf'],['plum','penyu','Hijaiyah']];
  const GO=['Jom baca','Jom kira','Jom tulis','Buka Iqra\''];
  main.innerHTML=`<div class="home"><div class="home-in">
    <div class="greet paper"><h1>Assalamualaikum, <em>Husayn!</em></h1><p>Nak main apa hari ni?</p></div>
    <div class="doors">${MODULES.map((m,i)=>{const [c,k,tag]=DOORS[i];return `<button class="door paper t2 d-${c}" data-i="${i}">
      <span class="tag"><b><img src="img/star-full.webp" alt="">${moduleStars(i)}</b></span>
      <span class="win"><img src="img/${k}.webp" alt="" style="--d:${i*.45}s"></span>
      <span class="dname">${m.name}</span><span class="go"><i class="tri"></i></span></button>`;}).join('')}</div>
    <button class="parentlink" id="toParent"><img src="img/ic-lock.webp" alt="">Ibu/Ayah</button>
  </div></div>`;
  $('#toParent').onclick=()=>go(screenParent);
  $$('.door',main).forEach(b=>b.onclick=()=>{if(main.dataset.busy)return;main.dataset.busy='1';const m=MODULES[+b.dataset.i];sfx('tap');say(m.name);
    b.classList.add('chosen');setTimeout(()=>{delete main.dataset.busy;keepVoice=true;go(m.fn);},420);});
}
function moduleStars(i){const s=store.get('mstars',{});return s[i]||0;}
let curModule=-1;
function addModuleStar(n){if(curModule<0)return;const s=store.get('mstars',{});s[curModule]=(s[curModule]||0)+n;store.set('mstars',s);}
function screenParent(){
  setBar('Ibu/Ayah',()=>go(screenHome));
  const ms=store.get('mstars',{});
  main.innerHTML=`<div class="page act">
    <div class="pagehead"><div><h1>Untuk ibu/ayah</h1><p>Ringkasan dan tetapan.</p></div></div>
    <div class="qarea paper" style="align-items:stretch;gap:12px">
      <div class="row">${MODULES.map((m,i)=>`<span class="score paper">${m.name}: <b>${ms[i]||0}</b> ★</span>`).join('')}</div>
      <p class="parentnote"><b>Menulis:</b> guna M-Pencil. Bila pensil dikesan, sentuhan tapak tangan diabaikan.</p>
      <p class="parentnote"><b>Pasang sebagai app:</b> buka menu Chrome, kemudian pilih <b>Add to Home screen</b> / <b>Install app</b>. App boleh digunakan tanpa internet selepas dibuka sekali.</p>
      <p class="parentnote"><b>Bintang</b> disimpan dalam tablet ini sahaja.</p>
      <div class="row"><button class="btn soft" id="ambT"></button><button class="btn soft" id="voiceT"></button><button class="btn soft" id="iqT"></button></div>
      <p class="parentnote">Suara Hafiz dijana dengan ElevenLabs (free tier, untuk kegunaan peribadi). Bacaan Iqra' (suara qari): rakaman santri Pondok Tahfidz Yanbu'ul Qur'an Kudus, set data "Pelafalan Huruf Hijaiyah" (lesen AFL-3.0). Bacaan panjang (mad) dibina daripada rakaman yang sama.</p>
      <p class="parentnote">Versi app: <b>${(document.querySelector('script[src^="app.js"]')||{src:''}).src.split('v=')[1]||'-'}</b></p>
      <div class="row"><button class="btn soft" id="resetStars">Kosongkan bintang</button><span class="parentnote" id="resetMsg"></span></div>
    </div></div>`;
  const ambLbl=()=>{$('#ambT').innerHTML=`<img src="img/ic-bird.webp" alt="">Bunyi alam: ${ambOn?'hidup':'mati'}`;};ambLbl();
  $('#ambT').onclick=()=>{$('#btnAmb').click();ambLbl();};
  const vLbl=()=>{$('#voiceT').innerHTML=`<img src="img/ic-speaker.webp" alt="">Suara: ${voiceSet==='hafiz'?'Hafiz':'Ayah'}`;};vLbl();
  $('#voiceT').onclick=()=>{voiceSet=voiceSet==='hafiz'?'ayah':'hafiz';store.set('voiceSet',voiceSet);buildVoice();vLbl();say('Hebat!');};
  const iLbl=()=>{$('#iqT').innerHTML=`<img src="img/ic-speaker.webp" alt="">Iqra': ${iqVoice==='qari'?'Qari':'Ayah'}`;};iLbl();
  $('#iqT').onclick=()=>{iqVoice=iqVoice==='qari'?'ayah':'qari';store.set('iqVoice',iqVoice);buildVoice();iLbl();say('iq:بa');};
  let armed=false;
  $('#resetStars').onclick=()=>{if(!armed){armed=true;$('#resetMsg').textContent='Tekan sekali lagi untuk sahkan.';return;}
    stars=0;store.set('stars',0);store.set('mstars',{});store.set('write',{});progress={};renderStars(false);$('#resetMsg').textContent='Bintang dikosongkan.';armed=false;};
}

/* ---------- shared menu helpers ---------- */
function chipRow(label,key,opts,cur){return `<div class="chipset k-${key}"><span class="chiplbl">${label}</span><div class="chips">${opts.map(([v,t])=>`<button class="chip ${v==cur?'on':''}" data-key="${key}" data-v="${v}">${t}</button>`).join('')}</div></div>`;}
function bindChips(key,rerender){$$(`.chip[data-key="${key}"]`,main).forEach(b=>b.onclick=()=>{const v=b.dataset.v;store.set(key,isNaN(v)?v:Number(v));rerender();});}
const HERO={sea:'🐘',sun:'🐵',leaf:'🦒',plum:'🐢'};
function menuPage({title,intro,color,chips,cards,ask}){
  main.className='full';
  main.innerHTML=stageHTML(color,HERO[color],ask||'Nak main apa?',`
    ${chips?`<div class="levels">${chips}</div>`:''}
    <div class="acts n${cards.length}">${cards.map((c,i)=>`<button class="actbtn ${c.hot?'hot':''}" data-i="${i}" style="--k:${i}"><span class="ai" aria-hidden="true">${c.icon}</span><b>${c.name}</b></button>`).join('')}</div>`,'menu');
  $$('.actbtn',main).forEach(b=>b.onclick=()=>{sfx('tap');const c=cards[+b.dataset.i];go(c.fn);if(c.say)say(c.say);});
}
function numOpts(ans,min=0,max=10){const set=new Set([ans]);for(const c of shuffle([ans-1,ans+1,ans-2,ans+2,ans+3,ans-3])){if(set.size>=3)break;if(c>=min&&c<=max)set.add(c);}return shuffle([...set]);}
function bindOpts(box,isRight,onRight){window.__opt={box,isRight};
  $$('.opt',box).forEach(b=>b.onclick=()=>{
    if(box.dataset.done)return;
    if(isRight(b.dataset.v)){box.dataset.done='1';b.classList.add('good');onRight(b);}
    else{b.classList.add('bad');b.disabled=true;mascotSay(pickNR(TRY,'try'),'sad');}
  });
}

/* ---------- MENULIS ---------- */
function starsText(n){return '<i>'+'★'.repeat(n)+'</i>'+'★'.repeat(3-n);}
function screenTulisMenu(tab){
  curModule=2;
  setBar('Menulis',()=>go(screenHome));
  const set=tab==='nombor'?DIGITS:LETTERS;
  main.innerHTML=`<div class="page m-leaf tulismenu">
    <div class="pagehead"><div class="menuhero"><img src="img/kenyalang.webp" alt=""><h1>Nak tulis apa?</h1></div>
      <div class="seg big" role="tablist"><button class="${tab!=='nombor'?'on':''}" data-tab="huruf">abc</button><button class="${tab==='nombor'?'on':''}" data-tab="nombor">123</button></div></div>
    <div class="tilegrid">${set.map((ch,i)=>{const p=progress[ch]||{};return `<button class="tile paper c${i%4} ${(p.s||0)>=2?'traced':''}" data-ch="${ch}"><span class="tch">${ch}</span><span class="tstars" aria-label="${p.t||0} bintang">${starsText(p.t||0)}</span></button>`;}).join('')}</div>
    <p class="parentnote">Ibu/Ayah: bintang = markah terbaik <b>Tulis</b>. Petak hijau = sudah lepas <b>Surih</b>.</p>
  </div>`;
  $$('.seg button',main).forEach(b=>b.onclick=()=>screenTulisMenu(b.dataset.tab));
  $$('.tile',main).forEach(b=>b.onclick=()=>{const ch=b.dataset.ch;const p=progress[ch]||{};go(screenTulis,ch,(p.s||0)>=2?'tulis':'surih');});
}

function screenTulis(ch,mode){
  const set=DIGITS.includes(ch)?DIGITS:LETTERS;
  setBar('Menulis',()=>go(screenTulisMenu,set===DIGITS?'nombor':'huruf'));
  main.className='full';
  const tpl=sampleGlyph(ch);
  const intro=mode==='surih'?'Ikut garisan putus-putus. Mula dari titik hijau nombor 1.':'Tulis sendiri dalam kotak. Tengok contoh kalau lupa.';lastSay=intro;
  main.innerHTML=`<div class="write">
    <aside class="wside">
      <div class="wmodel paper"><svg viewBox="0 0 100 120" aria-hidden="true">${linesSVG()}${solidSVG(ch)}</svg><div class="ml"><b>${ch}</b><small>Contoh</small></div></div>
      <div class="seg wide modes"><button data-mode="surih" class="${mode==='surih'?'on':''}"><span class="mi dash">${ch}</span>Surih</button><button data-mode="tulis" class="${mode==='tulis'?'on':''}" id="modeTulis"><span class="mi">${ch}</span>Tulis</button></div>
      <div class="wtools"><button class="tool" id="wDemo"><img src="img/ic-play.webp" alt=""><small>Tengok</small></button><button class="tool" id="wUndo"><img src="img/ic-undo.webp" alt=""><small>Undur</small></button><button class="tool" id="wClear"><img src="img/ic-eraser.webp" alt=""><small>Padam</small></button></div>
      <div class="stars" id="wStars" aria-live="polite"><span></span><span></span><span></span></div>
      ${mascot('🦒',intro)}
      <p class="pennote" id="penNote">${penSeen?'Pensil dikesan. Sentuhan jari diabaikan.':'Tulis dengan M-Pencil atau jari.'}</p>
    </aside>
    <section class="wpadwrap" id="padWrap">
      <div class="padarea" id="padArea"><div class="padbox" id="padBox"><div class="sheet"></div>
        <svg class="pg" viewBox="0 0 100 120" aria-hidden="true">${linesSVG()}${mode==='surih'?traceSVG(ch):''}</svg>
        <canvas id="ink" aria-label="Ruang menulis"></canvas>
        <svg class="pg" id="over" viewBox="0 0 100 120" aria-hidden="true"></svg>
        <div class="bug" id="bug" hidden></div>
      </div></div>
      <div class="padact">
        <button class="btn round soft" id="wPrev" aria-label="Sebelum">‹</button>
        <button class="btn big leaf" id="wCheck"><img src="img/ic-check.webp" alt="">Siap!</button>
        <button class="btn round soft" id="wNext" aria-label="Seterusnya">›</button>
      </div>
    </section>
  </div>`;
  const wrap=$('#padWrap'),box=$('#padBox'),cv=$('#ink'),ctx=cv.getContext('2d'),over=$('#over'),bug=$('#bug');
  const INK=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()||'#1E3A33';
  let strokes=[],active=null,cur=null,attemptBest=0,demoing=false,checked=false;

  let lastW=0;
  function fit(){
    const A=$('#padArea');if(!A||!document.body.contains(A))return;
    const W=A.clientWidth,H=A.clientHeight;if(W<10||H<10)return;
    const h=Math.min(H,W*1.2),w=h/1.2;
    if(Math.abs(w-lastW)<1)return;lastW=w;
    box.style.width=w+'px';box.style.height=h+'px';
    const dpr=Math.min(window.devicePixelRatio||1,3);
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
    const sc=w/100;ctx.setTransform(dpr*sc,0,0,dpr*sc,0,0);
    redraw();
  }
  function redraw(){
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.restore();
    ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=4.6;
    for(const s of strokes){
      if(s.length===1){ctx.beginPath();ctx.arc(s[0].x,s[0].y,2.4,0,Math.PI*2);ctx.fill();continue;}
      ctx.beginPath();ctx.moveTo(s[0].x,s[0].y);for(let i=1;i<s.length;i++)ctx.lineTo(s[i].x,s[i].y);ctx.stroke();
    }
  }
  function toPt(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*120};}
  function clearResult(){over.innerHTML='';$$('#wStars span').forEach(s=>s.classList.remove('on'));checked=false;}
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen'&&!penSeen){penSeen=true;const n=$('#penNote');if(n)n.textContent='Pensil dikesan. Sentuhan jari diabaikan.';}
    if(penSeen&&e.pointerType==='touch')return;
    if(active!==null||demoing)return;
    e.preventDefault();
    try{cv.setPointerCapture(e.pointerId);}catch(_){}
    active=e.pointerId;
    if(checked)clearResult();
    cur=[toPt(e)];strokes.push(cur);redraw();
  },{passive:false});
  cv.addEventListener('pointermove',e=>{
    if(e.pointerId!==active||!cur)return;
    e.preventDefault();
    const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ev of (evs.length?evs:[e])){
      const p=toPt(ev),last=cur[cur.length-1];
      if(Math.hypot(p.x-last.x,p.y-last.y)<.4)continue;
      cur.push(p);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();
    }
  },{passive:false});
  const end=e=>{if(e.pointerId===active){active=null;cur=null;}};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('contextmenu',e=>e.preventDefault());

  $('#wUndo').onclick=()=>{strokes.pop();clearResult();redraw();};
  $('#wClear').onclick=()=>{strokes=[];attemptBest=0;clearResult();redraw();mascotSay('Jom tulis sekali lagi!',null,false);};
  $$('.seg.wide button',main).forEach(b=>b.onclick=()=>{if(b.dataset.mode!==mode)go(screenTulis,ch,b.dataset.mode);});
  const idx=set.indexOf(ch);
  $('#wPrev').onclick=()=>go(screenTulis,set[(idx-1+set.length)%set.length],mode);
  $('#wNext').onclick=()=>go(screenTulis,set[(idx+1)%set.length],mode);

  $('#wDemo').onclick=async()=>{
    if(demoing)return;demoing=true;clearResult();
    const g=document.createElementNS(NS,'g');over.appendChild(g);
    for(const s of tpl){
      if(s.len<3){
        const c=document.createElementNS(NS,'circle');c.setAttribute('cx',s.pts[0].x);c.setAttribute('cy',s.pts[0].y);c.setAttribute('r',3.4);c.setAttribute('class','ghostdot');g.appendChild(c);
        bug.hidden=false;bug.style.left=s.pts[0].x+'%';bug.style.top=(s.pts[0].y/1.2)+'%';await sleep(500);continue;
      }
      const p=document.createElementNS(NS,'path');p.setAttribute('d',s.d);p.setAttribute('class','demo');g.appendChild(p);
      const L=p.getTotalLength();p.style.strokeDasharray=L+' '+L;p.style.strokeDashoffset=L;bug.hidden=false;
      const dur=Math.max(650,L*26),t0=performance.now();
      await new Promise(res=>{const step=now=>{const t=Math.min(1,(now-t0)/dur);p.style.strokeDashoffset=L*(1-t);const q=p.getPointAtLength(L*t);bug.style.left=q.x+'%';bug.style.top=(q.y/1.2)+'%';if(t<1)requestAnimationFrame(step);else res();};requestAnimationFrame(step);});
      await sleep(220);
    }
    bug.hidden=true;await sleep(900);g.remove();demoing=false;
  };

  $('#wCheck').onclick=()=>{
    if(demoing)return;
    if(!strokes.length){mascotSay('Jom tulis dulu, lepas tu tekan Siap.');return;}
    const J=judgeWriting(ch,mode,strokes);const {res,st,flip,short,tb,ib}=J;
    over.innerHTML='';
    const nm=mode==='tulis'?{inv:p=>applyM(J.Minv,p)}:null;
    if(nm){
      const tr=`matrix(${J.Minv.map(v=>v.toFixed(4)).join(' ')})`;
      over.innerHTML=`<g transform="${tr}">${tpl.map(s=>s.len<3?'':`<path class="ghost" vector-effect="non-scaling-stroke" d="${s.d}"/>`).join('')}</g>`;
    }
    if(st<3&&!flip){
      let svg='';res.uncovered.forEach((p,i)=>{if(i%2)return;const q=nm?nm.inv(p):p;svg+=`<circle class="miss" cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="2.3"/>`;});
      res.extraPts.forEach((p,i)=>{if(i%2)return;const q=nm?nm.inv(p):p;svg+=`<circle class="extra" cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="2.2"/>`;});
      over.insertAdjacentHTML('beforeend',svg);
    }
    let lead,spec='',tip='',leadParts=null,specParts=null;
    if(flip)lead='Eh, macam terbalik! Tengok contoh, cuba lagi.';
    else if(short&&st<=1)lead='Belum habis lagi tu. Sambung sikit ya!';
    else if(st===3)lead=pick(['Wah, cantiknya!','Hebat, Husayn!','MasyaAllah, kemas!','Terbaik! Tiga bintang!']);
    else if(st===2){const p2=pick(['Bagus!','Pandai!','Cantik!']);lead=p2+' Sikit lagi nak dapat tiga bintang.';leadParts=[p2,'Sikit lagi nak dapat tiga bintang.'];}
    else if(st===1)lead='Boleh! Jom baiki sikit lagi.';
    else lead=mode==='surih'?'Jom cuba lagi. Ikut garisan putus-putus perlahan-lahan.':'Jom cuba lagi. Tengok contoh dulu, lepas tu tulis.';
    if(!flip&&st<3){
      let wi=0;res.perStroke.forEach((v,i)=>{if(v<res.perStroke[wi])wi=i;});
      if(J.why==='shape')spec='Bentuk huruf ni lain sikit. Tengok contoh ya.';
      else if(J.why==='extra')spec='Ada garisan lebih yang bukan sebahagian huruf ni.';
      else if(res.dotMissing)spec='Jangan lupa titiknya.';
      else if(J.why==='miss'||(res.coverage<.9&&res.perStroke[wi]<.75))if(mode==='surih'&&tpl.length>1){spec=`Garisan nombor ${wi+1} belum cukup. Tengok titik oren.`;specParts=['Garisan nombor',NUMW[wi+1],'Belum cukup. Tengok titik oren.'];}else spec='Ada bahagian belum cukup. Tengok titik oren.';
      else if(res.precision<.8)spec='Tulisan terkeluar garisan sikit. Perlahan-lahan ya.';
    }
    if(mode==='surih'&&st>=1&&!short){const s0=strokes[0][0],t0=tpl[0].pts[0];if(Math.hypot(s0.x-t0.x,s0.y-t0.y)>14)tip='Lain kali, mula dari titik hijau nombor 1.';}
    if(mode==='tulis'&&!flip&&!short){if(ib.h<tb.h*.5)tip='Besarkan sikit tulisan, ikut garisan.';else if(Math.abs(ib.maxY-tb.maxY)>16)tip='Pastikan huruf duduk atas garisan hijau.';}
    if(mode==='surih'&&st===3){tip='Jom cuba Tulis sendiri!';const mt=$('#modeTulis');mt.classList.remove('pulse');void mt.offsetWidth;mt.classList.add('pulse');}
    const full=[lead,spec,tip].filter(Boolean).join(' ');
    mascotSay(full,st>=2?'happy':(st===0?'sad':null),true,[...(leadParts||[lead]),...(specParts||(spec?[spec]:[]))]);
    lastSay=[...(leadParts||[lead]),...(specParts||(spec?[spec]:[]))];
    $$('#wStars span').forEach((s,i)=>{s.classList.remove('on');if(i<st){s.style.animationDelay=(i*.18)+'s';void s.offsetWidth;s.classList.add('on');setTimeout(()=>sfx('star',i),i*180);}});
    addStars(Math.max(0,st-attemptBest));attemptBest=Math.max(attemptBest,st);
    const k=mode==='surih'?'s':'t';const pr=progress[ch]||{s:0,t:0};pr[k]=Math.max(pr[k]||0,st);progress[ch]=pr;store.set('write',progress);
    if(st>=2)celebrate(st);
    checked=true;
  };

  const ro=('ResizeObserver' in window)?new ResizeObserver(()=>fit()):null;
  if(ro)ro.observe($('#padArea'));else window.addEventListener('resize',fit);
  requestAnimationFrame(fit);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(document.body.contains(cv))fit();});
  cleanup=()=>{if(ro)ro.disconnect();else window.removeEventListener('resize',fit);};
  say(intro);
}

/* ---------- MEMBACA ---------- */
function bacaBook(){return Math.min(8,Math.max(1,store.get('bacaBook',4)));}
function bookData(){return BA[bacaBook()];}
/* Words a game may use. A word belongs to the first book whose letters it needs: the book's own word list
   plus the word bank (WB). Only words whose audio exists are used. */
function hasAudio(w){return !!VOICE[vkey(w)];}
const _stage={};
function stageOf(w){if(_stage[w])return _stage[w];let st=WB[w]?wStage(w):9;
  for(let k=1;k<=8;k++)if(BA[k].words.includes(w)){st=Math.min(st,k);break;}
  return _stage[w]=st;}
const ALLW=[...new Set(BA.slice(1).flatMap(b=>b.words).concat(Object.keys(WB)))];
function wordsAt(n,needPic){return ALLW.filter(w=>stageOf(w)===n&&hasAudio(w)&&(!needPic||PIC[w]));}
function bookWords(needPic){
  const n=bacaBook();const cur=wordsAt(n,needPic);let prev=[];for(let k=n-1;k>=1;k--)prev=prev.concat(wordsAt(k,needPic));
  return {cur,prev,all:[...new Set([...cur,...prev])]};}
function picPool(n){let o=[];for(let k=1;k<=n;k++)o=o.concat(wordsAt(k,true));return o;}
/* recently used items, kept across sessions, so the same word does not come back until most others have had a turn */
const RECENT=store.get('recent',{});
function fresh(pool,key='w'){const r=RECENT[key]||(RECENT[key]=[]);const keep=Math.min(60,Math.floor(pool.length*.7));const rec=new Set(r.slice(-keep));
  let c=pool.filter(x=>!rec.has(x));if(!c.length)c=pool;const v=pick(c);r.push(v);if(r.length>80)r.splice(0,r.length-80);
  clearTimeout(fresh.t);fresh.t=setTimeout(()=>store.set('recent',RECENT),500);return v;}
function pickWord(needPic){const {cur,prev}=bookWords(needPic);
  const pool=(cur.length>=4&&(Math.random()<.6||!prev.length))?cur:[...cur,...prev];
  return fresh(pool.length?pool:Object.keys(PIC).filter(hasAudio),'w'+bacaBook()+(needPic?'p':''));}
/* syllables learned up to this book (for review grids and distractors) */
function bookSyl(upto){const out=[];for(let k=1;k<=upto;k++)BA[k].units.forEach(u=>out.push(...u.sy));return [...new Set(out)];}
/* "dua warna": syllables alternate red and black, as in the books */
function duaWarna(w,cls='dw'){let k=0;return w.split(' ').map(word=>`<span class="${cls}">${word.split('-').map((part,pi)=>(pi?'<i>-</i>':'')+sukuKata(part).map(s=>`<b class="${(k++)%2?'k':'m'}">${s}</b>`).join('')).join('')}</span>`).join(' ');}

function screenBacaMenu(){
  curModule=0;
  setBar('Membaca',()=>go(screenHome));
  const n=bacaBook(),b=BA[n];
  const chips=`<div class="chipset k-bacaBook"><span class="chiplbl">Buku</span><div class="chips">${BA.slice(1).map(x=>`<button class="chip book ${x.n===n?'on':''}" data-key="bacaBook" data-v="${x.n}" style="--bk:${x.col}"><b>${x.n}</b><small>${x.focus.split(' · ')[0]}</small></button>`).join('')}</div></div>`;
  const letter=b.units[0].u.replace('-','');
  menuPage({title:'Membaca',color:'sea',ask:`${b.name}: ${b.focus}. Nak main apa?`,chips,
    cards:[
      {icon:`<span class="lt">${b.closed?b.units[0].sy[0]:letter}</span>`,name:b.closed?'Suku kata':'Huruf baru',fn:screenHurufBaru},
      {icon:'👂',name:'Cari bunyi',fn:screenCariBunyi},
      {icon:'🔤',name:'Baca kata',fn:screenBacaKata},
      {icon:'🧩',name:'Susun',fn:screenBina},
      ...(picPool(n).length>=3?[{icon:'🖼️',name:'Gambar',fn:screenPilih}]:[]),
      {icon:'📖',name:'Ayat',fn:screenAyat},
      {icon:'🎲',name:'Soalan campur',fn:screenKuiz,hot:true}]});
  bindChips('bacaBook',screenBacaMenu);
}
function trackHTML(){return `<div class="track" id="track" aria-label="Bintang pusingan ini">${'<i></i>'.repeat(5)}</div>`;}
function setScore(n){const t=$('#track');if(!t)return;const f=n%5===0&&n>0?5:n%5;
  $$('i',t).forEach((el,k)=>{const on=k<f;if(on&&!el.classList.contains('on')){el.classList.add('on');}else if(!on)el.classList.remove('on');});}
function stageHTML(color,animal,mtext,inner,extra=''){
  return `<div class="stage m-${color} ${extra}"><div class="side">${mascot(animal,mtext)}</div><div class="board paper t2">${inner}</div></div>`;}
function actShell(title,back,hint,animal,mtext,color){
  setBar(title,back);main.className='full';
  main.innerHTML=stageHTML(color,animal,mtext,`${trackHTML()}<div id="q" class="qarea"></div>`);
}
function screenHurufBaru(){
  const b=bookData();let ui=0;
  actShell(b.closed?'Suku kata':'Huruf baru',()=>go(screenBacaMenu),'','🐘','Tekan setiap suku kata dan sebut kuat-kuat.','sea');
  function render(){
    const u=b.units[ui],isV=/^[aiu]$/.test(u.u);
    const learned=b.n===1&&isV?['a','i','u'].slice(0,ui+1):u.sy;
    let grid=[];while(grid.length<(b.n<=2||learned.length<3?6:9))grid=grid.concat(shuffle(learned));grid=grid.slice(0,b.n<=2||learned.length<3?6:9);
    const big=u.u.split(' ').map(x=>x.startsWith('-')?`<span class="bl"><i>…</i>${x.slice(1)}</span>`:`<span class="bl ${/^[aiueéo]$/.test(x)?'v':''}">${x}</span>`).join('');
    const blends=b.closed||isV?'':`<div class="blends">${u.sy.map(s=>`<button class="blend" data-s="${s}"><b class="m">${s.slice(0,-1)}</b><i>··</i><b class="k">${s.slice(-1)}</b><span>→</span><b class="w">${s}</b></button>`).join('')}</div>`;
    $('#q').innerHTML=`<div class="unitnav">${b.units.map((x,k)=>`<button class="un ${k===ui?'on':''} ${k<ui?'done':''}" data-k="${k}">${x.u}</button>`).join('')}</div>
      <div class="hb">
        <div class="hbl"><button class="bigl" id="bigl">${big}</button>
          <div class="pics">${u.pics.map(p=>`<button class="pc" data-w="${p}"><span>${PIC[p]||''}</span><small>${duaWarna(p)}</small></button>`).join('')}</div></div>
        <div class="hbr">${blends}<div class="sgrid n${grid.length}">${grid.map((s,k)=>`<button class="sg" data-s="${s}" style="--k:${k}">${/^[^aiueoé]+[aiueoé]$/.test(s)?`<b class="m">${s.slice(0,-1)}</b>${s.slice(-1)}`:s}</button>`).join('')}</div></div>
      </div>
      <div class="row center" id="nxr"></div>`;
    $('#bigl').onclick=()=>{say(u.sy[0]);};
    $$('.pc',main).forEach(x=>x.onclick=()=>say(x.dataset.w));
    $$('.blend',main).forEach(x=>x.onclick=()=>{x.classList.remove('go');void x.offsetWidth;x.classList.add('go');say(x.dataset.s);});
    $$('.un',main).forEach(x=>x.onclick=()=>{ui=+x.dataset.k;render();});
    const seen=new Set();
    $$('.sg',main).forEach(x=>x.onclick=()=>{x.classList.add('lit');say(x.dataset.s);seen.add(x);
      if(seen.size===grid.length&&!$('#nx')){const p=pickNR(PRAISE,'pr');mascotSay(p,'happy',true,[p]);addStars(1);setScore(ui+1);celebrate(2);
        $('#nxr').innerHTML=ui<b.units.length-1?'<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>':'<button class="btn big next" id="nx">Main Cari bunyi <i class="tri"></i></button>';
        $('#nx').onclick=()=>{if(ui<b.units.length-1){ui++;render();}else go(screenCariBunyi);};}});
    lastSay=u.sy;
  }
  render();
}
function screenCariBunyi(){
  const b=bookData();
  actShell('Cari bunyi',()=>go(screenBacaMenu),'','🐘','Dengar, kemudian tekan bunyi yang betul.','sea');
  let right=0,last=null;const mine=[...new Set(b.units.flatMap(u=>u.sy))],old=b.n>1?bookSyl(b.n-1):[];
  function newQ(){
    const t=(old.length&&Math.random()<.3)?fresh(old,'cbo'):fresh(mine,'cb'+b.n);last=t;
    const pool=[...new Set([...mine,...old])].filter(s=>s!==t);
    const opts=shuffle([t,...shuffle(pool).slice(0,b.n<=1?3:5)]);
    $('#q').innerHTML=`<button class="btn big hear" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar</button>
      <div class="opts syls" id="op">${opts.map(o=>`<button class="opt sy" data-v="${o}">${o}</button>`).join('')}</div><div class="row center" id="nxr"></div>`;
    lastSay=t;$('#hear').onclick=()=>say(t);setTimeout(()=>say(t),300);
    bindOpts($('#op'),v=>v===t,()=>{right++;setScore(right);const p=pickNR(PRAISE,'pr');mascotSay(p,'happy',true,[p,t]);addStars(1);celebrate(right%5===0?3:2);
      $('#nxr').innerHTML='<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>';$('#nx').onclick=newQ;});
  }
  newQ();
}
function screenBacaKata(){
  actShell('Baca kata',()=>go(screenBacaMenu),'','🐘','Baca kuat-kuat. Tekan suku kata kalau perlu bantuan.','sea');
  let right=0,last=null;
  function newQ(){
    const w=pickWord(false);last=w;lastSay=null;
    $('#q').innerHTML=`<div class="picslot" id="ps">${PIC[w]?'<span class="qm">?</span>':''}</div>
      <div class="word big">${duaWarna(w)}</div>
      <div class="parent"><span class="lbl">Ibu/Ayah: dengar Husayn baca, kemudian tekan</span><button class="btn leaf" id="ok"><img src="img/ic-check.webp" alt="">Betul</button><button class="btn sun" id="ag"><img src="img/ic-undo.webp" alt="">Ulang</button><button class="btn soft" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar</button></div>`;
    $$('.word b',main).forEach(x=>x.onclick=()=>{x.classList.remove('lit');void x.offsetWidth;x.classList.add('lit');say(x.textContent);});
    $('#hear').onclick=()=>say(w);
    $('#ag').onclick=()=>{mascotSay('Tak apa. Baca sekali lagi, satu-satu suku kata.');(async()=>{for(const x of $$('.word b',main)){x.classList.add('lit');await sleep(650);x.classList.remove('lit');}})();};
    $('#ok').onclick=()=>{if($('#ok').disabled)return;$('#ok').disabled=true;right++;setScore(right);if(PIC[w])$('#ps').innerHTML=`<span class="pop">${PIC[w]}</span>`;
      const p=pickNR(PRAISE,'pr');mascotSay(p,'happy',true,[p,w]);addStars(1);celebrate(right%5===0?3:2);setTimeout(newQ,1900);};
  }
  newQ();
}
function screenBina(){
  actShell('Susun',()=>go(screenBacaMenu),'','🐘','Susun suku katanya.','sea');
  let w,parts,tiles,slots,solved,right=0,last=null,told=false,toldE=false;
  function newQ(){
    w=Math.random()<.6?pickWord(true):pickWord(false);last=w;parts=w.split('-').flatMap(sukuKata);if(parts.length<2){w=pickWord(true);parts=w.split('-').flatMap(sukuKata);}
    const pool=bookSyl(bacaBook()).concat(bookWords(false).all.flatMap(sukuKata));
    const others=shuffle([...new Set(pool)].filter(s=>!parts.includes(s))).slice(0,parts.length>3?1:2);
    tiles=shuffle([...parts,...others]).map(t=>({t,used:false}));slots=parts.map(()=>null);solved=false;lastSay=w;render(true);
    if(PIC[w]){const t='Ini gambar apa? Susun suku katanya.';mascotSay(t,null,!told&&!!VOICE[vkey(t)]);told=true;}
    else{const t='Dengar, kemudian susun suku katanya.';mascotSay(t,null,false);const pp=(!toldE&&VOICE[vkey(t)])?[t,w]:[w];toldE=true;setTimeout(()=>say(pp),350);}
  }
  function render(fresh){
    $('#q').innerHTML=`${PIC[w]?`<div class="bigpic" ${fresh?'':'style="animation:none"'}>${PIC[w]}</div>`:`<button class="bigear" id="ear" ${fresh?'':'style="animation:none"'}><img src="img/ic-speaker.webp" alt="Dengar"></button>`}
      <div class="slots">${slots.map((s,k)=>`<button class="slot ${s!==null?'filled':''} ${solved?'good':''}" data-k="${k}">${s!==null?tiles[s].t:''}</button>`).join('')}</div>
      <div class="tiles">${tiles.map((t,i)=>`<button class="syl ${t.used?'used':''}" data-i="${i}" ${solved?'disabled':''}>${t.t}</button>`).join('')}</div>
      <div class="row center">${solved?'<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>':'<button class="btn soft" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar</button>'}</div>`;
    $$('.syl',main).forEach(b=>b.onclick=()=>{
      const i=+b.dataset.i;if(solved||tiles[i].used)return;const k=slots.indexOf(null);if(k<0)return;
      tiles[i].used=true;slots[k]=i;sfx('tap');if(hasAudio(tiles[i].t))say(tiles[i].t);render();if(slots.indexOf(null)<0)check();});
    $$('.slot',main).forEach(b=>b.onclick=()=>{const k=+b.dataset.k;if(solved||slots[k]===null)return;tiles[slots[k]].used=false;slots[k]=null;render();});
    if(solved)$('#nx').onclick=newQ;else $('#hear').onclick=()=>say(w);if($('#ear'))$('#ear').onclick=()=>say(w);
  }
  function check(){
    const ok=slots.every((s,k)=>tiles[s].t===parts[k]);
    if(ok){solved=true;right++;setScore(right);render();const p=pickNR(PRAISE,'pr');mascotSay(`${p} ${parts.join('-')}, ${w}.`,'happy',true,[p,w]);addStars(1);celebrate(right%5===0?3:2);}
    else{$$('.slot',main).forEach((b,k)=>{if(tiles[slots[k]].t!==parts[k])b.classList.add('bad');});mascotSay(pickNR(TRY,'try'),'sad');
      setTimeout(()=>{slots=slots.map((s,k)=>{if(s!==null&&tiles[s].t!==parts[k]){tiles[s].used=false;return null;}return s;});render();},1000);}
  }
  newQ();
}
function screenPilih(){
  actShell('Gambar',()=>go(screenBacaMenu),'','🐘','Baca perkataan, kemudian tekan gambarnya.','sea');
  let right=0,last=null;
  function newQ(){
    lastSay=null;const w=pickWord(true);last=w;
    const all=bookWords(true).all.concat(Object.keys(PIC));const opts=[w];
    for(const x of shuffle(all)){if(opts.length>=3)break;if(!opts.some(o=>PIC[o]===PIC[x]))opts.push(x);}
    $('#q').innerHTML=`<div class="word big">${duaWarna(w)}</div>
      <div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt pic" data-v="${o}" aria-label="gambar">${PIC[o]}</button>`).join('')}</div>
      <div class="row center" id="nxr"></div>`;
    $$('.word b',main).forEach(x=>x.onclick=()=>say(x.textContent));
    bindOpts($('#op'),v=>v===w,()=>{right++;setScore(right);const p=pickNR(PRAISE,'pr');mascotSay(`${p} Itu ${w}.`,'happy',true,[p,'itu',w]);addStars(1);celebrate(right%5===0?3:2);
      $('#nxr').innerHTML='<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>';$('#nx').onclick=newQ;});
  }
  newQ();
}
/* Sentences: the book's own, plus simple sentences built from the word bank. Every word in a built sentence
   uses letters already learned and has its own recording, so "Dengar ayat" reads it word by word. */
const BIG='gajah zirafah unta kerbau lembu beruang paus harimau singa buaya kuda'.split(' '),SMALL='semut nyamuk lebah tikus siput ulat lipas itik arnab'.split(' ');
const _sent={};
function sentPool(n){if(_sent[n]&&_sent[n].v===VOICE_VER)return _sent[n].a;
  const ok=w=>stageOf(w)<=n&&hasAudio(w),f=a=>a.filter(ok);
  const ppl=f(['ibu','bapa','ani','abu','sani','nani','ali','amin','mama','papa','kakak','adik','abang','datuk','nenek','guru']);
  const an=f(CAT.haiwan||[]),food=f((CAT.makanan||[]).concat(['nasi','roti','ikan','kek'])),drink=f(['susu','kopi','air']),thing=f(CAT.benda||[]);
  const seen=f([...new Set(an.concat(thing,food))]).filter(w=>PIC[w]);const o=[];
  const cap=x=>n>=6?x.replace(/^./,c=>c.toUpperCase()).replace(/\b(ali|ani|abu|sani|nani|amin|budin)\b/g,c=>c[0].toUpperCase()+c.slice(1)):x;
  for(const N of seen){if(ok('ini'))o.push(`ini ${N}.`);if(ok('itu'))o.push(`itu ${N}.`);if(ok('mana')&&ok('itu'))o.push(`mana ${N}? itu ${N}.`);}
  for(const P of ppl){if(ok('ada'))for(const T of thing.concat(an))o.push(`${P} ada ${T}.`);
    if(ok('suka'))for(const F of food.concat(an))o.push(`${P} suka ${F}.`);
    if(ok('makan'))for(const F of food)o.push(`${P} makan ${F}.`);
    if(ok('minum'))for(const D of drink)o.push(`${P} minum ${D}.`);}
  if(ok('saya')){if(ok('suka'))for(const F of food)o.push(`saya suka ${F}.`);if(ok('ada'))for(const T of thing)o.push(`saya ada ${T}.`);}
  if(ok('besar'))for(const A of an.filter(x=>BIG.includes(x)))o.push(`${A} itu besar.`);
  if(ok('kecil'))for(const A of an.filter(x=>SMALL.includes(x)))o.push(`${A} itu kecil.`);
  const a=[...new Set(o)].map(cap);_sent[n]={v:VOICE_VER,a};return a;}
function bookSentences(n){return BA[n].sent.map(x=>x.replace(' (*)',''));}
function pickSentence(n){const own=bookSentences(n),old=BA.slice(1,n).flatMap(x=>x.sent).map(x=>x.replace(' (*)','')),built=sentPool(n);
  const r=Math.random();const pool=r<.3?own:(r<.45&&old.length?old:(built.length?built:own));return fresh(pool,'s'+n);}
function sayAyat(t){return say(VOICE[vkey(t)]?t:t.replace(/[.,?!]/g,'').split(' '));}
function sylW(w){return w.split('-').flatMap(sukuKata);}
/* n distractors for target from pool; about half share a syllable with it so they are not too easy */
function distract(target,pool,n,same=x=>x){
  const cand=shuffle([...new Set(pool)].filter(x=>x!==target&&same(x)!==same(target)));
  const ts=new Set(sylW(String(target)));
  const near=cand.filter(x=>sylW(String(x)).some(y=>ts.has(y))),far=cand.filter(x=>!near.includes(x));
  const out=[];const half=Math.ceil(n/2);
  for(const x of near){if(out.length>=half)break;out.push(x);}
  for(const x of far.concat(near)){if(out.length>=n)break;if(!out.includes(x))out.push(x);}
  return out;}
/* SOALAN CAMPUR: one question type after another, never the same type twice in a row */
function screenKuiz(){
  actShell('Soalan campur',()=>go(screenBacaMenu),'','🐘','Jom jawab soalan!','sea');
  const b=bookData(),n=b.n;let right=0,bag=[],lastT=null;
  const words=()=>bookWords(false),pics=()=>bookWords(true).all;
  const mine=[...new Set(b.units.flatMap(u=>u.sy))],old=n>1?bookSyl(n-1):[],allSyl=[...new Set([...mine,...old])];
  const multi=w=>sylW(w).length>=2;
  const T={
    dengarKata(){ // hear a word, tap the written word
      const w=pickWord(false),opts=shuffle([w,...distract(w,words().all,2)]);
      ask('Dengar, kemudian tekan bunyi yang betul.',false);
      q(`<button class="btn big hear" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar</button>${wordOpts(opts)}`);
      lastSay=w;$('#hear').onclick=()=>say(w);setTimeout(()=>say(w),300);
      done(v=>v===w,w);},
    gambarKata(){ // picture, tap its word
      const w=pickWord(true),opts=shuffle([w,...distract(w,pics().concat(words().all),2,x=>PIC[x]||x)]);
      ask('Ini gambar apa? Tekan perkataannya.');
      q(`<div class="bigpic">${PIC[w]}</div>${wordOpts(opts)}`);lastSay=null;
      done(v=>v===w,w);},
    kataGambar(){ // word, tap its picture
      const w=pickWord(true),pool=pics().concat(Object.keys(PIC)),opts=[w];
      for(const x of shuffle(pool)){if(opts.length>=3)break;if(!opts.some(o=>PIC[o]===PIC[x]))opts.push(x);}
      ask('Baca perkataan, kemudian tekan gambarnya.');
      q(`<div class="word big">${duaWarna(w)}</div><div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt pic" data-v="${o}" aria-label="gambar">${PIC[o]}</button>`).join('')}</div>`);
      $$('.word b',main).forEach(x=>x.onclick=()=>say(x.textContent));lastSay=null;
      done(v=>v===w,w);},
    sukuHilang(){ // one syllable is missing
      let w,t=0;do{w=pickWord(Math.random()<.5);}while((!multi(w)||!sylW(w).every(hasAudio))&&++t<40);
      if(!multi(w)||!sylW(w).every(hasAudio))return T.kiraSuku();
      const parts=sylW(w),k=rint(0,parts.length-1),ans=parts[k],opts=shuffle([ans,...distract(ans,allSyl,2)]);
      ask('Suku kata mana yang hilang?');
      q(`${PIC[w]?`<div class="bigpic sm">${PIC[w]}</div>`:''}<div class="word big gap">${parts.map((x,i)=>i===k?'<b class="hole" id="hole">?</b>':`<b class="${i%2?'k':'m'}">${x}</b>`).join('')}</div>
        <div class="opts syls" id="op">${opts.map(o=>`<button class="opt sy" data-v="${o}">${o}</button>`).join('')}</div>`);
      lastSay=null;$$('.opt',main).forEach(x=>x.addEventListener('click',()=>say(x.dataset.v)));
      done(v=>v===ans,w,()=>{const h=$('#hole');h.textContent=ans;h.className=k%2?'k fill':'m fill';});},
    dengarSuku(){ // hear a syllable, tap it
      let t;do{t=(old.length&&Math.random()<.3)?pick(old):pick(mine);}while(t===lastSyl&&mine.length>1);lastSyl=t;
      const opts=shuffle([t,...shuffle(allSyl.filter(x=>x!==t)).slice(0,n<=1?2:3)]);
      ask('Dengar, kemudian tekan bunyi yang betul.',false);
      q(`<button class="btn big hear" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar</button><div class="opts syls" id="op">${opts.map(o=>`<button class="opt sy" data-v="${o}">${o}</button>`).join('')}</div>`);
      lastSay=t;$('#hear').onclick=()=>say(t);setTimeout(()=>say(t),300);
      done(v=>v===t,t);},
    mulaBunyi(){ // which word starts with this syllable?
      const pool=words().all;let w,t=0,first,others;
      do{w=pickWord(false);first=sylW(w)[0];others=pool.filter(x=>sylW(x)[0]!==first);}while((others.length<2||!hasAudio(first))&&++t<30);
      if(!hasAudio(first))return T.dengarKata();
      if(others.length<2)return T.dengarKata();
      const opts=shuffle([w,...distract(w,others,2)]);
      ask(`Mana yang mula dengan bunyi "${first}"?`,true,[first],'Mana yang mula dengan bunyi ini?');
      q(`<button class="bigsyl" id="hear">${first}</button>${wordOpts(opts)}`);
      $('#hear').onclick=()=>say(first);
      done(v=>v===w,w);},
    kiraSuku(){ // how many syllables?
      const w=pickWord(Math.random()<.5),k=sylW(w).length,opts=numOpts(k,1,5);
      ask('Ada berapa suku kata? Tekan setiap suku kata dulu.',true,null,'Ada berapa suku kata?');
      q(`${PIC[w]?`<div class="bigpic sm">${PIC[w]}</div>`:''}<div class="word big gap">${sylW(w).map((x,i)=>`<b class="${i%2?'k':'m'}">${x}</b>`).join('')}</div>
        <div class="opts" id="op">${opts.map(o=>`<button class="opt" data-v="${o}">${o}</button>`).join('')}</div>`);
      $$('.word b',main).forEach(x=>x.onclick=()=>{x.classList.remove('lit');void x.offsetWidth;x.classList.add('lit');say(x.textContent);});lastSay=null;
      done(v=>+v===k,w);},
    ayatHilang(){ // which word is missing from the sentence?
      const raw=pickSentence(n),ws=raw.split(' ');
      const cand=ws.map((x,i)=>[x.replace(/[.,?!]/g,''),i]).filter(([x])=>x.length>=3&&!/^(ini|itu|mana|saya|ada|di|dan)$/i.test(x)&&(words().all.includes(x.toLowerCase())||PIC[x.toLowerCase()]));
      if(!cand.length)return T.dengarKata();
      const [ans,i]=pick(cand),low=ans.toLowerCase(),inSent=new Set(ws.map(x=>x.replace(/[.,?!]/g,'').toLowerCase()));
      const opts=shuffle([low,...distract(low,words().all.filter(x=>!inSent.has(x)),2)]);
      const tail=ws[i].slice(ans.length);
      ask('Perkataan mana yang hilang?');
      q(`<div class="sent">${ws.map((x,j)=>j===i?`<span class="hole" id="hole">?</span>${tail}`:`<button>${duaWarna(x)}</button>`).join(' ')}</div>${wordOpts(opts)}`);
      $$('.sent button',main).forEach(x=>x.onclick=()=>say(x.textContent.replace(/[.,?!]/g,'')));lastSay=null;
      done(v=>v===low,VOICE[vkey(raw)]?[raw]:raw.replace(/[.,?!]/g,'').split(' '),()=>{const h=$('#hole');h.textContent=ans;h.classList.add('fill');});}
  };
  let lastSyl=null;
  const q=html=>{$('#q').innerHTML=html+'<div class="row center" id="nxr"></div>';};
  const wordOpts=opts=>`<div class="opts words" id="op">${opts.map(o=>`<button class="opt wd" data-v="${o}">${duaWarna(o)}</button>`).join('')}</div>`;
  /* the instruction is spoken the first time each kind of question comes up; after that it is only shown
     (tap the guide to hear it again), so the same sentence is not heard over and over */
  const told=new Set();
  function ask(text,speak=true,extra,audioText){mascotSay(text,null,false);const at=audioText||text,parts=[];
    if(speak&&VOICE[vkey(at)]&&!told.has(at)){told.add(at);parts.push(at);}
    if(extra)parts.push(...extra);lastSay=extra?extra:(VOICE[vkey(at)]?at:null);if(parts.length)setTimeout(()=>say(parts),200);}
  function done(isRight,w,onOk,quiet){
    bindOpts($('#op'),isRight,()=>{right++;setScore(right);if(onOk)onOk();const p=pickNR(PRAISE,'pr');
      mascotSay(p,'happy',true,quiet?[p]:(Array.isArray(w)?[p,...w]:(w?[p,w]:[p])));addStars(1);celebrate(right%5===0?3:2);
      $('#nxr').innerHTML='<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>';$('#nx').onclick=newQ;});}
  function types(){return Object.keys(T).filter(k=>!(/gambar/i.test(k))||pics().length>=3);}
  function newQ(){
    if(!bag.length){bag=shuffle(types());if(bag[0]===lastT&&bag.length>1)bag.push(bag.shift());}
    const t=bag.shift();lastT=t;stopVoice();T[t]();}
  newQ();
}
function screenAyat(){
  actShell('Ayat',()=>go(screenBacaMenu),'','🐘','Baca perlahan-lahan ya.','sea');
  const b=bookData();let right=0;
  function render(){
    const t=pickSentence(b.n);lastSay=null;
    const pw=t.toLowerCase().replace(/[.,?!]/g,'').split(' ').find(x=>PIC[x]);
    $('#q').innerHTML=`<div class="bigpic">${pw?PIC[pw]:'📖'}</div><div class="sent">${t.split(' ').map(x=>`<button>${duaWarna(x)}</button>`).join('')}</div>
      <div class="parent"><span class="lbl">Ibu/Ayah: dengar Husayn baca, kemudian tekan</span><button class="btn leaf" id="ok"><img src="img/ic-check.webp" alt="">Betul</button><button class="btn sun" id="ag"><img src="img/ic-undo.webp" alt="">Ulang</button><button class="btn soft" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar ayat</button></div>`;
    $$('.sent button',main).forEach(x=>x.onclick=()=>{x.classList.add('lit');say(x.textContent.replace(/[.,?!]/g,''));setTimeout(()=>x.classList.remove('lit'),1200);});
    $('#hear').onclick=()=>sayAyat(t);
    $('#ok').onclick=()=>{if($('#ok').disabled)return;$('#ok').disabled=true;right++;setScore(right);mascotSay(pickNR(PRAISE,'pr'),'happy');addStars(1);celebrate(right%4===0?3:2);setTimeout(render,1100);};
    $('#ag').onclick=()=>mascotSay('Tak apa. Baca sekali lagi, satu-satu perkataan.');
  }
  render();
}

/* ---------- MENGIRA: Tang Math sequence (concrete → picture → number; group, don't count by ones) ---------- */
const NUMW=['sifar','satu','dua','tiga','empat','lima','enam','tujuh','lapan','sembilan','sepuluh'];
const ANIMALS=['🐥','🐟','🐸','🐞','🐢','🐰','🐱','🐵','🦆','🐝','🐘','🦒','🐻','🐼','🦁','🐯','🐮','🐔','🐧','🦋','🐌','🦀','🐠','🐬','🦊','🐿️','🦔','🦜','🦉','🦓','🐨','🐳'];
const TAHAP=[null,
 {n:1,name:'1 hingga 5',max:5,col:'#2A9DA8',acts:['kenal','kilat','isi']},
 {n:2,name:'Tambah hingga 5',max:5,col:'#F6A93B',acts:['ikatan','tambah','kilatTambah']},
 {n:3,name:'Tolak hingga 5',max:5,col:'#E8573F',acts:['tolak','hilang','kilatTolak']},
 {n:4,name:'6 hingga 10',max:10,col:'#6B4E9B',acts:['kenal','kilat','isi']},
 {n:5,name:'Tambah hingga 10',max:10,col:'#2F8F5B',acts:['ikatan','tambah','buat10']},
 {n:6,name:'Tolak hingga 10',max:10,col:'#1E7C86',acts:['tolak','hilang','kilatTolak']}];
const KACT={
 kenal:{icon:'🔢',name:'Nombor',fn:()=>screenKenal()},
 kilat:{icon:'⚡',name:'Kilat',fn:()=>screenKilat('n')},
 kilatTambah:{icon:'⚡',name:'Kilat',fn:()=>screenKilat('add')},
 kilatTolak:{icon:'⚡',name:'Kilat',fn:()=>screenKilat('sub')},
 isi:{icon:'🧺',name:'Isi bakul',fn:()=>screenIsi()},
 ikatan:{icon:'🔗',name:'Ikatan',fn:()=>screenIkatan('add')},
 hilang:{icon:'🔍',name:'Cari hilang',fn:()=>screenIkatan('sub')},
 tambah:{icon:'➕',name:'Tambah',fn:()=>screenTambah(),say:'tambah'},
 tolak:{icon:'➖',name:'Tolak',fn:()=>screenTolak(),say:'tolak'},
 buat10:{icon:'🔟',name:'Buat 10',fn:()=>screenBuat10()},
 campur:{icon:'🎲',name:'Soalan campur',fn:()=>screenKiraKuiz(),hot:true}};
function kTahap(){return Math.min(6,Math.max(1,store.get('kTahap',1)));}
function kMax(){return TAHAP[kTahap()].max;}
function kMin(){return kTahap()>=4?6:1;}

/* five frame (≤5) or ten frame, filled top row first so 8 reads as "5 and 3".
   parts: [[count, emoji, cls], ...] fill in order; gone = how many of the last filled cells are crossed out */
function frameHTML(parts,cap,opt={}){
  let cells=[];parts.forEach(([n,e,cls])=>{for(let i=0;i<n;i++)cells.push({e,cls});});
  const tot=cells.length;
  return `<div class="frame f${cap} ${opt.cls||''} ${opt.still?'still':''}">${Array.from({length:cap},(_,i)=>{const c=cells[i];
    const gone=opt.gone&&c&&i>=tot-opt.gone;
    return `<div class="cell ${c?'on '+(c.cls||''):''} ${gone?'gone':''}" data-i="${i}">${c?`<span style="--k:${i}">${c.e}</span>`:''}</div>`;}).join('')}</div>`;}
function frameCap(n){return n>5||kMax()>5?10:5;}
/* number bond: total on top, two parts below */
function bondHTML(total,a,b,miss){
  const c=(v,k)=>`<div class="bc ${k} ${miss===k?'miss':''}">${miss===k?'<span class="qm" id="qm">?</span>':v}</div>`;
  return `<div class="bond"><svg viewBox="0 0 200 120" preserveAspectRatio="none"><line x1="100" y1="30" x2="40" y2="95"/><line x1="100" y1="30" x2="160" y2="95"/></svg>${c(total,'t')}${c(a,'a')}${c(b,'b')}</div>`;}
function optsHTML(ans,min,max){return `<div class="opts" id="op">${numOpts(ans,min,max).map(v=>`<button class="opt" data-v="${v}">${v}</button>`).join('')}</div>`;}
function nextBtn(cb){$('#nxr').innerHTML='<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>';$('#nx').onclick=cb;}
/* deck: every combination once, in random order, before any comes back */
const DECKS={};
function deal(key,make){let d=DECKS[key];if(!d||!d.length){const all=make();d=DECKS[key]=shuffle(all);
  const last=DECKS[key+':last'];if(last!=null&&d.length>1&&JSON.stringify(d[d.length-1])===last)d.unshift(d.pop());}
  const v=d.pop();DECKS[key+':last']=JSON.stringify(v);return v;}
function range(a,b){const o=[];for(let i=a;i<=b;i++)o.push(i);return o;}
let _lastAn=[];
function pickAnimal(not){const c=ANIMALS.filter(x=>x!==not&&!_lastAn.includes(x));const a=pick(c.length?c:ANIMALS);_lastAn.push(a);if(_lastAn.length>4)_lastAn.shift();return a;}
function winRound(r,parts){setScore(r);const p=pickNR(PRAISE,'pr');mascotSay(p,'happy',true,[p,...(parts||[])]);addStars(1);celebrate(r%5===0?3:2);}

function screenKiraMenu(){
  curModule=1;
  setBar('Mengira',()=>go(screenHome));
  const t=kTahap(),T=TAHAP[t];
  const chips=`<div class="chipset k-kTahap"><span class="chiplbl">Tahap</span><div class="chips">${TAHAP.slice(1).map(x=>`<button class="chip book ${x.n===t?'on':''}" data-key="kTahap" data-v="${x.n}" style="--bk:${x.col}"><b>${x.n}</b><small>${['','1-5','+5','−5','6-10','+10','−10'][x.n]}</small></button>`).join('')}</div></div>`;
  menuPage({title:'Mengira',color:'sun',chips,ask:`Tahap ${t}: ${T.name}. Nak main apa?`,cards:T.acts.concat('campur').map(k=>KACT[k])});
  bindChips('kTahap',screenKiraMenu);
}

function screenKenal(){
  const max=kMax(),min=kMin()>5?1:1;
  setBar('Nombor',()=>go(screenKiraMenu));main.className='full';
  main.innerHTML=stageHTML('sun','🐵','Tekan nombor. Tengok bingkai!',`<div class="kenal"><div class="numpad n${max}">${Array.from({length:max},(_,i)=>`<button class="numbtn" data-n="${i+1}" style="--k:${i}">${i+1}</button>`).join('')}</div><div class="numshow" id="ns"></div></div>`);
  function show(n){
    $$('.numbtn',main).forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
    const an=pick(ANIMALS),cap=max>5?10:5;
    const parts=n>5?[[5,an,'pa'],[n-5,an,'pb']]:[[n,an,'pa']];
    $('#ns').innerHTML=`<div><div class="bignum">${n}</div><div class="numword">${NUMW[n]}</div>${n>5?`<div class="fivemore"><b>5</b> dan <b>${n-5}</b></div>`:''}</div>${frameHTML(parts,cap)}`;
    lastSay=NUMW[n];say(NUMW[n]);
  }
  $$('.numbtn',main).forEach(b=>b.onclick=()=>show(+b.dataset.n));
  show(kMin());
}
/* subitise: the frame shows for a moment, then hides; pick how many */
function screenKilat(mode){
  actShell('Kilat',()=>go(screenKiraMenu),'','🐵','Tengok cepat! Ada berapa?','sun');
  let right=0;const max=kMax(),min=kMin();
  function newQ(){
    lastSay=null;let ans,parts,eq='';const an=pickAnimal(),an2=pickAnimal(an);
    if(mode==='n'){ans=deal('kn'+max,()=>range(Math.max(1,min-(min>1?2:0)),max));parts=ans>5?[[5,an,'pa'],[ans-5,an,'pb']]:[[ans,an,'pa']];}
    else if(mode==='add'){const [a,b]=deal('ka'+max,()=>range(1,max-1).flatMap(a=>range(1,max-a).map(b=>[a,b])));ans=a+b;parts=[[a,an,'pa'],[b,an2,'pb']];eq=`${a} + ${b}`;}
    else{const [a,b]=deal('ks'+max,()=>range(2,max).flatMap(a=>range(1,a-1).map(b=>[a,b])));ans=a-b;parts=[[a,an,'pa']];eq=`${a} − ${b}`;}
    const cap=max>5?10:5,gone=mode==='sub'?+eq.split('−')[1]:0;
    $('#q').innerHTML=`${eq?`<div class="eq">${eq} = <span class="qmark" id="qm">?</span></div>`:''}<div class="flash" id="fl">${frameHTML(parts,cap,{gone})}<div class="cover" id="cv">👀</div></div>${optsHTML(ans,0,max)}<div class="row center" id="nxr"><button class="btn soft" id="again"><img src="img/ic-play.webp" alt="">Tengok lagi</button></div>`;
    const fl=$('#fl');const flash=()=>{fl.classList.remove('hid');setTimeout(()=>{if(document.body.contains(fl))fl.classList.add('hid');},max>5?2200:1600);};
    setTimeout(flash,300);$('#again').onclick=flash;
    bindOpts($('#op'),v=>+v===ans,()=>{fl.classList.remove('hid');const q=$('#qm');if(q){q.textContent=ans;q.classList.add('done');}right++;winRound(right,[NUMW[ans]]);nextBtn(newQ);});
  }
  newQ();
}
/* Feed the basket: put exactly N animals into the frame */
function screenIsi(){
  actShell('Isi bakul',()=>go(screenKiraMenu),'','🐵','Masukkan ikut nombor.','sun');
  let right=0;const max=kMax(),min=kMin();
  function newQ(){
    const n=deal('isi'+min+max,()=>range(min,max)),an=pickAnimal(),cap=max>5?10:5;let have=0;lastSay=NUMW[n];
    $('#q').innerHTML=`<div class="target"><b>${n}</b><span>${NUMW[n]}</span></div>${frameHTML([],cap,{cls:'tap'})}<div class="row center" id="nxr"><button class="btn soft" id="undo"><img src="img/ic-undo.webp" alt="">Keluar satu</button><button class="btn big leaf" id="chk"><img src="img/ic-check.webp" alt="">Siap!</button></div>`;
    say(NUMW[n]);
    const cells=$$('.cell',main);
    const draw=()=>cells.forEach((c,i)=>{c.className='cell'+(i<have?' on pa':'');c.innerHTML=i<have?`<span>${an}</span>`:'';});
    cells.forEach(c=>c.onclick=()=>{if(have<cap){have++;sfx('tap');draw();if(have<=10)say(NUMW[have]);}});
    $('#undo').onclick=()=>{if(have>0){have--;draw();}};
    $('#chk').onclick=()=>{if(have===n){right++;winRound(right,['ada',NUMW[n]]);nextBtn(newQ);}else{mascotSay(have<n?'Belum cukup. Tambah lagi!':'Terlebih. Keluarkan sikit.','sad',false);$('.frame',main).classList.add('shakeit');setTimeout(()=>{const f=$('.frame',main);if(f)f.classList.remove('shakeit');},500);}};
  }
  newQ();
}
/* number bond: add → find the total; sub → find the missing part */
function screenIkatan(op){
  actShell(op==='add'?'Ikatan':'Cari hilang',()=>go(screenKiraMenu),'','🐵',op==='add'?'Dua bahagian. Semuanya berapa?':'Semuanya ada. Satu bahagian hilang!','sun');
  let right=0;const max=kMax();
  function newQ(){
    const [t,a]=deal('ik'+op+max,()=>range(Math.max(2,kMin()),max).flatMap(t=>range(1,t-1).map(a=>[t,a]))),b=t-a,an=pickAnimal(),an2=pickAnimal(an);
    const miss=op==='add'?'t':pick(['a','b']),ans=miss==='t'?t:miss==='a'?a:b;
    lastSay=op==='add'?[NUMW[a],'tambah',NUMW[b]]:null;
    const parts=miss==='t'?[[a,an,'pa'],[b,an2,'pb']]:miss==='a'?[[b,an2,'pb']]:[[a,an,'pa']];
    $('#q').innerHTML=`${bondHTML(t,a,b,miss)}${frameHTML(parts,frameCap(t))}${optsHTML(ans,1,max)}<div class="row center" id="nxr"></div>`;
    bindOpts($('#op'),v=>+v===ans,()=>{const q=$('#qm');q.textContent=ans;q.parentNode.classList.add('done');
      $('.frame',main).outerHTML=frameHTML([[a,an,'pa'],[b,an2,'pb']],frameCap(t),{still:true});right++;
      winRound(right,[NUMW[a],'tambah',NUMW[b],'jadi',NUMW[t]]);nextBtn(newQ);});
  }
  newQ();
}
function screenTambah(){
  actShell('Tambah',()=>go(screenKiraMenu),'','🐵','Dua kumpulan. Semuanya berapa?','sun');
  let right=0;const max=kMax();
  function newQ(){
    const [a,b]=deal('tb'+max,()=>range(1,max-1).flatMap(a=>range(1,Math.min(max-a,5)).map(b=>[a,b]))),ans=a+b,an=pickAnimal(),an2=pickAnimal(an);
    lastSay=[NUMW[a],'tambah',NUMW[b]];
    $('#q').innerHTML=`<div class="eq">${a} + ${b} = <span class="qmark" id="qm">?</span></div>${frameHTML([[a,an,'pa'],[b,an2,'pb']],frameCap(ans))}${optsHTML(ans,1,max)}<div class="row center" id="nxr"><button class="btn soft" id="show"><img src="img/ic-play.webp" alt="">Tunjuk cara</button></div>`;
    const done=()=>{const q=$('#qm');q.textContent=ans;q.classList.add('done');};
    $('#show').onclick=async()=>{say([NUMW[a],'tambah',NUMW[b]]);const cells=$$('.cell.on',main);
      for(let i=0;i<cells.length;i++){cells[i].classList.add('hl');await sleep(i<a?120:520);}  /* start from a, count on */
      done();say(['semuanya',NUMW[ans]]);};
    bindOpts($('#op'),v=>+v===ans,()=>{done();right++;winRound(right,[NUMW[a],'tambah',NUMW[b],'jadi',NUMW[ans]]);nextBtn(newQ);});
  }
  newQ();
}
function screenTolak(){
  actShell('Tolak',()=>go(screenKiraMenu),'','🐵','Ada yang lari! Tinggal berapa?','sun');
  let right=0;const max=kMax();
  function newQ(){
    const [a,b]=deal('tl'+max,()=>range(Math.max(2,kMin()),max).flatMap(a=>range(1,a-1).map(b=>[a,b]))),ans=a-b,an=pickAnimal();
    lastSay=[NUMW[a],'tolak',NUMW[b]];
    $('#q').innerHTML=`<div class="eq">${a} − ${b} = <span class="qmark" id="qm">?</span></div><div id="fw">${frameHTML([[a,an,'pa']],frameCap(a))}</div>${optsHTML(ans,0,max)}<div class="row center" id="nxr"></div>`;
    setTimeout(()=>{const fw=$('#fw');if(!fw)return;sfx('whoosh');fw.innerHTML=frameHTML([[a,an,'pa']],frameCap(a),{gone:b,still:true});say(['ada',NUMW[a],NUMW[b],'pergi']);},900);
    bindOpts($('#op'),v=>+v===ans,()=>{const q=$('#qm');q.textContent=ans;q.classList.add('done');right++;winRound(right,[NUMW[a],'tolak',NUMW[b],'tinggal',NUMW[ans]]);nextBtn(newQ);});
  }
  newQ();
}
function screenBuat10(){
  actShell('Buat 10',()=>go(screenKiraMenu),'','🐵','Berapa lagi nak jadi sepuluh?','sun');
  let right=0;
  function newQ(){
    const n=deal('b10',()=>range(1,9)),an=pickAnimal(),ans=10-n;lastSay=[NUMW[n]];
    $('#q').innerHTML=`<div class="eq">${n} + <span class="qmark" id="qm">?</span> = 10</div>${frameHTML([[n,an,'pa']],10)}${optsHTML(ans,1,9)}<div class="row center" id="nxr"></div>`;
    bindOpts($('#op'),v=>+v===ans,()=>{const q=$('#qm');q.textContent=ans;q.classList.add('done');
      $('.frame',main).outerHTML=frameHTML([[n,an,'pa'],[ans,'⭐','pb']],10,{still:true});right++;winRound(right,[NUMW[n],'tambah',NUMW[ans],'jadi','sepuluh']);nextBtn(newQ);});
  }
  newQ();
}

/* SOALAN CAMPUR (Mengira): several kinds of question in turn. A kind whose spoken instruction is not recorded
   is left out, because Husayn cannot read the instruction yet. */
function scatterHTML(n,an){ // n animals spread loosely (not in a frame), in a jittered grid so they never overlap
  const cols=n<=4?n:(n<=6?3:(n<=8?4:5)),rows=Math.ceil(n/cols),cells=shuffle(range(0,cols*rows-1)).slice(0,n);
  return `<div class="scat" style="--c:${cols};--r:${rows}">${cells.map(i=>`<span style="grid-column:${i%cols+1};grid-row:${Math.floor(i/cols)+1};--dx:${rint(-18,18)}%;--dy:${rint(-18,18)}%;--rt:${rint(-14,14)}deg">${an}</span>`).join('')}</div>`;}
function screenKiraKuiz(){
  actShell('Soalan campur',()=>go(screenKiraMenu),'','🐵','Jom jawab soalan!','sun');
  const max=kMax(),min=kMin(),t=kTahap();let right=0,bag=[],lastT=null;const told=new Set();
  const rec=x=>!!VOICE[vkey(x)];
  function ask(text,always,extra){mascotSay(text,null,false);const parts=[];
    if(rec(text)&&(always||!told.has(text))){told.add(text);parts.push(text);}
    if(extra)parts.push(...extra);lastSay=[text,...(extra||[])].filter(rec);if(parts.length)setTimeout(()=>say(parts),250);}
  const q=html=>{$('#q').innerHTML=html+'<div class="row center" id="nxr"></div>';};
  function done(isRight,parts,onOk){bindOpts($('#op'),isRight,b=>{right++;if(onOk)onOk(b);winRound(right,parts);nextBtn(newQ);});}
  const add=t===2||t===5,sub=t===3||t===6;
  const T={
    kira:{p:'Jom kira semua.',f(){const n=deal('qk'+min+max,()=>range(min,max)),an=pickAnimal();ask(this.p);
      q(`${scatterHTML(n,an)}${optsHTML(n,Math.max(0,min-2),max)}`);done(v=>+v===n,['ada',NUMW[n]]);}},
    padan:{p:'Yang mana satu?',f(){const n=deal('qp'+min+max,()=>range(min,max)),an=pickAnimal(),cap=max>5?10:5;
      const opts=numOpts(n,1,max);ask(this.p,true,[NUMW[n]]);
      q(`<div class="target"><b>${n}</b><span>${NUMW[n]}</span></div><div class="opts frs" id="op">${opts.map(v=>`<button class="opt fr" data-v="${v}">${frameHTML(v>5?[[5,an,'pa'],[v-5,an,'pb']]:[[v,an,'pa']],cap,{still:true})}</button>`).join('')}</div>`);
      done(v=>+v===n,[NUMW[n]]);}},
    kilat:{p:'Tengok cepat! Ada berapa?',f(){const n=deal('qf'+min+max,()=>range(Math.max(1,min-2),max)),an=pickAnimal(),cap=max>5?10:5;ask(this.p);
      q(`<div class="flash" id="fl">${frameHTML(n>5?[[5,an,'pa'],[n-5,an,'pb']]:[[n,an,'pa']],cap)}<div class="cover" id="cv">👀</div></div>${optsHTML(n,0,max)}`);
      const fl=$('#fl');setTimeout(()=>{fl.classList.remove('hid');setTimeout(()=>{if(document.body.contains(fl))fl.classList.add('hid');},max>5?2200:1600);},300);
      done(v=>+v===n,[NUMW[n]],()=>fl.classList.remove('hid'));}},
    banding:{p:'Mana yang lebih banyak?',p2:'Mana yang lebih sedikit?',f(){let a,b;do{a=rint(1,max);b=rint(1,max);}while(a===b);
      const more=Math.random()<.5,txt=more?this.p:this.p2,ans=more?(a>b?'a':'b'):(a<b?'a':'b');const an=pickAnimal(),an2=pickAnimal(an);ask(txt,true);
      q(`<div class="opts cmp" id="op"><button class="opt grp" data-v="a">${scatterHTML(a,an)}</button><button class="opt grp" data-v="b">${scatterHTML(b,an2)}</button></div>`);
      done(v=>v===ans,[NUMW[ans==='a'?a:b]]);}},
    selepas:{p:'Nombor apa selepas ini?',f(){const n=deal('qs'+max,()=>range(1,max-1));ask(this.p,true,[NUMW[n]]);
      q(`<div class="nline">${(n>1?`<span>${n-1}</span><i>→</i>`:'')+`<span class="cur">${n}</span><i>→</i><span class="qmark" id="qm">?</span>`}</div>${optsHTML(n+1,1,max)}`);
      done(v=>+v===n+1,[NUMW[n+1]],()=>{const m=$('#qm');m.textContent=n+1;m.classList.add('done');});}},
    sebelum:{p:'Nombor apa sebelum ini?',f(){const n=deal('qb'+max,()=>range(2,max));ask(this.p,true,[NUMW[n]]);
      q(`<div class="nline"><span class="qmark" id="qm">?</span><i>→</i><span class="cur">${n}</span>${n<max?`<i>→</i><span>${n+1}</span>`:''}</div>${optsHTML(n-1,0,max)}`);
      done(v=>+v===n-1,[NUMW[n-1]],()=>{const m=$('#qm');m.textContent=n-1;m.classList.add('done');});}},
    hilang:{p:'Nombor mana yang hilang?',f(){const L=Math.min(5,max),st=rint(1,max-L+1),seq=range(st,st+L-1),k=rint(1,L-2),ans=seq[k];ask(this.p);
      q(`<div class="nline">${seq.map((v,i)=>i===k?'<span class="qmark" id="qm">?</span>':`<span>${v}</span>`).join('')}</div>${optsHTML(ans,1,max)}`);
      done(v=>+v===ans,[NUMW[ans]],()=>{const m=$('#qm');m.textContent=ans;m.classList.add('done');});}},
    tambah:{p:'Dua kumpulan. Semuanya berapa?',need:()=>add||t>=5,f(){const [a,b]=deal('qt'+max,()=>range(1,max-1).flatMap(a=>range(1,max-a).map(b=>[a,b]))),an=pickAnimal(),an2=pickAnimal(an);ask(this.p);
      q(`<div class="eq">${a} + ${b} = <span class="qmark" id="qm">?</span></div>${frameHTML([[a,an,'pa'],[b,an2,'pb']],frameCap(a+b))}${optsHTML(a+b,1,max)}`);
      done(v=>+v===a+b,[NUMW[a],'tambah',NUMW[b],'jadi',NUMW[a+b]],()=>{const m=$('#qm');m.textContent=a+b;m.classList.add('done');});}},
    tolak:{p:'Ada yang lari! Tinggal berapa?',need:()=>sub,f(){const [a,b]=deal('qo'+max,()=>range(2,max).flatMap(a=>range(1,a-1).map(b=>[a,b]))),an=pickAnimal();ask(this.p);
      q(`<div class="eq">${a} − ${b} = <span class="qmark" id="qm">?</span></div>${frameHTML([[a,an,'pa']],frameCap(a),{gone:b,still:true})}${optsHTML(a-b,0,max)}`);
      done(v=>+v===a-b,[NUMW[a],'tolak',NUMW[b],'tinggal',NUMW[a-b]],()=>{const m=$('#qm');m.textContent=a-b;m.classList.add('done');});}}
  };
  const avail=()=>Object.keys(T).filter(k=>rec(T[k].p)&&(!T[k].p2||rec(T[k].p2))&&(!T[k].need||T[k].need()));
  function newQ(){stopVoice();if(!bag.length){bag=shuffle(avail());if(bag[0]===lastT&&bag.length>1)bag.push(bag.shift());}
    const k=bag.shift();lastT=k;T[k].f();}
  newQ();
}

/* ---------- IQRA' ---------- */
const HIJ=[['ا',''],['ب','b'],['ت','t'],['ث','ts'],['ج','j'],['ح','h'],['خ','kh',1],['د','d'],['ذ','dz'],['ر','r',1],['ز','z'],['س','s'],['ش','sy'],['ص','sh',1],['ض','dh',1],['ط','th',1],['ظ','zh',1],['ع',"'"],['غ','gh',1],['ف','f'],['ق','q',1],['ك','k'],['ل','l'],['م','m'],['ن','n'],['و','w'],['ه','h'],['ء',''],['ي','y']].map(([c,cons,o])=>({c,cons,o:!!o}));
const IQ_ENDS=[3,7,11,15,19,23,28];
const MARK={a:'َ',i:'ِ',u:'ُ'};
function readOf(h,v){if(h.c==='ا'||h.c==='ء')return v;if(h.c==='ع')return "'"+v;if(v==='a'&&h.o)return h.cons+'o';return h.cons+v;}
function iqKey(h,v){return 'iq:'+(h.c==='ء'?'ا':h.c)+v;}
function syl(h,v){return {ar:h.c+MARK[v],r:readOf(h,v),k:[iqKey(h,v)]};}
const HIJM=Object.fromEntries(HIJ.map(h=>[h.c,h]));HIJM['ة']={c:'ة',cons:'t',o:false};HIJM['ى']={c:'ى',cons:'',o:false};
/* audio key of one parsed syllable. Short a/i/u use the recorded Iqra' 1-3 clips; long vowels (iq:بa*),
   tanwin (iq:بan) and sukun (iq:بْ) are separate recordings. */
function sylKey(s){
  const c=(s.c==='ء'||s.c==='ا')?'ا':s.c;
  if(s.sukun||(!s.v&&!s.long))return 'iq:'+c+'ْ';
  return 'iq:'+c+s.v+(s.long?'*':'')+(s.tanwin?'n':'')+(s.diph?'+':'');}
function sylRumi(s){
  const h=HIJM[s.c]||{cons:'',o:false};let cons=h.cons;if(s.c==='ع')cons="'";
  if(s.sukun||!s.v)return cons;
  let v=s.v;if(v==='a'&&h.o)v='o';
  if(s.long)v=v+v;if(s.diph)v=s.diph==='ai'?'ai':'au';if(s.tanwin)v=v+'n';
  return (s.shadda?cons:'')+cons+v;}
/* item = one card. sep: syllables read separately (Iqra' 1) or as one word */
function iqItem(ar,sep){
  const parts=arParse(ar);const keys=[],rum=[];let ok=true;
  for(const s of parts){if(s.sp){rum.push(' ');keys.push(null);continue;}
    if(s.shadda){const k0=sylKey({c:s.c,sukun:true});keys.push(k0);if(!VOICE[k0])ok=false;}
    const k=sylKey(s);keys.push(k);rum.push(sylRumi(s));if(!VOICE[k])ok=false;}
  const whole='iqw:'+ar;if(iqBook()>=5)ok=false; /* alif lam, wasl and idgham cannot be stitched from syllables */
  return {ar,sep,keys:keys.filter(Boolean),r:sep?rum.join(' ').replace(/\s+/g,' ').trim():rum.join('').replace(/\s+/g,' ').trim(),audio:ok||!!VOICE[whole],whole};}
function iqSay(it){if(VOICE[it.whole])return say(it.whole);if(!it.audio)return;return say(it.keys,{gap:it.sep?.16:-.03});}

function iqBook(){return Math.min(6,Math.max(1,store.get('iqBook',1)));}
function iqPage(){const b=IQ[iqBook()];return Math.min(b.pages.length-1,Math.max(0,store.get('iqPage'+iqBook(),0)));}
function iqDone(){return store.get('iqDone',{});}
const harakat=(c,v)=>c+MARK[v];
function iqGen(page){
  const g=page.gen||{},rows=[];
  if(g.mode==='single'){
    const L=IQ1_ORDER.slice(0,g.upto+1),nw=L[L.length-1];
    const disp=c=>harakat(c==='ا'?(g.hamzah?pick(['أ','ء']):'أ'):c,'a');
    if(g.test){const all=shuffle(L);for(let k=0;k<all.length;k+=3)rows.push([iqItem(all.slice(k,k+3).map(disp).join(' '),true)]);return chunk(rows.flat(),2);}
    for(let r=0;r<4;r++){const row=[];for(let gg=0;gg<2;gg++){const grp=[];for(let k=0;k<3;k++){let c;do{c=g.review||Math.random()<.4?pick(L):(k===0||Math.random()<.5?nw:pick(L));}while(k===2&&c===grp[0]&&c===grp[1]&&L.length>1);grp.push(c);}if(!g.review&&!grp.includes(nw))grp[rint(0,2)]=nw;row.push(iqItem(grp.map(disp).join(' '),true));}rows.push(row);}
    if(!g.review){const tail=L.slice(Math.max(0,L.length-4));rows.push([iqItem(tail.map(disp).join(''),false)]);}
    return rows;
  }
  if(g.mode==='pairs')return chunk(shuffle(IQ_PAIRS).map(([a,b])=>iqItem(harakat(a==='ا'?'أ':a,'a')+' '+harakat(b,'a'),true)),2);
  const items=(page.ex||[]).map(w=>iqItem(w,w.includes(' ')&&iqBook()<=3));
  if(g.letters){const L=[...g.letters];const vs=g.v==='ai'?['a','i']:g.v==='aiu'?['a','i','u']:['a'];
    for(let k=0;k<4;k++){const n=rint(g.len[0],g.len[1]);let w='';for(let j=0;j<n;j++)w+=harakat(pick(L),pick(vs));items.push(iqItem(w,false));}}
  return chunk(items,innerWidth<700?3:4);
}
function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}

function screenIqraMenu(){
  curModule=3;ambBlocked=true;
  setBar("Iqra'",()=>go(screenHome));
  const n=iqBook(),b=IQ[n],p=iqPage(),done=iqDone();
  const chips=`<div class="chipset k-iqBook"><span class="chiplbl">Iqra'</span><div class="chips">${IQ.slice(1).map(x=>`<button class="chip book ${x.n===n?'on':''}" data-key="iqBook" data-v="${x.n}" style="--bk:${x.col}"><b>${x.n}</b></button>`).join('')}</div></div>
    <div class="pagestep"><button class="ps-b" id="pPrev" aria-label="Muka sebelum">‹</button><div class="ps-t"><small>Muka ${p+1} / ${b.pages.length}${done[n+':'+p]?' ✓':''}</small><b dir="auto">${b.pages[p].t}</b></div><button class="ps-b" id="pNext" aria-label="Muka seterusnya">›</button></div>`;
  const cards=[{icon:'<span class="arico">بَ تَ</span>',name:'Baca',fn:screenIqraBaca}];
  if(n<=3)cards.push({icon:'<span class="arico">ثَ ؟</span>',name:'Teka huruf',fn:screenIqraHuruf});
  menuPage({title:"Iqra'",color:'plum',chips,cards,ask:`${b.name}: ${b.focus}.`});
  bindChips('iqBook',screenIqraMenu);
  const setP=v=>{store.set('iqPage'+n,Math.min(b.pages.length-1,Math.max(0,v)));screenIqraMenu();};
  $('#pPrev').onclick=()=>setP(p-1);$('#pNext').onclick=()=>setP(p+1);
}
function screenIqraBaca(){
  document.body.classList.add('quiet');ambBlocked=true;
  const n=iqBook(),b=IQ[n];let p=iqPage();
  setBar(`${b.name} · Muka ${p+1}`,()=>go(screenIqraMenu));main.className='full';
  main.innerHTML=stageHTML('plum','🐢','Baca dari kanan. Pendek, jangan dieja.',`${trackHTML()}<div class="qarea iqa">
    <button class="pokok" id="pokok"><small>Contoh</small><b dir="rtl"></b></button>
    <div class="iqrows" id="rows"></div>
    <div class="row center"><button class="btn soft" id="tR"></button><button class="btn soft" id="nl"><img src="img/ic-undo.webp" alt="">Baris lain</button></div>
    <div class="parent"><span class="lbl" id="plbl"></span><button class="btn leaf" id="ok"><img src="img/ic-check.webp" alt="">Betul</button><button class="btn sun" id="ag"><img src="img/ic-undo.webp" alt="">Ulang</button></div></div>`);
  let showR=store.get('iqRumi',false),sets=[],si=0,count=0;
  function loadPage(){
    const page=b.pages[p];sets=chunk(iqGen(page),2);si=0;
    setBar(`${b.name} · Muka ${p+1}`,()=>go(screenIqraMenu));
    const pk=iqItem(page.t.replace(/\s*\(.*\)/,''),true);
    $('#pokok b').textContent=page.t;$('#pokok').onclick=()=>iqSay(pk);
    $('#plbl').textContent=b.needRec||page.mad?'Ibu/Ayah: baca contoh dulu, Husayn ikut':'Ibu/Ayah: dengar satu baris, kemudian tekan';
    show();
  }
  if(n>=5){showR=false;$('#tR').hidden=true;} /* rumi spelling of tajwid rules would mislead */
  function lbl(){$('#tR').textContent=showR?'Sorok bacaan':'Tunjuk bacaan';$('#rows').classList.toggle('showrumi',showR);}
  function show(){
    const set=sets[si%sets.length];
    $('#rows').innerHTML=set.map(row=>`<div class="iqline" dir="rtl">${row.map((it,k)=>`<button class="iq paper ${it.audio?'':'mute'}" data-k="${k}"><span class="ar">${it.ar}</span><span class="rumi">${it.r}</span></button>`).join('')}</div>`).join('');
    /* shrink a row until its cards fit the board (long words in Iqra' 3-6) */
    $$('#rows .iqline',main).forEach(line=>{let f=1;const fit=()=>{const k=[...line.children];const need=k.reduce((a,e)=>a+e.offsetWidth,0)+(k.length-1)*parseFloat(getComputedStyle(line).columnGap||0);return need<=$('#rows').clientWidth-4;};
      while(!fit()&&f>.45){f-=.07;line.style.setProperty('--fs',f.toFixed(2));}});
    $$('#rows .iqline',main).forEach((line,ri)=>$$('.iq',line).forEach(el=>el.onclick=()=>{const it=set[ri][+el.dataset.k];el.classList.add('reveal');iqSay(it);setTimeout(()=>el.classList.remove('reveal'),1800);}));
  }
  $('#tR').onclick=()=>{showR=!showR;store.set('iqRumi',showR);lbl();};
  $('#nl').onclick=()=>{si++;if(si>=sets.length){sets=chunk(iqGen(b.pages[p]),2);si=0;}show();};
  $('#ok').onclick=()=>{count++;setScore(count);addStars(1);si++;
    if(si>=sets.length){const d=iqDone();d[n+':'+p]=true;store.set('iqDone',d);mascotSay('MasyaAllah! Habis satu muka.','happy');celebrate(3);
      if(p<b.pages.length-1){p++;store.set('iqPage'+n,p);}setTimeout(loadPage,1600);}
    else{mascotSay(pickNR(PRAISE,'pr'),'happy');celebrate(2);setTimeout(show,900);}};
  $('#ag').onclick=async()=>{mascotSay('Tak apa. Baca sekali lagi, perlahan-lahan.');for(const el of $$('#rows .iq',main)){el.classList.add('reveal');await sleep(700);el.classList.remove('reveal');}};
  lbl();loadPage();
}
function screenIqraHuruf(){
  ambBlocked=true;
  actShell('Teka huruf',()=>go(screenIqraMenu),'','🐢','Yang mana satu?','plum');
  const n=iqBook();let right=0;
  function newQ(){
    let pool=HIJ.filter(h=>h.c!=='ء');
    if(n===1){const p=iqPage(),upto=(IQ[1].pages[p].gen||{}).upto;if(upto!=null){const L=IQ1_ORDER.slice(0,upto+1);pool=pool.filter(h=>L.includes(h.c));}}
    const v=n===3?pick(['a','i','u']):'a';
    const lab=h=>readOf(h,v);const ans=pool[pool.findIndex(h=>h.c===fresh(pool.map(h=>h.c),'th'+n))];const opts=[ans];
    for(const h of shuffle(pool)){if(opts.length>=3)break;if(!opts.some(o=>lab(o)===lab(h)))opts.push(h);}
    const r2a=Math.random()<.5||opts.length<2;
    $('#q').innerHTML=(r2a?`<div class="iqprompt">Mana satu <b>${lab(ans)}</b>?</div><div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt ar" data-v="${o.c}">${(o.c==='ا'?'أ':o.c)+MARK[v]}</button>`).join('')}</div>`
      :`<div class="iqbig">${(ans.c==='ا'?'أ':ans.c)+MARK[v]}</div><div class="iqprompt">Ini bacaannya apa?</div><div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt rm" data-v="${o.c}">${lab(o)}</button>`).join('')}</div>`)+'<div class="row center" id="nxr"></div>';
    lastSay=r2a?iqKey(ans,v):null;if(r2a)say(iqKey(ans,v));
    bindOpts($('#op'),x=>x===ans.c,()=>{right++;setScore(right);{const p=pickNR(PRAISE,'pr');mascotSay(`${p} Itu ${lab(ans)}.`,'happy',true,[p,'itu',iqKey(ans,v)]);}addStars(1);celebrate(right%5===0?3:2);$('#nxr').innerHTML='<button class="btn big next" id="nx">Seterusnya <i class="tri"></i></button>';$('#nx').onclick=newQ;});
  }
  newQ();
}

/* ---------- boot ---------- */
renderSound();renderStars(false);
window.__hb={judgeWriting,sampleGlyph,CFG};
screenHome();
setTimeout(()=>{const l=$('#loader');if(l){l.style.opacity='0';setTimeout(()=>l.remove(),450);}},350);
/* offline support: when a newer version takes over, reload once so the new code runs; then store audio in the background */
if('serviceWorker' in navigator&&location.protocol==='https:'){
  const had=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!reloaded){reloaded=true;location.reload();}});
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{
    reg.update().catch(()=>{});
    navigator.serviceWorker.ready.then(r=>{setTimeout(()=>{try{r.active&&r.active.postMessage('warm');}catch(e){}},4000);});
  }).catch(()=>{});});
}
