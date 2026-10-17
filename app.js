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
const VOICE={}; /* key -> audio file, recorded by Ayah */
fetch('audio/voice.json').then(r=>r.json()).then(j=>{for(const k in j)VOICE[k]='audio/'+j[k];}).catch(()=>{});
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
let playTok=0;
function stopVoice(){playTok++;try{player.pause();}catch(e){}try{speechSynthesis.cancel();}catch(e){}duck(false);}
function playClip(src,tok){return new Promise(res=>{
  if(tok!==playTok)return res();
  let done=false;const fin=()=>{if(!done){done=true;player.onended=null;player.onerror=null;res();}};
  player.onended=fin;player.onerror=fin;player.src=src;
  const p=player.play();if(p&&p.catch)p.catch(fin);setTimeout(fin,8000);
});}
/* say(parts): each part is a phrase key ('kuda', 'Hebat!') or an Iqra' key ('iq:بa').
   Recorded clips play in order; a part with no recording falls back to the device voice (never for Iqra'). */
async function say(parts){
  if(!soundOn||parts==null)return;
  const arr=(Array.isArray(parts)?parts:[parts]).filter(p=>p!==''&&p!=null);
  stopVoice();const tok=playTok;duck(true);
  for(const p of arr){
    if(tok!==playTok)return;
    const k=String(p).startsWith('iq:')?String(p):vkey(p);
    if(VOICE[k])await playClip(VOICE[k],tok);
    else if(!String(p).startsWith('iq:'))await tts(String(p));
    await sleep(60);
  }
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
function go(fn,...args){
  if(cleanup){try{cleanup();}catch(e){}cleanup=null;}
  stopVoice();ambBlocked=false;document.body.classList.remove('quiet');
  main.className='';main.scrollTop=0;
  fn(...args);
  ambSync();
}

/* ---------- mascot & celebration ---------- */
const PRAISE=['Hebat!','Pandainya!','Bagus sangat!','Wah, betul!','MasyaAllah, pandai!','Syabas, Husayn!'];
const TRY=['Hampir! Cuba lagi.','Tak apa, cuba sekali lagi.','Jom cuba lagi, boleh punya!'];
const PARADE=['🐘','🦒','🐢','🐒','🦁','🐯','🐰','🦓','🐪','🦘','🐧','🐊'];
const GUIDES={'🐘':{k:'gajah',c:'teal'},'🐵':{k:'orangutan',c:'mango'},'🦒':{k:'kenyalang',c:'hib'},'🐢':{k:'penyu',c:'plum'}};
function guideHTML(k,c){return `<div class="guide g-${c}" aria-hidden="true"><img src="img/${k}.webp" alt=""><video src="video/${k}.mp4" muted playsinline loop preload="auto"></video></div>`;}
function mascot(animal,text){const g=GUIDES[animal]||GUIDES['🦒'];return `<div class="mascot">${guideHTML(g.k,g.c)}<div class="m-bubble paper" role="status">${text}</div></div>`;}
let talkTimer=null;
function talk(ms){const g=$('.mascot .guide',main);if(!g)return;const v=$('video',g);clearTimeout(talkTimer);
  if(v&&v.readyState>=2){g.classList.add('talk');try{v.currentTime=0;const p=v.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
  talkTimer=setTimeout(()=>{g.classList.remove('talk');try{v&&v.pause();}catch(e){}},Math.max(1800,ms||2600));}
function mascotSay(text,mood,speak=true,parts){
  const m=$('.mascot',main);if(!m)return;
  $('.m-bubble',m).textContent=text;
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
    <div class="greet paper"><h1>Assalamualaikum, <em>Husayn!</em></h1><p>Nak belajar apa hari ni? Pilih satu pintu.</p></div>
    <div class="doors">${MODULES.map((m,i)=>{const [c,k,tag]=DOORS[i];return `<button class="door paper t2 d-${c}" data-i="${i}">
      <span class="tag"><span>${tag}</span><b class="paper"><img src="img/star-full.webp" alt="">${moduleStars(i)}</b></span>
      <span class="win paper"><img src="img/${k}.webp" alt="" style="--d:${i*.45}s"></span>
      <span class="dname">${m.name}</span><span class="go paper">${GO[i]} ›</span></button>`;}).join('')}</div>
    <div class="guide-strip paper"><img src="img/ic-bird.webp" alt=""><span class="grow">Sentuh mana-mana pintu untuk mula kumpul bintang!</span><button class="parentlink" id="toParent">Ibu/Ayah</button></div>
  </div></div>`;
  $('#toParent').onclick=()=>go(screenParent);
  $$('.door',main).forEach(b=>b.onclick=()=>{const m=MODULES[+b.dataset.i];sfx('tap');go(m.fn);say(m.name);});
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
      <div class="row"><button class="btn soft" id="resetStars">Kosongkan bintang</button><span class="parentnote" id="resetMsg"></span></div>
    </div></div>`;
  let armed=false;
  $('#resetStars').onclick=()=>{if(!armed){armed=true;$('#resetMsg').textContent='Tekan sekali lagi untuk sahkan.';return;}
    stars=0;store.set('stars',0);store.set('mstars',{});store.set('write',{});progress={};renderStars(false);$('#resetMsg').textContent='Bintang dikosongkan.';armed=false;};
}

/* ---------- shared menu helpers ---------- */
function chipRow(label,key,opts,cur){return `<div class="chipset"><span class="chiplbl">${label}</span><div class="chips">${opts.map(([v,t])=>`<button class="chip ${v==cur?'on':''}" data-key="${key}" data-v="${v}">${t}</button>`).join('')}</div></div>`;}
function bindChips(key,rerender){$$(`.chip[data-key="${key}"]`,main).forEach(b=>b.onclick=()=>{const v=b.dataset.v;store.set(key,isNaN(v)?v:Number(v));rerender();});}
const HERO={sea:'gajah',sun:'orangutan',leaf:'kenyalang',plum:'penyu'};
function menuPage({title,intro,color,chips,cards}){
  main.innerHTML=`<div class="page m-${color}">
    <div class="pagehead"><div class="menuhero"><img src="img/${HERO[color]}.webp" alt=""><div><h1>${title}</h1><p>${intro}</p></div></div></div>
    ${chips||''}
    <div class="cards">${cards.map((c,i)=>`<button class="card paper" data-i="${i}"><span class="ci" aria-hidden="true">${c.icon}</span><span class="ct"><b>${c.name}</b><small>${c.sub}</small></span></button>`).join('')}</div>
  </div>`;
  $$('.card',main).forEach(b=>b.onclick=()=>go(cards[+b.dataset.i].fn));
}
function numOpts(ans,min=0,max=10){const set=new Set([ans]);for(const c of shuffle([ans-1,ans+1,ans-2,ans+2,ans+3,ans-3])){if(set.size>=3)break;if(c>=min&&c<=max)set.add(c);}return shuffle([...set]);}
function bindOpts(box,isRight,onRight){
  $$('.opt',box).forEach(b=>b.onclick=()=>{
    if(box.dataset.done)return;
    if(isRight(b.dataset.v)){box.dataset.done='1';b.classList.add('good');onRight(b);}
    else{b.classList.add('bad');b.disabled=true;mascotSay(pick(TRY),'sad');}
  });
}

/* ---------- MENULIS ---------- */
function starsText(n){return '<i>'+'★'.repeat(n)+'</i>'+'★'.repeat(3-n);}
function screenTulisMenu(tab){
  curModule=2;
  setBar('Menulis',()=>go(screenHome));
  const set=tab==='nombor'?DIGITS:LETTERS;
  main.innerHTML=`<div class="page m-leaf">
    <div class="pagehead"><div><h1>Menulis</h1><p>Pilih huruf atau nombor. Surih dulu, lepas tu tulis sendiri.</p></div>
      <div class="seg" role="tablist"><button class="${tab!=='nombor'?'on':''}" data-tab="huruf">Huruf</button><button class="${tab==='nombor'?'on':''}" data-tab="nombor">Nombor</button></div></div>
    <div class="tilegrid">${set.map(ch=>{const p=progress[ch]||{};return `<button class="tile paper ${(p.s||0)>=2?'traced':''}" data-ch="${ch}"><span class="tch">${ch}</span><span class="tstars" aria-label="${p.t||0} bintang">${starsText(p.t||0)}</span></button>`;}).join('')}</div>
    <p class="parentnote">Bintang pada petak = markah terbaik <b>Tulis sendiri</b>. Petak hijau = sudah lepas latihan surih.</p>
  </div>`;
  $$('.seg button',main).forEach(b=>b.onclick=()=>screenTulisMenu(b.dataset.tab));
  $$('.tile',main).forEach(b=>b.onclick=()=>{const ch=b.dataset.ch;const p=progress[ch]||{};go(screenTulis,ch,(p.s||0)>=2?'tulis':'surih');});
}

function screenTulis(ch,mode){
  const set=DIGITS.includes(ch)?DIGITS:LETTERS;
  setBar('Menulis',()=>go(screenTulisMenu,set===DIGITS?'nombor':'huruf'));
  main.className='full';
  const tpl=sampleGlyph(ch);
  const intro=mode==='surih'?'Ikut garisan putus-putus. Mula dari titik hijau nombor 1.':'Tulis sendiri dalam kotak. Tengok contoh kalau lupa.';
  main.innerHTML=`<div class="write">
    <aside class="wside">
      <div class="wmodel paper"><svg viewBox="0 0 100 120" aria-hidden="true">${linesSVG()}${solidSVG(ch)}</svg><div class="ml"><b>${ch}</b><small>Contoh</small></div></div>
      <div class="seg wide"><button data-mode="surih" class="${mode==='surih'?'on':''}">Surih</button><button data-mode="tulis" class="${mode==='tulis'?'on':''}" id="modeTulis">Tulis sendiri</button></div>
      <div class="wtools"><button class="btn soft" id="wDemo"><img src="img/ic-play.webp" alt="">Tunjuk cara</button><button class="btn soft" id="wUndo"><img src="img/ic-undo.webp" alt="">Undur</button><button class="btn soft" id="wClear"><img src="img/ic-eraser.webp" alt="">Padam</button></div>
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
        <button class="btn big leaf" id="wCheck">Siap! Semak</button>
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
const WORDS=[
 ['kuda','ku da','🐴',1],['rusa','ru sa','🦌',1],['bola','bo la','⚽',1],['buku','bu ku','📖',1],['topi','to pi','🧢',1],['roti','ro ti','🍞',1],['susu','su su','🥛',1],['baju','ba ju','👕',1],['gigi','gi gi','🦷',1],['kaki','ka ki','🦶',1],['mata','ma ta','👁️',1],['labu','la bu','🎃',1],['ubi','u bi','🍠',1],['padi','pa di','🌾',1],['kopi','ko pi','☕',1],['lori','lo ri','🚚',1],
 ['ikan','i kan','🐟',2],['itik','i tik','🦆',2],['ulat','u lat','🐛',2],['ayam','a yam','🐔',2],['unta','un ta','🐫',2],['katak','ka tak','🐸',2],['arnab','ar nab','🐰',2],['gajah','ga jah','🐘',2],['kucing','ku cing','🐱',2],['singa','si nga','🦁',2],['lembu','lem bu','🐄',2],['pisang','pi sang','🍌',2],['nanas','na nas','🍍',2],['kasut','ka sut','👟',2],['kunci','kun ci','🔑',2],['bulan','bu lan','🌙',2],['bunga','bu nga','🌸',2],['pokok','po kok','🌳',2],['rumah','ru mah','🏠',2],['siput','si put','🐌',2],['ketam','ke tam','🦀',2],['tikus','ti kus','🐭',2],['monyet','mo nyet','🐒',2],['penyu','pe nyu','🐢',2],['epal','e pal','🍎',2],['payung','pa yung','☂️',2],['belon','be lon','🎈',2],['sotong','so tong','🦑',2],['helang','he lang','🦅',2],['kambing','kam bing','🐐',2],['burung','bu rung','🐦',2],
 ['kereta','ke re ta','🚗',3],['beruang','be ru ang','🐻',3],['harimau','ha ri mau','🐯',3],['zirafah','zi ra fah','🦒',3],['buaya','bu a ya','🐊',3],['kelapa','ke la pa','🥥',3],['tembikai','tem bi kai','🍉',3],['kelawar','ke la war','🦇',3],['basikal','ba si kal','🚲',3],['rama-rama','ra ma ra ma','🦋',3],['kuda belang','ku da be lang','🦓',3]
].map(([w,s,e,l])=>({w,s:s.split(' '),e,l}));
const SENT=[
 [1,'ini bola.','⚽'],[1,'itu kuda.','🐴'],[1,'ibu beli roti.','🍞'],[1,'abu suka susu.','🥛'],[1,'baju adi biru.','👕'],[1,'itu topi papa.','🧢'],[1,'rusa lari laju.','🦌'],
 [2,'kucing itu comel.','🐱'],[2,'ayam makan jagung.','🐔'],[2,'katak lompat tinggi.','🐸'],[2,'gajah ada belalai.','🐘'],[2,'singa tidur bawah pokok.','🦁'],[2,'arnab suka makan lobak.','🐰'],
 [3,'zirafah itu sangat tinggi.','🦒'],[3,'harimau berlari dengan laju.','🐯'],[3,'kereta ayah berwarna merah.','🚗'],[3,'buaya berenang di sungai.','🐊'],[3,'rama-rama hinggap di bunga.','🦋']
].map(([l,t,e])=>({l,t,e}));
function bacaLevel(){return store.get('bacaLevel',1);}
function screenBacaMenu(){
  curModule=0;
  setBar('Membaca',()=>go(screenHome));
  menuPage({title:'Membaca',intro:'Kaedah suku kata. Pilih tahap, kemudian pilih aktiviti.',color:'sea',
    chips:chipRow('Tahap','bacaLevel',[[1,'Tahap 1 · ku-da'],[2,'Tahap 2 · ku-cing'],[3,'Tahap 3 · ke-re-ta']],bacaLevel()),
    cards:[{icon:'🧩',name:'Bina perkataan',sub:'Susun suku kata ikut gambar',fn:screenBina},{icon:'🖼️',name:'Pilih gambar',sub:'Baca perkataan, pilih gambarnya',fn:screenPilih},{icon:'📖',name:'Baca ayat',sub:'Baca kuat, ibu atau ayah semak',fn:screenAyat}]});
  bindChips('bacaLevel',screenBacaMenu);
}
function actShell(title,back,hint,animal,mtext,color){
  setBar(title,back);
  main.innerHTML=`<div class="page act m-${color}"><div class="acthead"><p class="hint">${hint}</p><span class="score paper">Betul: <b id="sc">0</b></span></div><div id="q" class="qarea paper t2"></div>${mascot(animal,mtext)}</div>`;
}
function screenBina(){
  actShell('Bina perkataan',()=>go(screenBacaMenu),'Tengok gambar. Tekan suku kata ikut susunan.','🐘','Ini gambar apa? Susun suku katanya.','sea');
  const lv=bacaLevel();let w,tiles,slots,solved,right=0,last=null;
  function newQ(){
    const pool=WORDS.filter(x=>x.l===lv&&x.w!==last);w=pick(pool);last=w.w;
    const others=shuffle([...new Set(WORDS.filter(x=>x.l===lv&&x!==w).flatMap(x=>x.s))].filter(s=>!w.s.includes(s))).slice(0,2);
    tiles=shuffle([...w.s,...others]).map(t=>({t,used:false}));slots=w.s.map(()=>null);solved=false;render(true);
  }
  function render(fresh){
    $('#q').innerHTML=`<div class="bigpic" ${fresh?'':'style="animation:none"'}>${w.e}</div>
      <div class="slots">${slots.map((s,k)=>`<button class="slot ${s!==null?'filled':''} ${solved?'good':''}" data-k="${k}">${s!==null?tiles[s].t:''}</button>`).join('')}</div>
      <div class="tiles">${tiles.map((t,i)=>`<button class="syl ${t.used?'used':''}" data-i="${i}" ${solved?'disabled':''}>${t.t}</button>`).join('')}</div>
      <div class="row center"><button class="btn soft" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar</button>${solved?'<button class="btn big sea" id="nx">Seterusnya ›</button>':''}</div>`;
    $$('.syl',main).forEach(b=>b.onclick=()=>{
      const i=+b.dataset.i;if(solved||tiles[i].used)return;const k=slots.indexOf(null);if(k<0)return;
      tiles[i].used=true;slots[k]=i;sfx('tap');say(tiles[i].t);render();if(slots.indexOf(null)<0)check();
    });
    $$('.slot',main).forEach(b=>b.onclick=()=>{const k=+b.dataset.k;if(solved||slots[k]===null)return;tiles[slots[k]].used=false;slots[k]=null;render();});
    $('#hear').onclick=()=>say(w.w);
    if(solved)$('#nx').onclick=newQ;
  }
  function check(){
    const ok=slots.every((s,k)=>tiles[s].t===w.s[k]);
    if(ok){solved=true;right++;$('#sc').textContent=right;render();const p=pick(PRAISE);mascotSay(`${p} ${w.s.join('-')}, ${w.w}.`,'happy',true,[p,w.w]);addStars(1);celebrate(right%5===0?3:2);}
    else{
      $$('.slot',main).forEach((b,k)=>{if(tiles[slots[k]].t!==w.s[k])b.classList.add('bad');});
      mascotSay(pick(TRY),'sad');
      setTimeout(()=>{slots=slots.map((s,k)=>{if(s!==null&&tiles[s].t!==w.s[k]){tiles[s].used=false;return null;}return s;});render();},1000);
    }
  }
  newQ();
}
function screenPilih(){
  actShell('Pilih gambar',()=>go(screenBacaMenu),'Baca perkataan. Pilih gambar yang betul.','🐘','Baca dulu, kemudian tekan gambarnya.','sea');
  const lv=bacaLevel();let right=0,last=null;
  function newQ(){
    const w=pick(WORDS.filter(x=>x.l===lv&&x.w!==last));last=w.w;
    const opts=[w];for(const x of shuffle(WORDS)){if(opts.length>=3)break;if(!opts.some(o=>o.e===x.e))opts.push(x);}
    $('#q').innerHTML=`<div class="word">${w.s.map(s=>`<span>${s}</span>`).join('')}</div>
      <div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt pic" data-v="${o.w}" aria-label="gambar">${o.e}</button>`).join('')}</div>
      <div class="row center" id="nxr"></div>`;
    bindOpts($('#op'),v=>v===w.w,()=>{right++;$('#sc').textContent=right;const p=pick(PRAISE);mascotSay(`${p} Itu ${w.w}.`,'happy',true,[p,'itu',w.w]);addStars(1);celebrate(right%5===0?3:2);
      $('#nxr').innerHTML='<button class="btn big sea" id="nx">Seterusnya ›</button>';$('#nx').onclick=newQ;});
    mascotSay('Baca suku kata satu-satu, kemudian pilih.',null,false);
  }
  newQ();
}
function screenAyat(){
  actShell('Baca ayat',()=>go(screenBacaMenu),'Husayn baca ayat kuat-kuat. Tekan perkataan kalau perlu bantuan.','🐘','Baca perlahan-lahan ya.','sea');
  const lv=bacaLevel();const pool=SENT.filter(s=>s.l===lv);let order=shuffle(pool),idx=0,right=0;
  function render(){
    const s=order[idx%order.length];
    $('#q').innerHTML=`<div class="bigpic">${s.e}</div><div class="sent">${s.t.split(' ').map(w=>`<button>${w}</button>`).join('')}</div>
      <div class="parent paper"><span class="lbl">Untuk ibu/ayah: dengar Husayn baca, kemudian tekan</span><button class="btn leaf" id="ok"><img src="img/ic-check.webp" alt="">Betul</button><button class="btn sun" id="ag"><img src="img/ic-undo.webp" alt="">Ulang</button><button class="btn soft" id="hear"><img src="img/ic-speaker.webp" alt="">Dengar ayat</button></div>`;
    $$('.sent button',main).forEach(b=>b.onclick=()=>{b.classList.add('lit');say(b.textContent);setTimeout(()=>b.classList.remove('lit'),1200);});
    $('#hear').onclick=()=>say(s.t);
    $('#ok').onclick=()=>{right++;$('#sc').textContent=right;mascotSay(pick(PRAISE),'happy');addStars(1);celebrate(right%4===0?3:2);idx++;setTimeout(render,1100);};
    $('#ag').onclick=()=>mascotSay('Tak apa. Baca sekali lagi, satu-satu perkataan.');
  }
  render();
}

/* ---------- MENGIRA ---------- */
const NUMW=['sifar','satu','dua','tiga','empat','lima','enam','tujuh','lapan','sembilan','sepuluh'];
const ANIMALS=['🐥','🐟','🐸','🐞','🐢','🐰','🐱','🐵','🦆','🐝','🐘','🦒'];
function screenKiraMenu(){
  curModule=1;
  setBar('Mengira',()=>go(screenHome));
  menuPage({title:'Mengira',intro:'Semua soalan ada gambar, senang Husayn faham dan senang ibu ayah terangkan.',color:'sun',
    cards:[{icon:'🔢',name:'Kenal nombor',sub:'1 hingga 10, dengar dan kira',fn:screenKenal},{icon:'🐥',name:'Kira haiwan',sub:'Kira, kemudian pilih nombor',fn:screenKira},{icon:'➕',name:'Tambah',sub:'Gabung dua kumpulan',fn:screenTambah},{icon:'➖',name:'Tolak',sub:'Ada yang pergi, tinggal berapa?',fn:screenTolak}]});
}
function critters(n,an,start=0){return Array.from({length:n},(_,i)=>`<button class="critter" data-i="${start+i}" style="--k:${start+i}">${an}</button>`).join('');}
async function countOut(els,token){
  els.forEach(e=>{const b=$('.badge',e);if(b)b.remove();});
  for(let i=0;i<els.length;i++){if(token.stop)return;const e=els[i];e.insertAdjacentHTML('beforeend',`<span class="badge">${i+1}</span>`);e.classList.remove('hop');void e.offsetWidth;e.classList.add('hop');say(NUMW[i+1]);await sleep(800);}
}
function screenKenal(){
  setBar('Kenal nombor',()=>go(screenKiraMenu));
  main.innerHTML=`<div class="page act m-sun kenal"><div class="numpad">${Array.from({length:10},(_,i)=>`<button class="numbtn" data-n="${i+1}">${i+1}</button>`).join('')}</div><div class="numshow paper t2" id="ns"></div>${mascot('🐵','Tekan nombor. Dengar, kemudian kira haiwan.')}</div>`;
  function show(n){
    $$('.numbtn',main).forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
    const an=pick(ANIMALS);
    $('#ns').innerHTML=`<div><div class="bignum">${n}</div><div class="numword">${NUMW[n]}</div></div><div class="frame">${Array.from({length:10},(_,i)=>`<div class="cell">${i<n?`<span style="--k:${i}">${an}</span>`:''}</div>`).join('')}</div>`;
    say(NUMW[n]);
  }
  $$('.numbtn',main).forEach(b=>b.onclick=()=>show(+b.dataset.n));
  show(1);
}
function screenKira(){
  actShell('Kira haiwan',()=>go(screenKiraMenu),'Tekan setiap haiwan untuk kira. Kemudian pilih nombornya.','🐵','Ada berapa ekor? Jom kira!','sun');
  let right=0;const token={stop:false};cleanup=()=>{token.stop=true;};
  function newQ(){
    const n=rint(1,10),an=pick(ANIMALS);let counted=0;
    $('#q').innerHTML=`<div class="field">${Array.from({length:n},(_,i)=>`<button class="critter" style="--k:${i};margin-top:${rint(0,18)}px">${an}</button>`).join('')}</div>
      <div class="opts" id="op">${numOpts(n,1,10).map(v=>`<button class="opt" data-v="${v}">${v}</button>`).join('')}</div><div class="row center" id="nxr"></div>`;
    $$('.critter',main).forEach(c=>c.onclick=()=>{if($('.badge',c))return;counted++;c.insertAdjacentHTML('beforeend',`<span class="badge">${counted}</span>`);c.classList.remove('hop');void c.offsetWidth;c.classList.add('hop');say(NUMW[counted]);});
    const box=$('#op');
    $$('.opt',box).forEach(b=>b.onclick=async()=>{
      if(box.dataset.done)return;
      if(+b.dataset.v===n){box.dataset.done='1';b.classList.add('good');right++;$('#sc').textContent=right;{const p=pick(PRAISE);mascotSay(`${p} Ada ${NUMW[n]}.`,'happy',true,[p,'ada',NUMW[n]]);}addStars(1);celebrate(right%5===0?3:2);$('#nxr').innerHTML='<button class="btn big sun" id="nx">Seterusnya ›</button>';$('#nx').onclick=newQ;}
      else{b.classList.add('bad');b.disabled=true;mascotSay('Jom kira sama-sama!','sad');await sleep(1200);counted=n;await countOut($$('.critter',main),token);}
    });
  }
  newQ();
}
function screenTambah(){
  actShell('Tambah',()=>go(screenKiraMenu),'Gabungkan dua kumpulan. Semuanya ada berapa?','🐵','Kira semua haiwan.','sun');
  let right=0;const token={stop:false};cleanup=()=>{token.stop=true;};
  function newQ(){
    const a=rint(1,6),b=rint(1,Math.min(5,10-a)),an=pick(ANIMALS),ans=a+b;
    $('#q').innerHTML=`<div class="eq">${a} + ${b} = <span class="qmark" id="qm">?</span></div>
      <div class="groups"><div class="pen paper">${critters(a,an)}</div><div class="op">+</div><div class="pen paper">${critters(b,an,a)}</div></div>
      <div class="opts" id="op">${numOpts(ans,1,10).map(v=>`<button class="opt" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="row center" id="nxr"><button class="btn soft" id="show"><img src="img/ic-play.webp" alt="">Tunjuk cara</button></div>`;
    const done=()=>{const q=$('#qm');q.textContent=ans;q.classList.add('done');};
    $('#show').onclick=async()=>{mascotSay(`${NUMW[a]} tambah ${NUMW[b]}. Jom kira semua.`,null,true,[NUMW[a],'tambah',NUMW[b],'Jom kira semua.']);await sleep(1600);await countOut($$('.critter',main),token);if(token.stop)return;done();mascotSay(`Semuanya ${NUMW[ans]}!`,'happy',true,['semuanya',NUMW[ans]]);};
    bindOpts($('#op'),v=>+v===ans,()=>{done();right++;$('#sc').textContent=right;{const p=pick(PRAISE);mascotSay(`${p} ${NUMW[a]} tambah ${NUMW[b]} jadi ${NUMW[ans]}.`,'happy',true,[p,NUMW[a],'tambah',NUMW[b],'jadi',NUMW[ans]]);}addStars(1);celebrate(right%5===0?3:2);$('#nxr').innerHTML='<button class="btn big sun" id="nx">Seterusnya ›</button>';$('#nx').onclick=newQ;});
  }
  newQ();
}
function screenTolak(){
  actShell('Tolak',()=>go(screenKiraMenu),'Ada yang pergi. Yang tinggal ada berapa?','🐵','Tengok, ada yang pergi!','sun');
  let right=0;const token={stop:false};cleanup=()=>{token.stop=true;};
  function newQ(){
    const a=rint(2,10),b=rint(1,a-1),an=pick(ANIMALS),ans=a-b;
    $('#q').innerHTML=`<div class="eq">${a} − ${b} = <span class="qmark" id="qm">?</span></div>
      <div class="groups"><div class="pen paper" style="max-width:420px">${critters(a,an)}</div></div>
      <div class="opts" id="op">${numOpts(ans,0,10).map(v=>`<button class="opt" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="row center" id="nxr"><button class="btn soft" id="show"><img src="img/ic-play.webp" alt="">Tunjuk cara</button></div>`;
    const els=$$('.critter',main);
    setTimeout(()=>{if(!document.body.contains(els[0]))return;sfx('whoosh');els.slice(a-b).forEach(e=>e.classList.add('gone'));},900);
    const done=()=>{const q=$('#qm');q.textContent=ans;q.classList.add('done');};
    $('#show').onclick=async()=>{mascotSay(`Ada ${NUMW[a]}, ${NUMW[b]} pergi. Jom kira yang tinggal.`,null,true,['ada',NUMW[a],NUMW[b],'pergi','Jom kira yang tinggal.']);await sleep(2000);await countOut(els.slice(0,ans),token);if(token.stop)return;done();mascotSay(`Tinggal ${NUMW[ans]}!`,'happy',true,['tinggal',NUMW[ans]]);};
    bindOpts($('#op'),v=>+v===ans,()=>{done();right++;$('#sc').textContent=right;{const p=pick(PRAISE);mascotSay(`${p} ${NUMW[a]} tolak ${NUMW[b]}, tinggal ${NUMW[ans]}.`,'happy',true,[p,NUMW[a],'tolak',NUMW[b],'tinggal',NUMW[ans]]);}addStars(1);celebrate(right%5===0?3:2);$('#nxr').innerHTML='<button class="btn big sun" id="nx">Seterusnya ›</button>';$('#nx').onclick=newQ;});
  }
  newQ();
}

/* ---------- IQRA' ---------- */
const HIJ=[['ا',''],['ب','b'],['ت','t'],['ث','ts'],['ج','j'],['ح','h'],['خ','kh',1],['د','d'],['ذ','dz'],['ر','r',1],['ز','z'],['س','s'],['ش','sy'],['ص','sh',1],['ض','dh',1],['ط','th',1],['ظ','zh',1],['ع',"'"],['غ','gh',1],['ف','f'],['ق','q',1],['ك','k'],['ل','l'],['م','m'],['ن','n'],['و','w'],['ه','h'],['ء',''],['ي','y']].map(([c,cons,o])=>({c,cons,o:!!o}));
const IQ_ENDS=[3,7,11,15,19,23,28];
const MARK={a:'َ',i:'ِ',u:'ُ'};
function readOf(h,v){if(h.c==='ا'||h.c==='ء')return v;if(h.c==='ع')return "'"+v;if(v==='a'&&h.o)return h.cons+'o';return h.cons+v;}
function iqKey(h,v){return 'iq:'+(h.c==='ء'?'ا':h.c)+v;}
function syl(h,v){return {ar:h.c+MARK[v],r:readOf(h,v),k:[iqKey(h,v)]};}
function iqLevel(){return store.get('iqLevel',1);}
function iqGroup(){return store.get('iqGroup',6);}
function iqBaris(){return store.get('iqBaris','i');}
function iqLabel(){const lv=iqLevel();return lv===1?"Iqra' 1, huruf berbaris atas":lv===2?"Iqra' 2, huruf bersambung":"Iqra' 3, baris bawah dan depan";}
function vowel(b){const x=Math.random();if(b==='i')return x<.6?'i':'a';if(b==='u')return x<.5?'u':(x<.75?'i':'a');return pick(['a','i','u']);}
function iqGenLine(){
  const lv=iqLevel(),out=[];
  if(lv===1){
    const g=iqGroup(),end=IQ_ENDS[g],start=g?IQ_ENDS[g-1]+1:0,allowed=HIJ.slice(0,end+1),fresh=HIJ.slice(start,end+1);let prev=null;
    for(let k=0;k<4;k++){let h;do{h=Math.random()<.5?pick(fresh):pick(allowed);}while(h===prev);prev=h;out.push(syl(h,'a'));}
  }else{
    const pool=HIJ.filter(h=>h.c!=='ا'&&h.c!=='ء'),b=iqBaris();
    for(let k=0;k<4;k++){const len=lv===2?rint(2,3):rint(1,2);let ar='',r='';const ks=[];for(let j=0;j<len;j++){const s=syl(pick(pool),lv===2?'a':vowel(b));ar+=s.ar;r+=s.r;ks.push(...s.k);}out.push({ar,r,k:ks});}
  }
  return out;
}
function screenIqraMenu(){
  curModule=3;
  ambBlocked=true;
  setBar("Iqra'",()=>go(screenHome));
  const lv=iqLevel();
  let chips=chipRow("Iqra'",'iqLevel',[[1,"Iqra' 1"],[2,"Iqra' 2"],[3,"Iqra' 3"]],lv);
  if(lv===1)chips+=chipRow('Huruf sampai','iqGroup',IQ_ENDS.map((e,i)=>[i,`<span class="ar">${HIJ[e].c}</span>`]),iqGroup());
  if(lv===3)chips+=chipRow('Baris','iqBaris',[['i','Baris bawah (i)'],['u','Baris depan (u)'],['c','Campur a, i, u']],iqBaris());
  menuPage({title:"Iqra'",intro:'Pilih tahap Husayn sekarang. Untuk membaca, ibu atau ayah dengar dan semak.',color:'plum',chips,
    cards:[{icon:'📗',name:'Baca bersama',sub:'Husayn baca, ibu atau ayah semak',fn:screenIqraBaca},{icon:'🔤',name:'Kenal huruf',sub:'Padankan huruf dengan bacaan',fn:screenIqraHuruf}]});
  bindChips('iqLevel',screenIqraMenu);bindChips('iqGroup',screenIqraMenu);bindChips('iqBaris',screenIqraMenu);
}
function screenIqraBaca(){
  document.body.classList.add("quiet");
  ambBlocked=true;
  setBar("Iqra' · Baca",()=>go(screenIqraMenu));
  let showR=store.get('iqRumi',false),count=0,items=[];
  main.innerHTML=`<div class="page act m-plum">
    <div class="acthead"><p class="hint">${iqLabel()}. Baca dari kanan ke kiri.</p><span class="score paper">Baris: <b id="sc">0</b></span></div>
    <div class="qarea paper t2"><div class="iqline" dir="rtl" id="line"></div>
      <div class="row center"><button class="btn soft" id="tR"></button><button class="btn soft" id="nl">Baris lain</button></div></div>
    <div class="parent paper"><span class="lbl">Untuk ibu/ayah: dengar Husayn baca satu baris, kemudian tekan</span><button class="btn leaf" id="ok"><img src="img/ic-check.webp" alt="">Betul</button><button class="btn sun" id="ag"><img src="img/ic-undo.webp" alt="">Ulang</button></div>
    ${mascot('🐢','Baca satu-satu, mula dari kanan. Tekan huruf untuk tengok bacaan.')}</div>`;
  const line=$('#line');
  function lbl(){$('#tR').textContent=showR?'Sorok bacaan':'Tunjuk bacaan';line.classList.toggle('showrumi',showR);}
  function newLine(){
    items=iqGenLine();
    line.innerHTML=items.map((it,k)=>`<button class="iq paper" data-k="${k}"><span class="ar">${it.ar}</span><span class="rumi">${it.r}</span></button>`).join('');
    $$('.iq',line).forEach(b=>b.onclick=()=>{b.classList.add('reveal');say(items[+b.dataset.k].k);setTimeout(()=>b.classList.remove('reveal'),1800);});
  }
  $('#tR').onclick=()=>{showR=!showR;store.set('iqRumi',showR);lbl();};
  $('#nl').onclick=newLine;
  $('#ok').onclick=()=>{count++;$('#sc').textContent=count;mascotSay(pick(PRAISE),'happy');addStars(1);celebrate(count%5===0?3:2);setTimeout(newLine,900);};
  $('#ag').onclick=async()=>{mascotSay('Tak apa. Baca sekali lagi, perlahan-lahan.');for(const b of $$('.iq',line)){b.classList.add('reveal');await sleep(700);b.classList.remove('reveal');}};
  lbl();newLine();
}
function screenIqraHuruf(){
  ambBlocked=true;
  actShell('Kenal huruf',()=>go(screenIqraMenu),'Padankan huruf dengan bacaannya.','🐢','Yang mana satu?','plum');
  let right=0;
  function newQ(){
    const lv=iqLevel();const pool=(lv===1?HIJ.slice(0,IQ_ENDS[iqGroup()]+1):HIJ).filter(h=>h.c!=='ء');
    const lab=h=>readOf(h,'a');const ans=pick(pool);const opts=[ans];
    for(const h of shuffle(pool)){if(opts.length>=3)break;if(!opts.some(o=>lab(o)===lab(h)))opts.push(h);}
    const r2a=Math.random()<.5;
    $('#q').innerHTML=(r2a?`<div class="iqprompt">Mana satu <b>${lab(ans)}</b>?</div><div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt ar" data-v="${o.c}">${o.c+MARK.a}</button>`).join('')}</div>`
      :`<div class="iqbig">${ans.c+MARK.a}</div><div class="iqprompt">Ini bacaannya apa?</div><div class="opts" id="op">${shuffle(opts).map(o=>`<button class="opt rm" data-v="${o.c}">${lab(o)}</button>`).join('')}</div>`)+'<div class="row center" id="nxr"></div>';
    if(r2a)say(iqKey(ans,'a'));
    bindOpts($('#op'),v=>v===ans.c,()=>{right++;$('#sc').textContent=right;{const p=pick(PRAISE);mascotSay(`${p} Itu ${lab(ans)}.`,'happy',true,[p,'itu',iqKey(ans,'a')]);}addStars(1);celebrate(right%5===0?3:2);$('#nxr').innerHTML='<button class="btn big plum" id="nx">Seterusnya ›</button>';$('#nx').onclick=newQ;});
  }
  newQ();
}


/* ---------- RAKAM SUARA: recording script for the parent ---------- */
const W_LEAD3=['Wah, cantiknya!','Hebat, Husayn!','MasyaAllah, kemas!','Terbaik! Tiga bintang!'];
const W_LEAD2=['Bagus!','Pandai!','Cantik!'];
const PHRASES=[...PRAISE,...TRY,...W_LEAD3,...W_LEAD2,'Sikit lagi nak dapat tiga bintang.','Boleh! Jom baiki sikit lagi.',
 'Jom cuba lagi. Ikut garisan putus-putus perlahan-lahan.','Jom cuba lagi. Tengok contoh dulu, lepas tu tulis.','Eh, macam terbalik! Tengok contoh, cuba lagi.','Belum habis lagi tu. Sambung sikit ya!',
 'Garisan nombor','Belum cukup. Tengok titik oren.','Ada bahagian belum cukup. Tengok titik oren.','Tulisan terkeluar garisan sikit. Perlahan-lahan ya.','Bentuk huruf ni lain sikit. Tengok contoh ya.','Ada garisan lebih yang bukan sebahagian huruf ni.','Jangan lupa titiknya.',
 'Ikut garisan putus-putus. Mula dari titik hijau nombor 1.','Tulis sendiri dalam kotak. Tengok contoh kalau lupa.','Jom tulis dulu, lepas tu tekan Siap.',
 'Jom kira sama-sama!','Jom kira semua.','Jom kira yang tinggal.','Tak apa. Baca sekali lagi, satu-satu perkataan.','Tak apa. Baca sekali lagi, perlahan-lahan.'];
function voiceLists(){
  const uniq=a=>{const seen=new Set();return a.filter(t=>{const k=vkey(t);if(seen.has(k))return false;seen.add(k);return true;});};
  const syl=uniq(WORDS.flatMap(w=>w.s));
  const words=WORDS.map(w=>w.w);
  const sw=uniq(SENT.flatMap(x=>x.t.split(' ').map(t=>t.replace('.','')))).filter(t=>!words.some(w=>vkey(w)===vkey(t)));
  const iq=v=>HIJ.filter(h=>h.c!=='ء').map(h=>({t:h.c+MARK[v],r:readOf(h,v),k:iqKey(h,v),ar:true}));
  const L=(id,title,gap,items,note)=>({id,title,gap,note,items:items.map(x=>typeof x==='string'?{t:x,k:vkey(x)}:x)});
  const out=[
    L('A','Suku kata',1,syl,'Untuk Bina perkataan.'),
    L('B','Perkataan',1,uniq([...words,...sw]),'Nama gambar, kemudian perkataan dalam ayat.'),
    L('C','Ayat',2,SENT.map(x=>x.t),'Baca macam bercerita, perlahan.'),
    L('D','Nombor dan kira',1,[...NUMW.slice(1),'tambah','tolak','jadi','tinggal','semuanya','ada','pergi','itu','Membaca','Mengira','Menulis',"Iqra'"],'Nombor 1 hingga 10, kemudian perkataan untuk kira.'),
    L('E','Pujian dan arahan',2,PHRASES,'Sebut dengan ceria, macam bercakap dengan Husayn.'),
    L('F',"Iqra' baris atas",1,iq('a'),'a, ba, ta ... ikut turutan Iqra\' 1.'),
    L('G',"Iqra' baris bawah",1,iq('i'),'i, bi, ti ...'),
    L('H',"Iqra' baris depan",1,iq('u'),'u, bu, tu ...')
  ];
  const seen=new Set();out.forEach(l=>{l.items=l.items.filter(i=>{if(seen.has(i.k))return false;seen.add(i.k);return true;});});
  return out;
}
function screenRakam(open){
  setBar('Rakam suara',()=>go(screenHome));ambBlocked=true;
  const lists=voiceLists();
  const total=lists.reduce((a,l)=>a+l.items.length,0),have=lists.reduce((a,l)=>a+l.items.filter(x=>VOICE[x.k]).length,0);
  main.innerHTML=`<div class="page rakam">
    <div class="pagehead"><div><h1>Rakam suara ibu/ayah</h1><p>${lists.length} rakaman, ${total} klip. Sudah ada: ${have}.</p></div></div>
    <div class="howto">
      <b>Cara rakam</b>
      <ol>
        <li>Buka senarai di tablet. Rakam guna app perakam di telefon.</li>
        <li>Satu senarai, satu rakaman. Baca ikut turutan dari atas. Jangan sebut nombor.</li>
        <li>Berhenti sekejap antara setiap item: <b>1 saat</b> atau <b>2 saat</b>, seperti tertulis pada senarai.</li>
        <li>Tersalah sebut? <b>Diam 3 saat</b>, sebut semula item yang sama, kemudian sambung.</li>
        <li>Bilik senyap, telefon lebih kurang sejengkal dari mulut.</li>
        <li>Namakan fail ikut huruf senarai (A, B, C...) dan hantar dalam chat dengan Claude.</li>
      </ol>
    </div>
    <div class="reclist">${lists.map(l=>{const n=l.items.length,h=l.items.filter(x=>VOICE[x.k]).length;return `
      <details class="rec" ${open===l.id?'open':''} data-id="${l.id}">
        <summary><span class="recid">${l.id}</span><span class="rect"><b>${l.title}</b><small>${n} klip · jeda ${l.gap} saat${h?` · ${h===n?'siap':h+' ada'}`:''}</small></span><span class="recst ${h===n?'done':''}">${h===n?'✓':''}</span></summary>
        <p class="recnote">${l.note}</p>
        <ol class="items ${l.items[0].ar?'ar':''} ${l.gap>1?'long':''}">${l.items.map(x=>`<li>${x.ar?`<span class="ia">${x.t}</span><small>${x.r}</small>`:x.t}</li>`).join('')}</ol>
      </details>`;}).join('')}</div>
  </div>`;
}

/* ---------- boot ---------- */
renderSound();renderStars(false);
window.__hb={judgeWriting,sampleGlyph,CFG};
screenHome();
setTimeout(()=>{const l=$('#loader');if(l){l.style.opacity='0';setTimeout(()=>l.remove(),450);}},350);
if('serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
