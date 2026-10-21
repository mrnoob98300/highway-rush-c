(async()=>{'use strict';
const root=document.getElementById('gameShell'), canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
let W=1000,H=600,DPR=1,mode='menu',time=0,last=0,travel=0,distance=0,coins=0,health=100,nitro=0,boost=false,best=0,flash=0,invincible=0,spawnT=2,coinT=1.1,itemId=0,playerX=0,velocity=0,keyLeft=false,keyRight=false,toastLeft=0,shake=0;
let objects=[],sparks=[],renderFaces=[];let hudElapsed=0,taskElapsed=0,simulationDebt=0,lastDrawTime=-Infinity;
try{best=Number(localStorage.getItem('highway-rush-3d-best')||0)||0}catch(e){}
$('best').innerHTML=String(best).padStart(5,'0')+' <small>m</small>';
// Landscape fullscreen is requested only from a tap; rotate hint covers portrait phones.
const shellEl=root.closest('.shell');shellEl.append($('rotateHint'));
function refreshMobileLayout(){document.body.classList.toggle('mobile-game',matchMedia('(pointer:coarse)').matches||innerWidth<=950||innerHeight<=540);}
refreshMobileLayout();window.addEventListener('resize',refreshMobileLayout);
async function enterFullscreen(){try{if(!document.fullscreenElement&&shellEl.requestFullscreen)await shellEl.requestFullscreen({navigationUI:'hide'});else if(!document.fullscreenElement&&shellEl.webkitRequestFullscreen)shellEl.webkitRequestFullscreen();if(document.fullscreenElement&&screen.orientation?.lock)try{await screen.orientation.lock('landscape')}catch{} }catch{}refreshMobileLayout();}
$('fullscreenBtn').onclick=async()=>{if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}else await enterFullscreen()};
$('rotateFullscreenBtn').onclick=enterFullscreen;
root.addEventListener('click',e=>{if(document.body.classList.contains('mobile-game')&&e.target.closest('#goBtn,#playBtn,#nextBtn'))enterFullscreen()},true);
document.addEventListener('fullscreenchange',()=>{const full=!!document.fullscreenElement;$('fullscreenBtn').textContent=full?'✕':'⛶';$('fullscreenBtn').setAttribute('aria-label',full?'Exit fullscreen':'Enter fullscreen');refreshMobileLayout()});
const R=(a,b)=>Math.random()*(b-a)+a,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
// ================= PROCEDURAL AUDIO (Web Audio API) =================
let ACTX=null,masterGain=null,engOsc=null,engGain=null,engFilt=null,boostOsc=null,boostGain=null,muted=false,audioReady=false;
function ensureAudio(){if(ACTX)return;try{ACTX=new(window.AudioContext||window.webkitAudioContext)();masterGain=ACTX.createGain();masterGain.gain.value=.45;masterGain.connect(ACTX.destination);
 engOsc=ACTX.createOscillator();engOsc.type='sawtooth';engOsc.frequency.value=55;engGain=ACTX.createGain();engGain.gain.value=0;engFilt=ACTX.createBiquadFilter();engFilt.type='lowpass';engFilt.frequency.value=420;engFilt.Q.value=.7;
 engOsc.connect(engFilt);engFilt.connect(engGain);engGain.connect(masterGain);engOsc.start();
 boostOsc=ACTX.createOscillator();boostOsc.type='sawtooth';boostOsc.frequency.value=90;boostGain=ACTX.createGain();boostGain.gain.value=0;const bf=ACTX.createBiquadFilter();bf.type='bandpass';bf.frequency.value=900;bf.Q.value=2;
 boostOsc.connect(bf);bf.connect(boostGain);boostGain.connect(masterGain);boostOsc.start();audioReady=true}catch(e){muted=true}}
function resumeAudio(){ensureAudio();if(ACTX&&ACTX.state==='suspended')ACTX.resume().catch(()=>{})}
function beep(freq,dur,type,vol,slide){if(muted||!ACTX)return;const t=ACTX.currentTime,o=ACTX.createOscillator(),g=ACTX.createGain();o.type=type||'square';o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),t+dur);g.gain.setValueAtTime(vol||.15,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(masterGain);o.start(t);o.stop(t+dur+.02)}
function noiseBurst(dur,vol,hp){if(muted||!ACTX)return;const t=ACTX.currentTime,len=Math.floor(ACTX.sampleRate*dur),buf=ACTX.createBuffer(1,len,ACTX.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.4);const s=ACTX.createBufferSource();s.buffer=buf;const f=ACTX.createBiquadFilter();f.type=hp?'highpass':'lowpass';f.frequency.value=hp||800;const g=ACTX.createGain();g.gain.setValueAtTime(vol||.2,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(masterGain);s.start(t)}
const SFX={
 coin(){beep(880,.08,'sine',.12,1320);beep(1320,.12,'sine',.08,1760)},
 nitro(){beep(220,.15,'sawtooth',.1,440);beep(440,.25,'triangle',.08,880)},
 heal(){beep(523,.1,'sine',.1);setTimeout(()=>beep(659,.1,'sine',.1),70);setTimeout(()=>beep(784,.18,'sine',.12),140)},
 hit(){noiseBurst(.22,.35,180);beep(90,.2,'sawtooth',.18,40)},
 bomb(){noiseBurst(.35,.4,120);beep(60,.3,'square',.2,30)},
 boostOn(){beep(180,.08,'sawtooth',.12,360);noiseBurst(.15,.15,400)},
 win(){beep(523,.12,'triangle',.12);setTimeout(()=>beep(659,.12,'triangle',.12),100);setTimeout(()=>beep(784,.12,'triangle',.12),200);setTimeout(()=>beep(1046,.35,'sine',.15),320)},
 lose(){beep(300,.2,'sawtooth',.15,120);setTimeout(()=>beep(180,.35,'sawtooth',.12,60),150)},
 click(){beep(600,.04,'square',.06)},
 start(){beep(150,.1,'sawtooth',.1,300);setTimeout(()=>beep(300,.15,'sawtooth',.1,500),80)},
 pass(){beep(200,.05,'triangle',.04,100)},
 ready(){beep(660,.08,'sine',.1);setTimeout(()=>beep(990,.15,'sine',.12),90)}
};
function updateEngine(speedNorm,boosting,running){if(!audioReady||muted)return;const t=ACTX.currentTime;if(!running){engGain.gain.setTargetAtTime(0,t,.08);boostGain.gain.setTargetAtTime(0,t,.05);return}
 const rpm=55+speedNorm*95+(boosting?40:0);engOsc.frequency.setTargetAtTime(rpm,t,.05);engFilt.frequency.setTargetAtTime(380+speedNorm*900+(boosting?600:0),t,.08);engGain.gain.setTargetAtTime(.04+.06*speedNorm+(boosting?.04:0),t,.08);
 boostGain.gain.setTargetAtTime(boosting?.09:0,t,.04);if(boosting)boostOsc.frequency.setTargetAtTime(80+speedNorm*60+Math.sin(t*18)*12,t,.02)}
function resize(){let r=root.getBoundingClientRect();W=Math.max(320,r.width);H=Math.max(420,r.height);DPR=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}resize();new ResizeObserver(resize).observe(root);
// ================= CINEMATIC RENDERER (golden-hour, perspective, glow FX) =================
let cx=0,hor=0,hY=0,ppu=1,camX=0,camRoll=0,camPitch=0,camSmooth=0,pT=0,pT0=performance.now(),bs=0,pC=0,pN=0,pF=0,sunX=0,sunY=0,smokeT=0,steerInput=0,skidMarks=[];
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
const pr=(x,z)=>{const s=1/(1+(3-z)/12.5);return[cx+(x-camX)*ppu*s,hor+(hY-hor)*s+camPitch*(1-s)*28,s]};
const up=(x,z,h)=>{const p=pr(x,z);return[p[0],p[1]-h*ppu*p[2],p[2]]};
function sh(hex,k){const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255,t=k<0?0:255,a=Math.abs(k);return`rgb(${Math.round(r+(t-r)*a)},${Math.round(g+(t-g)*a)},${Math.round(b+(t-b)*a)})`}
function poly(pts,fill){ctx.fillStyle=fill;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill()}
const qd=(x1,x2,za,zb,c)=>poly([pr(x1,za),pr(x2,za),pr(x2,zb),pr(x1,zb)],c);
function glow(x,y,r,c,a=1){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=a;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore()}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function ln(a,b,c,w){ctx.strokeStyle=c;ctx.lineWidth=Math.max(1,w);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}

function mount(base,amp,col,sp,seed){ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(-20,hor+2);for(let x=-20;x<=W+30;x+=10){const u=x/W*3+seed+camX*sp*.02;ctx.lineTo(x,hor-base-(Math.sin(u*1.7)*.5+Math.sin(u*4.1+seed)*.3+Math.sin(u*9.3)*.12+.9)*amp)}ctx.lineTo(W+30,hor+2);ctx.closePath();ctx.fill()}
function sky(){
 const T=TH(),g=ctx.createLinearGradient(0,0,0,hor);T.s.forEach((c,i)=>g.addColorStop(i/4,c));ctx.fillStyle=g;ctx.fillRect(-60,-60,W+120,hor+62);
 if(T.n)for(let i=0;i<70;i++){ctx.fillStyle=`rgba(255,255,255,${.3+.5*Math.abs(Math.sin(pT*1.5+i))})`;ctx.fillRect(hash(i)*W,hash(i+7)*hor*.8,1.6,1.6)}
 sunX=W*.6-camX*5;sunY=hor-H*(T.n?.3:.06);
 glow(sunX,sunY,H*.6,T.n?'rgba(110,140,255,.3)':T.d?'rgba(255,255,255,.4)':'rgba(255,160,80,.5)');
 ctx.fillStyle=T.n?'#eef2ff':'#fff4d2';ctx.beginPath();ctx.arc(sunX,sunY,H*.045,0,7);ctx.fill();
 glow(sunX,sunY,H*.16,T.n?'rgba(200,215,255,.8)':'rgba(255,235,190,.95)');
 for(let i=0;i<6;i++){const x=((i*297+pT*(4+i*1.5))%(W+500))-250,y=hor*(.16+hash(i)*.5),r=34+hash(i+9)*50;
  ctx.fillStyle=T.c1;ctx.beginPath();ctx.ellipse(x,y+r*.12,r*1.9,r*.28,0,0,7);ctx.fill();
  ctx.fillStyle=T.c2;ctx.beginPath();ctx.ellipse(x-r*.2,y,r*1.5,r*.2,0,0,7);ctx.fill()}
 mount(H*.02,H*.15,T.m[0],.6,1.3);mount(0,H*.10,T.m[1],1.2,4.1);mount(-H*.01,H*.05,T.m[2],2,7.7);
}
function ground(){
 const g=ctx.createLinearGradient(0,hor,0,H);g.addColorStop(0,'#d4a878');g.addColorStop(.2,'#8a8a52');g.addColorStop(.55,'#3d5630');g.addColorStop(1,'#1e3018');
 ctx.fillStyle=g;ctx.fillRect(-60,hor,W+120,H-hor+80);
 // parallax field strips
 for(let z=-228+(travel%14);z<10;z+=14){qd(-95,-7.7,z,z+7,'rgba(0,0,0,.1)');qd(7.7,95,z,z+7,'rgba(0,0,0,.1)')}
 // distant grass texture noise
 for(let i=0;i<18;i++){const z=-180+hash(i+travel*.01)*160,s=hash(i+3)>.5?1:-1,x=s*(9+hash(i+7)*40),p=pr(x,z);if(p[2]<.08)continue;
  ctx.fillStyle=`rgba(40,80,30,${.15*p[2]})`;ctx.fillRect(p[0]-4*p[2]*ppu,p[1],8*p[2]*ppu,3*p[2]*ppu)}
}
function tree(id,z){
 for(const s of[-1,1]){const k=id*2+(s>0?1:0);if(hash(k)>.78)continue;
  const x=s*(11.5+hash(k+3)*9),p=pr(x,z),u=ppu*p[2],r=(1.2+hash(k+5)*.8)*u,dir=sunX>p[0]?1:-1;if(u<1.2)continue;
  ctx.fillStyle='rgba(10,8,25,.3)';ctx.beginPath();ctx.ellipse(p[0]-dir*r*.6,p[1],r*1.5,r*.28,0,0,7);ctx.fill();
  ctx.fillStyle='#4a3524';ctx.fillRect(p[0]-.15*u,p[1]-1.8*u,.3*u,1.8*u);
  for(let j=0;j<3;j++){const cxx=p[0]+(j-1)*r*.7,cyy=p[1]-1.8*u-r*(j===1?1.1:.55),rr_=r*(j===1?1:.8);
   ctx.fillStyle='#1f4228';ctx.beginPath();ctx.arc(cxx,cyy,rr_,0,7);ctx.fill();
   ctx.fillStyle='rgba(76,140,64,.8)';ctx.beginPath();ctx.arc(cxx+dir*rr_*.22,cyy-rr_*.2,rr_*.7,0,7);ctx.fill();
   ctx.fillStyle='rgba(255,190,116,.28)';ctx.beginPath();ctx.arc(cxx+dir*rr_*.45,cyy-rr_*.3,rr_*.35,0,7);ctx.fill()}}
}
function road(){
 // asphalt with depth gradient + subtle wet sheen bands
 const g=ctx.createLinearGradient(0,hor,0,H);g.addColorStop(0,'#9a9098');g.addColorStop(.08,'#6a6e7c');g.addColorStop(.45,'#3a3f4c');g.addColorStop(1,'#1c2028');
 qd(-7.15,7.15,-230,10,g);
 // perspective shade strips (3D depth)
 for(let z=-228+(travel%10);z<10;z+=10){const a=.04+(.08*(z+230)/240);qd(-7.15,7.15,z,z+5,`rgba(0,0,0,${a})`)}
 // lane grooves
 for(let l=0;l<5;l++){const c=(l-2)*2.83;qd(c-1.0,c-.48,-230,10,'rgba(0,0,0,.18)');qd(c+.48,c+1.0,-230,10,'rgba(0,0,0,.18)')}
 // sun reflection on road
 ctx.save();ctx.beginPath();[pr(-7.15,-230),pr(7.15,-230),pr(7.15,10),pr(-7.15,10)].forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.clip();
 glow(sunX,hor+H*.1,H*.5,'rgba(255,180,100,.5)',.85);
 // moving light streaks (motion feel)
 for(let i=0;i<5;i++){const zz=-200+(travel*1.8+i*42)%210,p0=pr(-1.2,zz),p1=pr(1.2,zz+8);if(p0[2]<.08)continue;
  ctx.strokeStyle=`rgba(255,230,180,${.08*p0[2]})`;ctx.lineWidth=Math.max(1,12*p0[2]);ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke()}
 ctx.restore();
 // red/white curbs
 for(const s of[-1,1]){for(let z=-228+(travel%6);z<10;z+=6){qd(s*7.1,s*7.85,z,z+3,'#e03a3a');qd(s*7.1,s*7.85,z+3,z+6,'#f5f2ea')}qd(s*6.9,s*7.15,-230,10,'#f4f1e6')}
 // dashed lane markers with better perspective
 for(const b of[-4.245,-1.415,1.415,4.245])for(let z=-230+(travel%12);z<10;z+=12){
  const pA=pr(b,z),pB=pr(b,z+5.5);if(pA[2]<.05)continue;
  ctx.strokeStyle=`rgba(255,248,230,${.55+pA[2]*.4})`;ctx.lineWidth=Math.max(1.2,.14*ppu*pA[2]);ctx.lineCap='butt';
  ctx.beginPath();ctx.moveTo(pA[0],pA[1]);ctx.lineTo(pB[0],pB[1]);ctx.stroke()}
 // skid marks from hard steering
 for(let i=skidMarks.length-1;i>=0;i--){const m=skidMarks[i];m.z+= (25)*0.016;m.a-=0.012;if(m.a<=0||m.z>8){skidMarks.splice(i,1);continue}
  const p=pr(m.x,m.z);if(p[2]<.06)continue;ctx.fillStyle=`rgba(20,18,25,${m.a*p[2]})`;ctx.beginPath();ctx.ellipse(p[0],p[1],.35*ppu*p[2],.08*ppu*p[2],0,0,7);ctx.fill()}
}
function roadside(){
 for(const s of[-1,1]){const x=s*8.4,a=up(x,-230,.85),b=up(x,10,.85),c=up(x,10,.5),d=up(x,-230,.5);
  const g=ctx.createLinearGradient(0,a[1],0,d[1]+8);g.addColorStop(0,'#e8eef4');g.addColorStop(1,'#7f8996');poly([a,b,c,d],g);
  for(let z=-228+(travel%8);z<10;z+=8){const p=pr(x,z),t=up(x,z,.85);ln(p,t,'#59616c',.22*ppu*p[2])}}
 for(let z=-220+(travel%40);z<12;z+=40)for(const s of[-1,1]){const zz=s>0?z:z+20;if(zz>8)continue;
  const b=pr(s*9.6,zz),t=up(s*9.6,zz,7.5),arm=up(s*7.4,zz,7.5),u=ppu*b[2];
  ln(b,t,'#2c303b',.28*u);ln(t,arm,'#2c303b',.2*u);glow(arm[0],arm[1],u*3.4,'rgba(255,190,100,.9)',.9);
  ctx.fillStyle='#fff3cf';ctx.beginPath();ctx.arc(arm[0],arm[1],Math.max(1,.16*u),0,7);ctx.fill()}
 for(let z=-220+(travel%110);z<6;z+=110){
  for(const s of[-1,1])ln(pr(s*8.8,z),up(s*8.8,z,6.8),'#8f99a3',.4*ppu*pr(0,z)[2]);
  poly([up(-8.8,z,6.8),up(8.8,z,6.8),up(8.8,z,6.3),up(-8.8,z,6.3)],'#a7b1bb');
  poly([up(-5.6,z,6.3),up(-.6,z,6.3),up(-.6,z,4.6),up(-5.6,z,4.6)],'#f1f4f0');
  poly([up(-5.45,z,6.15),up(-.75,z,6.15),up(-.75,z,4.75),up(-5.45,z,4.75)],'#10784c');
  poly([up(.6,z,6.3),up(5.6,z,6.3),up(5.6,z,4.6),up(.6,z,4.6)],'#f1f4f0');
  poly([up(.75,z,6.15),up(5.45,z,6.15),up(5.45,z,4.75),up(.75,z,4.75)],'#10784c')}
}
function haze(){const h=TH().h,g=ctx.createLinearGradient(0,hor-H*.08,0,hor+H*.18);g.addColorStop(0,`rgba(${h},0)`);g.addColorStop(.35,`rgba(${h},.45)`);g.addColorStop(.7,`rgba(${h},.65)`);g.addColorStop(1,`rgba(${h},0)`);ctx.fillStyle=g;ctx.fillRect(-60,hor-H*.08,W+120,H*.26)
 // atmospheric perspective overlay far field
 const g2=ctx.createLinearGradient(0,hor-H*.25,0,hor);g2.addColorStop(0,'rgba(180,200,230,0)');g2.addColorStop(1,`rgba(${h},.25)`);ctx.fillStyle=g2;ctx.fillRect(-60,hor-H*.25,W+120,H*.25)}

const M={muscle:[.31,.25,.70],super:[.25,.20,.60],hyper:[.22,.18,.58],sedan:[.34,.30,.74],suv:[.42,.38,.82],sport:[.28,.24,.66]};
function car(x,y,w,col,type,hero,al,st){
 if(type==='truck'||type==='bike')return big(x,y,w,col,type,al,hero,st);
 const m=M[type]||M.sedan,bh=m[0]*w,ch=m[1]*w,cw=m[2]*w,g0=.13*w,top=-g0-bh,roof=top-ch,cb=cw*.52,ct=cw*.40;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=al;
 ctx.fillStyle='rgba(8,6,20,.55)';ctx.beginPath();ctx.ellipse(0,0,w*.58,w*.07,0,0,7);ctx.fill();
 glow(0,0,w*.9,hero?V.glow:'rgba(255,30,40,.2)',hero?.6:1);
 ctx.fillStyle='#0b0c10';for(const s of[-1,1]){rr(s<0?-.5*w:.35*w,-.24*w,.15*w,.24*w,.04*w);ctx.fill()}
 ctx.fillStyle='rgba(185,195,210,.35)';for(const s of[-1,1]){rr(s<0?-.46*w:.39*w,-.17*w,.07*w,.1*w,.02*w);ctx.fill()}wheelTread(w,st);
 let g=ctx.createLinearGradient(0,roof,0,top);g.addColorStop(0,sh(col,.35));g.addColorStop(1,sh(col,-.2));poly([[-cb,top+2],[cb,top+2],[ct,roof],[-ct,roof]],g);
 g=ctx.createLinearGradient(0,roof,0,top);g.addColorStop(0,'#0e1c28');g.addColorStop(1,'#35566f');
 poly([[-cb*.9,top-.01*w],[cb*.9,top-.01*w],[ct*.88,roof+.035*w],[-ct*.88,roof+.035*w]],g);
 poly([[-cb*.6,top],[-cb*.25,top],[-ct*.1,roof+.04*w],[-ct*.45,roof+.04*w]],'rgba(255,200,150,.25)');
 ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=Math.max(1,w*.006);for(let i=1;i<4;i++){const yy=roof+(top-roof)*i/4;ctx.beginPath();ctx.moveTo(-cb*.8,yy);ctx.lineTo(cb*.8,yy);ctx.stroke()}
 rr(-ct*.45,roof+.045*w,ct*.9,.018*w,.008*w);ctx.fillStyle='#ff2b3a';ctx.fill();glow(0,roof+.055*w,w*.18,'rgba(255,40,55,.7)',.8);
 for(const s of[-1,1]){rr(s*(cb+.015*w)-.03*w,top-ch*.38,.06*w,.045*w,.015*w);ctx.fillStyle=sh(col,-.3);ctx.fill()}
 g=ctx.createLinearGradient(0,top,0,top+bh);g.addColorStop(0,sh(col,.4));g.addColorStop(.25,col);g.addColorStop(1,sh(col,-.55));
 rr(-w/2,top,w,bh,w*.08);ctx.fillStyle=g;ctx.fill();
 g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'rgba(0,0,0,.4)');g.addColorStop(.28,'rgba(255,255,255,.1)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(.72,'rgba(255,255,255,.06)');g.addColorStop(1,'rgba(0,0,0,.4)');
 rr(-w/2,top,w,bh,w*.08);ctx.fillStyle=g;ctx.fill();
 if(hero&&V.str){ctx.fillStyle=V.str;ctx.fillRect(-.075*w,top,.05*w,bh);ctx.fillRect(.025*w,top,.05*w,bh)}
 ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=Math.max(1,w*.012);ctx.beginPath();ctx.moveTo(-w*.42,top+bh*.12);ctx.lineTo(w*.42,top+bh*.12);ctx.stroke();
 g=ctx.createLinearGradient(0,top,0,top+bh*.4);g.addColorStop(0,'rgba(255,214,170,.35)');g.addColorStop(1,'rgba(255,214,170,0)');rr(-w/2+2,top+2,w-4,bh*.4,w*.07);ctx.fillStyle=g;ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.moveTo(-w*.47,top+bh*.56);ctx.lineTo(w*.47,top+bh*.56);ctx.stroke();
 const ly=top+bh*.22,lh=bh*.26;
 for(const s of[-1,1]){const lx=s<0?-.47*w:.2*w,lg=ctx.createLinearGradient(0,ly,0,ly+lh);lg.addColorStop(0,'#ff4b55');lg.addColorStop(1,'#8d0014');
  rr(lx,ly,.27*w,lh,lh*.3);ctx.fillStyle=lg;ctx.fill();ctx.fillStyle='rgba(255,210,210,.85)';ctx.fillRect(lx+.03*w,ly+lh*.38,.21*w,lh*.2);for(let i=0;i<5;i++){ctx.fillStyle='rgba(255,230,230,.7)';ctx.fillRect(lx+(.025+i*.045)*w,ly+lh*.08,.02*w,lh*.16)}glow(lx+.135*w,ly+lh/2,w*.36,'rgba(255,40,55,.8)',.85)}
 if(type==='sport'||hero){rr(-.2*w,ly+lh*.3,.4*w,lh*.4,lh*.2);ctx.fillStyle='#ff3a4a';ctx.fill()}
 rr(-.46*w,top+bh*.58,.92*w,bh*.42,w*.05);ctx.fillStyle='#10131a';ctx.fill();
 rr(-.1*w,top+bh*.66,.2*w,.055*w,.01*w);ctx.fillStyle='#e8ecef';ctx.fill();
 ctx.fillStyle='rgba(200,210,225,.5)';ctx.fillRect(-.44*w,top+bh*.6,.88*w,.012*w);ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(-.38*w,top+bh*.7,.1*w,.03*w);ctx.fillRect(.28*w,top+bh*.7,.1*w,.03*w);
 ctx.strokeStyle='rgba(120,130,150,.4)';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*.07*w,top+bh*.84);ctx.lineTo(i*.07*w,top+bh*.98);ctx.stroke()}
 if(hero){
  ctx.fillStyle='#0a0f0c';ctx.fillRect(-.3*w,top-.06*w,.04*w,.06*w);ctx.fillRect(.26*w,top-.06*w,.04*w,.06*w);
  g=ctx.createLinearGradient(0,top-.11*w,0,top-.05*w);g.addColorStop(0,'#5fe333');g.addColorStop(.3,'#16301a');g.addColorStop(1,'#07110a');rr(-.52*w,top-.11*w,1.04*w,.06*w,.015*w);ctx.fillStyle=g;ctx.fill();
  for(const s of[-1,1]){const ex=s*.26*w,ey=-g0*.45;g=ctx.createRadialGradient(ex-.01*w,ey-.01*w,0,ex,ey,.05*w);g.addColorStop(0,'#fff');g.addColorStop(.6,'#8d97a3');g.addColorStop(1,'#2a2f38');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ex,ey,.05*w,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.arc(ex,ey,.03*w,0,7);ctx.fill();
   if(boost){const L=w*(.45+.3*Math.random());poly([[ex-.05*w,ey],[ex+.05*w,ey],[ex,ey+L]],'rgba(70,190,255,.85)');poly([[ex-.025*w,ey],[ex+.025*w,ey],[ex,ey+L*.55]],'rgba(235,252,255,.95)');glow(ex,ey+.12*w,w*.5,'rgba(60,170,255,.9)')}}}
 carDetail(w,type,col,hero,st,top,roof,cb,ct,bh,ly,lh);
 ctx.restore();
}
function wheelTread(w,st){const ph=((((st&&st.ph!==undefined)?st.ph:travel*.5))%1+1)%1;ctx.save();ctx.lineWidth=Math.max(1,w*.008);
 for(const s of[-1,1]){const x0=s<0?-.5*w:.35*w;ctx.save();rr(x0,-.24*w,.15*w,.24*w,.04*w);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.10)';
  for(let i=-1;i<7;i++){const yy=-.24*w+(i+ph)*.045*w;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+.15*w,yy+.012*w);ctx.stroke()}
  const g=ctx.createLinearGradient(x0,0,x0+.15*w,0);g.addColorStop(0,'rgba(255,255,255,.14)');g.addColorStop(.3,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.25)');ctx.fillStyle=g;ctx.fillRect(x0,-.24*w,.15*w,.24*w);ctx.restore()}
 ctx.restore()}
function carDetail(w,type,col,hero,st,top,roof,cb,ct,bh,ly,lh){
 const blink=Math.floor(pT*3.6)%2===0,sg=st?st.sig:0,bk=!!(st&&st.bk);let g;
 // dark underbody between the wheels
 ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(-.36*w,-.13*w,.72*w,.1*w);
 if(!hero){
  // driver (+ optional passenger) silhouettes + headrests behind the rear glass
  const wy0=roof+.035*w,wy1=top-.01*w,wh=wy1-wy0;
  if(wh>2){ctx.fillStyle='rgba(8,12,18,.78)';for(const s of[-1,1]){rr(s*cb*.36-.04*w,wy0+wh*.42,.08*w,.07*w,.02*w);ctx.fill()}
   ctx.fillStyle='rgba(6,9,14,.88)';const heads=st&&st.pax?[-1,1]:[1];for(const s of heads){ctx.beginPath();ctx.arc(s*cb*.36,wy0+wh*.3,.04*w,0,7);ctx.fill();rr(s*cb*.36-.06*w,wy0+wh*.5,.12*w,wh*.5,.03*w);ctx.fill()}}
  if(type==='sedan'||type==='suv'){ctx.strokeStyle='#0c0e12';ctx.lineWidth=Math.max(1,w*.008);ctx.beginPath();ctx.moveTo(ct*.72,roof+.01*w);ctx.lineTo(ct*.72+.012*w,roof-.14*w);ctx.stroke();ctx.fillStyle='#d6dbe2';ctx.beginPath();ctx.arc(ct*.72+.012*w,roof-.14*w,Math.max(1,.009*w),0,7);ctx.fill()}
  if(type==='suv'){ctx.fillStyle='#14171d';rr(-ct*.95,roof-.03*w,ct*1.9,.02*w,.008*w);ctx.fill();ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(-ct*.9,roof-.03*w,ct*1.8,.004*w);ctx.fillStyle='#14171d';ctx.fillRect(-ct*.85,roof-.012*w,.02*w,.015*w);ctx.fillRect(ct*.85-.02*w,roof-.012*w,.02*w,.015*w);
   ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=Math.max(1,w*.007);ctx.beginPath();ctx.moveTo(0,top-.012*w);ctx.lineTo(cb*.45,top-ch0(w,type)*.55);ctx.stroke()}
  if(type==='sport'){ctx.fillStyle=sh(col,-.5);ctx.fillRect(-.34*w,top-.05*w,.025*w,.05*w);ctx.fillRect(.315*w,top-.05*w,.025*w,.05*w);rr(-.5*w,top-.085*w,w,.04*w,.012*w);ctx.fillStyle='#14171d';ctx.fill();ctx.fillStyle=col;ctx.fillRect(-.5*w,top-.085*w,w,.012*w);ctx.fillStyle='#14171d';ctx.fillRect(-.5*w,top-.1*w,.018*w,.07*w);ctx.fillRect(.482*w,top-.1*w,.018*w,.07*w)}
  // exhaust tips
  const ex=type==='sport'||type==='muscle'?[-.3,.3]:[.3];for(const s of ex){const px=s*w,py=-.075*w;g=ctx.createRadialGradient(px-.01*w,py-.01*w,0,px,py,.042*w);g.addColorStop(0,'#fff');g.addColorStop(.6,'#8d97a3');g.addColorStop(1,'#2a2f38');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(px,py,.042*w,.03*w,0,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.ellipse(px,py,.027*w,.019*w,0,0,7);ctx.fill()}
 }
 // badge
 g=ctx.createRadialGradient(-.006*w,top+bh*.47-.006*w,0,0,top+bh*.47,.026*w);g.addColorStop(0,'#fff');g.addColorStop(1,'#7e8794');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,top+bh*.47,.024*w,0,7);ctx.fill();
 // plate text
 plateTxt(w,-.1*w,top+bh*.66,.2*w,.055*w,(st&&st.plate)||(hero?'HR-3D':''));
 // brake lights + indicators
 if(bk){for(const s of[-1,1])glow(s*.335*w,ly+lh/2,w*.6,'rgba(255,30,40,.95)');ctx.fillStyle='#ff5a64';rr(-.14*w,ly+lh*.3,.28*w,lh*.4,lh*.2);ctx.fill()}
 for(const d of[-1,1])if(sg===d&&blink){const x0=d<0?-.47*w:.38*w;ctx.fillStyle='#ffb020';rr(x0,ly,.09*w,lh,lh*.25);ctx.fill();glow(x0+.045*w,ly+lh/2,w*.36,'rgba(255,170,30,.95)')}
}
const ch0=(w,type)=>(M[type]||M.sedan)[1]*w;
function pick(o,p,al){
 const u=ppu*p[2],x=p[0],y=p[1];ctx.save();ctx.globalAlpha=al;
 ctx.fillStyle='rgba(8,6,20,.4)';ctx.beginPath();ctx.ellipse(x,y,.45*u,.1*u,0,0,7);ctx.fill();
 if(o.kind==='coin'){const cy=y-(.95+Math.sin(pT*4+o.id)*.1)*u,k=Math.max(.15,Math.abs(Math.cos(pT*3+o.id*1.7))),r=.42*u;
  glow(x,cy,r*2.6,'rgba(255,200,60,.7)');const g=ctx.createLinearGradient(x-r,cy-r,x+r,cy+r);g.addColorStop(0,'#fff3a6');g.addColorStop(.5,'#f2b01e');g.addColorStop(1,'#a8650c');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,cy,r*k,r,0,0,7);ctx.fill();ctx.strokeStyle='#fff0a0';ctx.lineWidth=Math.max(1,u*.04);ctx.beginPath();ctx.ellipse(x,cy,r*k*.68,r*.68,0,0,7);ctx.stroke()}
 else if(o.kind==='nitro'){glow(x,y-.7*u,u*1.8,'rgba(40,190,255,.8)',.6+.4*Math.sin(pT*6));
  const g=ctx.createLinearGradient(x-.3*u,0,x+.3*u,0);g.addColorStop(0,'#0a4f9a');g.addColorStop(.5,'#38d8ff');g.addColorStop(1,'#0a4f9a');
  rr(x-.3*u,y-1.3*u,.6*u,1.2*u,.14*u);ctx.fillStyle=g;ctx.fill();rr(x-.18*u,y-1.45*u,.36*u,.18*u,.05*u);ctx.fillStyle='#d8f4ff';ctx.fill();
  poly([[x+.04*u,y-1.05*u],[x-.14*u,y-.7*u],[x-.01*u,y-.7*u],[x-.06*u,y-.35*u],[x+.16*u,y-.75*u],[x+.03*u,y-.75*u]],'#fff')}
 else if(o.kind==='heal'){glow(x,y-.7*u,u*1.7,'rgba(40,255,120,.7)',.6+.4*Math.sin(pT*5));const g=ctx.createLinearGradient(0,y-1.2*u,0,y-.2*u);g.addColorStop(0,'#fff');g.addColorStop(1,'#bfe8cf');rr(x-.5*u,y-1.2*u,u,u,.18*u);ctx.fillStyle=g;ctx.fill();ctx.fillStyle='#12b955';ctx.fillRect(x-.14*u,y-1.05*u,.28*u,.7*u);ctx.fillRect(x-.35*u,y-.84*u,.7*u,.28*u)}
 else{const cy=y-.55*u,r=.5*u;glow(x,cy,u*1.6,'rgba(255,40,30,.55)',.5+.5*Math.sin(pT*9));
  const g=ctx.createRadialGradient(x-r*.35,cy-r*.4,r*.1,x,cy,r);g.addColorStop(0,'#6b7483');g.addColorStop(1,'#0d1016');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,cy,r,0,7);ctx.fill();
  ctx.strokeStyle='#e8b923';ctx.lineWidth=u*.09;ctx.beginPath();ctx.ellipse(x,cy+r*.1,r*.96,r*.22,0,0,Math.PI);ctx.stroke();
  rr(x-.12*u,cy-r-.1*u,.24*u,.16*u,.03*u);ctx.fillStyle='#7b858f';ctx.fill();
  ctx.strokeStyle='#c9a46a';ctx.lineWidth=Math.max(1,u*.04);ctx.beginPath();ctx.moveTo(x,cy-r-.1*u);ctx.quadraticCurveTo(x+.05*u,cy-r-.4*u,x+.25*u,cy-r-.38*u);ctx.stroke();
  glow(x+.25*u,cy-r-.38*u,u*(.3+Math.random()*.25),'rgba(255,190,80,1)')}
 ctx.restore();
}
const FXC={spark:'rgba(255,170,60,1)',star:'rgba(255,215,80,1)',fire:'rgba(80,190,255,1)'};
function fx(x,y,n,t,spd){for(let i=0;i<n&&sparks.length<260;i++){const a=Math.random()*6.283,v=R(.3,1)*spd,l=R(.4,.9);sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(t==='star'?spd*.5:0),l,m:l,t,r:R(2,5)*W/1000+1})}}
function parts(dt){for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.l-=dt;if(p.l<=0){sparks.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;const k=p.l/p.m;
 if(p.t==='smoke'){ctx.fillStyle=`rgba(200,190,200,${k*.28})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(2.6-k*1.3),0,7);ctx.fill();ctx.fillStyle=`rgba(255,255,255,${k*.08})`;ctx.beginPath();ctx.arc(p.x-p.r*.3,p.y-p.r*.3,p.r*(1.2-k*.5),0,7);ctx.fill()}
 else if(p.t==='debris'){p.vy+=400*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.l*8);ctx.fillStyle=`rgba(80,70,60,${k*.9})`;ctx.fillRect(-p.r,-p.r*.4,p.r*2,p.r*.8);ctx.restore()}
 else{if(p.t==='spark')p.vy+=600*dt;glow(p.x,p.y,p.r*(p.t==='fire'?5:3.2),FXC[p.t]||'rgba(255,200,80,1)',k);if(p.t==='fire'&&k>.4){ctx.fillStyle=`rgba(200,240,255,${k*.5})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*.6,0,7);ctx.fill()}}}}
function speedLines(){if(mode!=='run')return;const a=bs*.55+.14+(Math.min(1,time*.02)*.08),D=Math.max(W,H);ctx.save();ctx.lineCap='round';
 for(let i=0;i<34;i++){const ang=hash(i)*6.283,ph=(pT*(1.4+bs*2.6)+hash(i+40))%1,d0=(.22+ph*.92)*D*.72,d1=d0+(.06+bs*.22)*D,c=Math.cos(ang),s=Math.sin(ang);
  ctx.strokeStyle=`rgba(255,240,220,${a*ph*(.7+hash(i+3)*.3)})`;ctx.lineWidth=1+hash(i+80)*2.1+bs*1.2;ctx.beginPath();ctx.moveTo(cx+c*d0,hor+s*d0*.85);ctx.lineTo(cx+c*d1,hor+s*d1*.85);ctx.stroke()}
 // center tunnel streaks when boosting
 if(bs>.2){for(let i=0;i<10;i++){const ph=(pT*(3+bs*4)+i*.17)%1,x=cx+(hash(i+20)-.5)*W*.18,y0=hor+ph*H*.7,y1=y0+(.04+bs*.1)*H;
  ctx.strokeStyle=`rgba(120,210,255,${bs*ph*.55})`;ctx.lineWidth=1.5+bs*2;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x+(hash(i)-.5)*8,y1);ctx.stroke()}}
 ctx.restore()}
function post(){
 if(sunY<hor+5)[.25,.5,.75,1.1].forEach((k,i)=>glow(sunX+(cx-sunX)*k,sunY+(H*.55-sunY)*k,H*(.03+i*.02),'rgba(255,190,120,.5)',.35));
 let g=ctx.createRadialGradient(cx,H*.5,H*.25,cx,H*.5,Math.max(W,H)*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(10,6,28,.55)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.fillStyle=TH().n?'rgba(10,18,60,.3)':'rgba(255,140,60,.05)';ctx.fillRect(0,0,W,H);
 // heat shimmer bands at high speed
 if(mode==='run'&&(bs>.15||time>8)){const shA=.04+bs*.1;ctx.save();ctx.globalAlpha=shA;for(let i=0;i<6;i++){const y=hor+H*(.15+i*.12)+Math.sin(pT*4+i*1.7)*4;g=ctx.createLinearGradient(0,y-8,0,y+8);g.addColorStop(0,'rgba(255,200,140,0)');g.addColorStop(.5,'rgba(255,210,160,.35)');g.addColorStop(1,'rgba(255,200,140,0)');ctx.fillStyle=g;ctx.fillRect(0,y-10,W,20)}ctx.restore()}
 if(bs>.02){g=ctx.createRadialGradient(cx,H*.5,H*.25,cx,H*.5,Math.max(W,H)*.75);g.addColorStop(0,`rgba(80,200,255,${bs*.12})`);g.addColorStop(.5,'rgba(40,150,255,0)');g.addColorStop(1,`rgba(30,120,255,${bs*.45})`);ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore()}
 if(flash>0){g=ctx.createRadialGradient(cx,H*.5,H*.2,cx,H*.5,Math.max(W,H)*.7);g.addColorStop(0,`rgba(255,30,60,${flash*.4})`);g.addColorStop(1,`rgba(255,20,50,${Math.min(.8,flash*2.2)})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
}
let world3D=null;
function draw(){
 const now=performance.now(),dt=clamp((now-pT0)/1000,0,.05);pT0=now;pT+=dt;
 cx=W*.5;hor=H*.38;hY=H*.86;ppu=Math.min(W*.072,H*.085);camX=playerX*.62;
 if(mode==='hub')travel+=dt*8;
 if(world3D)world3D.render({dt,mode,travel,playerX,velocity,vehicleId:mode==='hub'?prev:SV.sel,steer:steerInput,objects,boost,invincible,color:mode==='hub'?(SV.paint[prev]||VEH[prev].c):V.col,model:mode==='hub'?VEH[prev].m:V.model});
 const name=document.getElementById('modelName');if(name){name.hidden=mode!=='hub';if(name.textContent!==VEH[prev].n.toUpperCase())name.textContent=VEH[prev].n.toUpperCase()}
 root.style.setProperty('--hit-flash',Math.max(0,flash*1.6));
}

// ================= META: save, vehicles, levels, hub =================
let SV={coins:400,own:[0],sel:0,up:{},unlocked:1},V={},maxHP=100,lvl=1,selLv=1,prev=0,tab='play',task=null,passed=0,gN=0,hits=0,lives=3,endless=false;
try{Object.assign(SV,JSON.parse(localStorage.getItem('hr3d-save')||'{}'))}catch(e){}
SV.paint=SV.paint||{};SV.pown=SV.pown||{};if(!SV.apexDefault){SV.sel=0;SV.own=Array.from(new Set([0,...SV.own]));SV.apexDefault=true;if(SV.paint[0]==='#5fe333')delete SV.paint[0]}lvl=selLv=SV.unlocked;
const saveSV=()=>{try{localStorage.setItem('hr3d-save',JSON.stringify(SV))}catch(e){}};
const VEH=[
{id:0,n:'APEX GT Supercar',p:0,m:'super',c:'#b90819',g:'rgba(225,30,55,.6)',s:[1,1,25]},
{id:1,n:'Muscle GT',p:600,m:'muscle',c:'#ff8a1f',str:'#1b1b1f',g:'rgba(255,140,30,.6)',s:[1.06,.95,26]},
{id:2,n:'Drift King',p:1500,m:'sport',c:'#2f7bff',str:'#ffffff',g:'rgba(50,130,255,.65)',s:[1.1,1.15,27]},
{id:3,n:'Phantom',p:3200,m:'muscle',c:'#2b303b',str:'#ff2a4a',g:'rgba(255,40,80,.55)',s:[1.16,1.05,29]},
{id:4,n:'Solar Flare',p:6000,m:'super',c:'#ffd21f',str:'#14161c',g:'rgba(255,210,40,.65)',s:[1.22,1.12,31]},
{id:5,n:'Crimson Apex',p:11000,m:'super',c:'#e11d3a',str:'#f4f4f4',g:'rgba(255,30,60,.65)',s:[1.3,1.18,33]},
{id:6,n:'Neon Ghost',p:18000,m:'hyper',c:'#18d6e8',str:'#0b1a33',g:'rgba(30,230,255,.75)',s:[1.38,1.26,36]},
{id:7,n:'Gold Emperor',p:30000,m:'hyper',c:'#e2b33c',str:'#2a1c05',g:'rgba(255,200,70,.8)',s:[1.48,1.32,40]},
{id:8,n:'Street Bike',p:2500,m:'bike',c:'#ff5a1f',g:'rgba(255,100,30,.6)',s:[1.2,1.4,28],a:-25},
{id:9,n:'Cargo Hauler',p:4000,m:'truck',c:'#d9dde3',g:'rgba(200,220,255,.5)',s:[.95,.8,26],a:60},
{id:10,n:'Super Bike',p:9000,m:'bike',c:'#2f9bff',g:'rgba(50,160,255,.7)',s:[1.42,1.5,34],a:-25},
{id:11,n:'Monster Rig',p:15000,m:'truck',c:'#c0272d',g:'rgba(255,50,50,.65)',s:[1.15,.9,32],a:90}];
const PAL=['#e11d3a','#ff8a1f','#ffd21f','#5fe333','#18d6e8','#2f7bff','#a74edc','#f4f4f4','#2b303b'],HW={bike:1.1,truck:2.8};
const UP=id=>{const u=SV.up[id]=SV.up[id]||[];while(u.length<6)u.push(0);return u};
function applyV(){const d=VEH[SV.sel],u=UP(d.id);V={col:SV.paint[d.id]||d.c,model:d.m,str:d.str,glow:d.g,spd:d.s[0]*(1+u[0]*.04),hnd:d.s[1]*(1+u[1]*.06),nit:d.s[2]+u[2]*3,mg:u[4]*.4,inv:1.25+u[5]*.3,ax:d.m==='bike'?-.45:d.m==='truck'?.5:0,cn:10+Math.floor(lvl/25)};maxHP=Math.max(50,100+(d.a||0)+u[3]*10)}
applyV();
const THM=[{s:['#14265a','#5b5fae','#ef8b86','#ffc088','#ffe4b2'],m:['#a285b0','#6a5a93','#3d3a68'],h:'255,200,150',c1:'rgba(120,90,170,.35)',c2:'rgba(255,176,140,.5)'},
{s:['#2a7fd6','#5aa9ec','#9ed0f5','#cfe8f7','#f4f9fb'],m:['#8fb2cf','#6a91b0','#4a6f82'],h:'230,240,250',c1:'rgba(150,170,200,.3)',c2:'rgba(255,255,255,.6)',d:1},
{s:['#02040f','#07123a','#122552','#2b3d6e','#4a5886'],m:['#1b2650','#121a3d','#0a1029'],h:'80,100,170',c1:'rgba(40,50,100,.4)',c2:'rgba(90,110,180,.3)',n:1},
{s:['#2b2f6e','#7a5ea8','#e58aa0','#ffb88a','#ffe0b0'],m:['#b08ab8','#8a6ba0','#54457a'],h:'255,190,170',c1:'rgba(130,90,170,.35)',c2:'rgba(255,190,170,.5)'}];
const TH=()=>THM[Math.floor(((mode==='hub'?selLv:lvl)-1)/10)%4];
function mkTask(n){const t=n%4!==3?'coins':['pass','nitro','dist','clean'][Math.floor(n/4)%4],T={coins:Math.round(100+150*Math.sqrt(n-1)),pass:15+n,nitro:3+Math.floor(n*.35),dist:600+n*70,clean:500+n*45}[t];
 return{t,T,rw:100+n*25,tx:{dist:`Drive ${T} m`,coins:`Collect ${T} coins`,pass:`Overtake ${T} vehicles`,nitro:`Collect ${T} nitro canisters`,clean:`Drive ${T} m without getting hit`}[t]}}
function checkTask(){if(!task)return;
 if(endless){lvl=Math.min(100,1+Math.floor(distance/300));$('taskTxt').textContent=`ENDLESS • ${'♥'.repeat(lives)}${'♡'.repeat(3-lives)} • ${Math.floor(distance)} m • SPEED TIER ${lvl}`;$('taskFill').style.width=(distance%300)/3+'%';return}
 const v=Math.min(task.t==='coins'?coins:task.t==='pass'?passed:task.t==='nitro'?gN:distance,task.T);
 $('taskTxt').textContent=`LV ${lvl} · ${task.tx} · ${Math.floor(v)}/${task.T}`;$('taskFill').style.width=v/task.T*100+'%';if(v>=task.T&&mode==='run')end('win')}
// trucks & bikes
const steelG=(x0,x1)=>{const g=ctx.createLinearGradient(x0,0,x1,0);g.addColorStop(0,'#59616d');g.addColorStop(.35,'#e9eef4');g.addColorStop(.7,'#9aa4b0');g.addColorStop(1,'#444b56');return g};
function plateTxt(w,x,y,pw,ph,txt){if(!txt||w<46)return;ctx.save();ctx.fillStyle='#1b2430';ctx.font=`800 ${ph*.78}px 'Barlow Condensed',Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,x+pw/2,y+ph*.54,pw*.9);ctx.restore()}
function plateBox(w,x,y,pw,ph,txt){rr(x,y,pw,ph,ph*.14);ctx.fillStyle='#f4f1e4';ctx.fill();ctx.strokeStyle='#1b2430';ctx.lineWidth=Math.max(1,w*.006);ctx.stroke();plateTxt(w,x,y,pw,ph,txt)}
function rosette(x,y,r){const cols=['#ffd21f','#e11d3a','#18d6e8','#f4f4f4'];ctx.save();ctx.translate(x,y);ctx.fillStyle='#0f2a1a';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();
 for(let k=0;k<4;k++){const q=r*(1-k*.2);ctx.fillStyle=cols[k];for(let i=0;i<8;i++){const a=i/8*6.283+k*.4;ctx.beginPath();ctx.ellipse(Math.cos(a)*q*.58,Math.sin(a)*q*.58,q*.3,q*.17,a,0,7);ctx.fill()}}
 ctx.fillStyle='#e11d3a';ctx.beginPath();ctx.arc(0,0,r*.2,0,7);ctx.fill();ctx.restore()}
function truckRear(w,col,st,ph,blink,sg,bk){
 const art=!st||st.art,hh=.95*w,bb=-.2*w,t=bb-hh;let g;
 glow(0,0,w*.8,'rgba(255,30,40,.18)');
 // side mirrors
 for(const s of[-1,1]){ctx.fillStyle='#14171d';rr(s>0?.5*w:-.58*w,t+.18*w,.08*w,.26*w,.02*w);ctx.fill();g=ctx.createLinearGradient(0,t+.2*w,0,t+.42*w);g.addColorStop(0,'#7fb2d8');g.addColorStop(1,'#2c4560');ctx.fillStyle=g;rr(s>0?.512*w:-.568*w,t+.2*w,.056*w,.22*w,.012*w);ctx.fill()}
 // cargo box
 g=ctx.createLinearGradient(0,t,0,bb);g.addColorStop(0,sh(col,.45));g.addColorStop(.3,col);g.addColorStop(1,sh(col,-.5));rr(-.5*w,t,w,hh,.03*w);ctx.fillStyle=g;ctx.fill();
 ctx.lineWidth=Math.max(1,w*.006);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.beginPath();for(let i=-9;i<=9;i++){ctx.moveTo(i*.05*w,t+.03*w);ctx.lineTo(i*.05*w,bb-.03*w)}ctx.stroke();
 ctx.strokeStyle='rgba(0,0,0,.12)';ctx.beginPath();for(let i=-9;i<=9;i++){ctx.moveTo(i*.05*w+.006*w,t+.03*w);ctx.lineTo(i*.05*w+.006*w,bb-.03*w)}ctx.stroke();
 if(art){ // colourful truck-art panels
  const by=t+.05*w,bh=.075*w;g=ctx.createLinearGradient(0,by,0,by+bh);g.addColorStop(0,'#e11d3a');g.addColorStop(1,'#7d0f22');ctx.fillStyle=g;ctx.fillRect(-.47*w,by,.94*w,bh);
  for(let i=0;i<16;i++){const dx=-.44*w+i*.0585*w;poly([[dx,by+bh/2],[dx+.025*w,by+.012*w],[dx+.05*w,by+bh/2],[dx+.025*w,by+bh-.012*w]],i%2?'#ffd21f':'#f4f4f4')}
  const b2=bb-.2*w;[['#18a557',0],['#ffd21f',.022],['#e11d3a',.044]].forEach(([c,o])=>{ctx.fillStyle=c;ctx.fillRect(-.47*w,b2+o*w,.94*w,.02*w)});
  for(const s of[-1,1])rosette(s*.25*w,t+hh*.5+.03*w,.15*w);
  for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#ffd21f':'#18a557';ctx.fillRect(-.5*w,t+i*(hh/14),.03*w,hh/14);ctx.fillRect(.47*w,t+i*(hh/14),.03*w,hh/14)}
 }else{
  poly([[-.47*w,bb-.05*w],[.47*w,bb-.05*w],[.47*w,bb-.27*w],[-.47*w,bb-.17*w]],'rgba(255,255,255,.14)');
  if(w>60){ctx.save();ctx.fillStyle='rgba(255,255,255,.92)';ctx.font=`900 ${.17*w}px 'Barlow Condensed',Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((st&&st.brand)||'CARGO',0,t+hh*.4,.84*w);ctx.restore()}
 }
 g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'rgba(0,0,0,.4)');g.addColorStop(.3,'rgba(255,255,255,.1)');g.addColorStop(.7,'rgba(255,255,255,.04)');g.addColorStop(1,'rgba(0,0,0,.4)');rr(-.5*w,t,w,hh,.03*w);ctx.fillStyle=g;ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=Math.max(1,w*.008);ctx.beginPath();ctx.moveTo(-.48*w,t+.008*w);ctx.lineTo(.48*w,t+.008*w);ctx.stroke();
 // doors: seam, frame, locking rods, handles, hinges
 ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=Math.max(1,w*.014);ctx.beginPath();ctx.moveTo(0,t+.02*w);ctx.lineTo(0,bb-.02*w);ctx.stroke();
 ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=Math.max(1,w*.008);ctx.strokeRect(-.485*w,t+.015*w,.97*w,hh-.03*w);
 for(const rx of[-.4,-.1,.1,.4]){ctx.fillStyle=steelG(rx*w-.008*w,rx*w+.008*w);ctx.fillRect(rx*w-.008*w,t+.03*w,.016*w,hh-.06*w);ctx.fillStyle='#2a2f38';for(const f of[.08,.5,.9]){rr(rx*w-.022*w,t+hh*f-.012*w,.044*w,.026*w,.008*w);ctx.fill()}}
 ctx.fillStyle='#d3d8df';rr(-.075*w,t+hh*.5+.03*w,.05*w,.014*w,.006*w);ctx.fill();rr(.025*w,t+hh*.5+.03*w,.05*w,.014*w,.006*w);ctx.fill();
 ctx.fillStyle='#191c22';for(const s of[-1,1])for(const f of[.1,.5,.9])ctx.fillRect(s<0?-.5*w:.47*w,t+hh*f-.02*w,.03*w,.04*w);
 // top marker lights
 for(let i=0;i<5;i++){const mx=(i-2)*.2*w;ctx.fillStyle=i===2?'#ffb020':'#ff9a1a';ctx.beginPath();ctx.arc(mx,t+.024*w,.014*w,0,7);ctx.fill();glow(mx,t+.024*w,w*.07,'rgba(255,170,40,.9)',.8)}
 // reflective tape + rail
 for(let i=0;i<19;i++){ctx.fillStyle=i%2?'#e8e8e8':'#d6222e';ctx.fillRect(-.5*w+i*.0526*w,bb-.045*w,.0526*w,.022*w)}
 ctx.fillStyle=sh(col,-.65);ctx.fillRect(-.5*w,bb-.018*w,w,.018*w);
 // underbody + diff
 ctx.fillStyle='#12141a';ctx.fillRect(-.46*w,bb,.92*w,.1*w);
 g=ctx.createRadialGradient(0,bb+.06*w,.01*w,0,bb+.06*w,.12*w);g.addColorStop(0,'#3a424e');g.addColorStop(1,'#14171d');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,bb+.06*w,.1*w,.05*w,0,0,7);ctx.fill();
 // dual rear tyres with scrolling tread
 for(const s of[-1,1])for(let k=0;k<2;k++){const x0=s<0?-.5*w+k*.075*w:.36*w+k*.075*w;ctx.fillStyle='#0b0c10';rr(x0,bb,.065*w,-bb,.018*w);ctx.fill();
  ctx.save();rr(x0,bb,.065*w,-bb,.018*w);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=Math.max(1,w*.007);for(let i=-1;i<6;i++){const yy=bb+(i+ph)*.04*w;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+.065*w,yy+.012*w);ctx.stroke()}
  g=ctx.createLinearGradient(x0,0,x0+.065*w,0);g.addColorStop(0,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=g;ctx.fillRect(x0,bb,.065*w,-bb);ctx.restore()}
 // mud flaps
 for(const s of[-1,1]){ctx.fillStyle='#0d0e11';rr(s<0?-.5*w:.39*w,bb+.02*w,.11*w,.15*w,.012*w);ctx.fill();ctx.fillStyle='#e8e8e8';ctx.fillRect(s<0?-.46*w:.43*w,bb+.045*w,.03*w,.1*w)}
 // ICC underride bumper (red/white)
 g=ctx.createLinearGradient(0,bb,0,bb+.045*w);g.addColorStop(0,'#c9d0d8');g.addColorStop(1,'#59616d');rr(-.47*w,bb,.94*w,.045*w,.01*w);ctx.fillStyle=g;ctx.fill();
 ctx.save();rr(-.47*w,bb,.94*w,.045*w,.01*w);ctx.clip();for(let i=0;i<28;i++){ctx.fillStyle=i%2?'rgba(240,240,240,.85)':'rgba(214,34,46,.85)';ctx.fillRect(-.47*w+i*.0336*w,bb,.0168*w,.045*w)}ctx.restore();
 ctx.fillStyle='#14171d';ctx.fillRect(-.41*w,bb+.03*w,.02*w,.04*w);ctx.fillRect(.39*w,bb+.03*w,.02*w,.04*w);
 if(art){ctx.fillStyle='#d9b44a';for(let i=0;i<14;i++){ctx.beginPath();ctx.arc(-.42*w+i*.065*w,bb+.068*w+Math.sin(i*1.3+pT*4)*.006*w,.011*w,0,7);ctx.fill()}}
 // exhaust pipes
 for(const s of[-1,1]){const ex=s*.3*w,ey=bb+.095*w;g=ctx.createRadialGradient(ex-.008*w,ey-.008*w,0,ex,ey,.03*w);g.addColorStop(0,'#fff');g.addColorStop(.6,'#8d97a3');g.addColorStop(1,'#2a2f38');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ex,ey,.03*w,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.arc(ex,ey,.019*w,0,7);ctx.fill()}
 // number plate
 plateBox(w,-.12*w,-.34*w,.24*w,.075*w,(st&&st.plate)||'HR-3D');
 // tail-light clusters: brake / indicator / reverse
 for(const d of[-1,1]){const x0=d<0?-.5*w:.4*w,cl=x0+.05*w,on=sg===d&&blink;ctx.fillStyle='#0d0f14';rr(x0,-.5*w,.1*w,.21*w,.02*w);ctx.fill();
  ctx.fillStyle=bk?'#ff6a74':'#d81d2c';ctx.beginPath();ctx.arc(cl,-.455*w,.026*w,0,7);ctx.fill();glow(cl,-.455*w,w*(bk?.5:.32),'rgba(255,40,55,.9)',bk?1:.75);
  ctx.fillStyle=on?'#ffb020':'#6e4a10';ctx.beginPath();ctx.arc(cl,-.395*w,.026*w,0,7);ctx.fill();if(on)glow(cl,-.395*w,w*.38,'rgba(255,170,30,.95)');
  ctx.fillStyle='#8e969f';ctx.beginPath();ctx.arc(cl,-.335*w,.022*w,0,7);ctx.fill()}
}
function bikeRear(u,col,hero,st,ph,blink,sg,bk){
 let g;const lw=Math.max(1,u*.012);
 glow(0,-.4*u,u*.8,'rgba(255,40,50,.45)');
 // swingarm + axle nuts
 for(const s of[-1,1]){const x0=s<0?-.155*u:.105*u;g=ctx.createLinearGradient(x0,0,x0+.05*u,0);g.addColorStop(0,'#2b3038');g.addColorStop(.5,'#9aa4b2');g.addColorStop(1,'#2b3038');ctx.fillStyle=g;rr(x0,-.42*u,.05*u,.32*u,.02*u);ctx.fill();
  ctx.fillStyle='#cfd6df';ctx.beginPath();ctx.arc(s*.13*u,-.2*u,.022*u,0,7);ctx.fill();ctx.fillStyle='#333a44';ctx.beginPath();ctx.arc(s*.13*u,-.2*u,.01*u,0,7);ctx.fill()}
 // rear tyre with scrolling chevron tread
 g=ctx.createLinearGradient(-.1*u,0,.1*u,0);g.addColorStop(0,'#050608');g.addColorStop(.5,'#2a2e36');g.addColorStop(1,'#050608');rr(-.1*u,-.42*u,.2*u,.42*u,.09*u);ctx.fillStyle=g;ctx.fill();
 ctx.save();rr(-.1*u,-.42*u,.2*u,.42*u,.09*u);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=lw;for(let i=-1;i<8;i++){const yy=-.42*u+(i+ph)*.06*u;ctx.beginPath();ctx.moveTo(-.1*u,yy+.03*u);ctx.lineTo(0,yy);ctx.lineTo(.1*u,yy+.03*u);ctx.stroke()}ctx.restore();
 // hugger + plate
 poly([[-.12*u,-.42*u],[.12*u,-.42*u],[.1*u,-.5*u],[-.1*u,-.5*u]],'#10131a');
 ctx.fillStyle='#0b0d12';ctx.fillRect(-.012*u,-.5*u,.024*u,.07*u);
 plateBox(u,-.08*u,-.56*u,.16*u,.075*u,(st&&st.plate)||'HR-3D');
 // chrome muffler with heat bands + end cap
 g=ctx.createLinearGradient(.125*u,0,.215*u,0);g.addColorStop(0,'#5a626e');g.addColorStop(.35,'#f4f8ff');g.addColorStop(1,'#59616d');rr(.125*u,-.38*u,.09*u,.3*u,.045*u);ctx.fillStyle=g;ctx.fill();
 ctx.fillStyle='rgba(110,120,255,.35)';ctx.fillRect(.125*u,-.34*u,.09*u,.035*u);ctx.fillStyle='rgba(255,170,60,.28)';ctx.fillRect(.125*u,-.3*u,.09*u,.02*u);
 ctx.fillStyle='#8e98a6';ctx.beginPath();ctx.arc(.17*u,-.1*u,.04*u,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.arc(.17*u,-.1*u,.026*u,0,7);ctx.fill();
 // tail cowl
 g=ctx.createLinearGradient(0,-.8*u,0,-.5*u);g.addColorStop(0,sh(col,.4));g.addColorStop(1,sh(col,-.45));poly([[-.12*u,-.5*u],[.12*u,-.5*u],[.19*u,-.62*u],[.17*u,-.8*u],[-.17*u,-.8*u],[-.19*u,-.62*u]],g);
 ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(-.018*u,-.8*u,.036*u,.3*u);
 ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(-.18*u,-.66*u);ctx.lineTo(.18*u,-.66*u);ctx.stroke();
 poly([[-.15*u,-.78*u],[-.06*u,-.78*u],[-.09*u,-.55*u],[-.15*u,-.6*u]],'rgba(255,255,255,.2)');
 // LED tail light bar
 ctx.fillStyle='#220509';rr(-.14*u,-.74*u,.28*u,.05*u,.02*u);ctx.fill();ctx.fillStyle=bk?'#ff7a84':'#ff2b3a';rr(-.13*u,-.733*u,.26*u,.036*u,.015*u);ctx.fill();
 ctx.fillStyle='rgba(255,230,230,.8)';for(let i=0;i<7;i++){ctx.beginPath();ctx.arc((-.108+i*.036)*u,-.715*u,.006*u,0,7);ctx.fill()}
 glow(0,-.715*u,u*(bk?.55:.35),'rgba(255,40,55,.9)',bk?1:.85);
 // indicators
 for(const d of[-1,1]){const on=sg===d&&blink;ctx.fillStyle=on?'#ffb020':'#7a4a0c';rr(d<0?-.235*u:.2*u,-.66*u,.035*u,.03*u,.008*u);ctx.fill();if(on)glow(d*.218*u,-.645*u,u*.3,'rgba(255,170,30,.95)')}
 // seat
 ctx.fillStyle='#151820';rr(-.17*u,-.84*u,.34*u,.06*u,.03*u);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(-.12*u,-.82*u);ctx.lineTo(.12*u,-.82*u);ctx.stroke();
 // rider legs + boots
 for(const s of[-1,1]){const x0=s<0?-.31*u:.17*u;g=ctx.createLinearGradient(x0,0,x0+.14*u,0);g.addColorStop(0,'#0c1017');g.addColorStop(.45,'#2a3545');g.addColorStop(1,'#0c1017');ctx.fillStyle=g;rr(x0,-.9*u,.14*u,.38*u,.06*u);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x0+.07*u,-.88*u);ctx.lineTo(x0+.07*u,-.56*u);ctx.stroke();
  ctx.fillStyle='#08090c';rr(x0-.01*u,-.6*u,.16*u,.1*u,.03*u);ctx.fill();ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x0+.01*u,-.6*u,.02*u,.07*u);ctx.fillStyle=col;ctx.fillRect(x0+.03*u,-.53*u,.1*u,.012*u)}
 // arms, handlebar, gloves, mirrors
 ctx.lineCap='round';
 for(const s of[-1,1]){ctx.strokeStyle='#1e2735';ctx.lineWidth=u*.12;ctx.beginPath();ctx.moveTo(s*.25*u,-1*u);ctx.lineTo(s*.46*u,-.8*u);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=u*.025;ctx.beginPath();ctx.moveTo(s*.24*u,-1.04*u);ctx.lineTo(s*.44*u,-.84*u);ctx.stroke();
  ctx.strokeStyle='#1a1d24';ctx.lineWidth=u*.03;ctx.beginPath();ctx.moveTo(s*.4*u,-.8*u);ctx.lineTo(s*.56*u,-.8*u);ctx.stroke();
  g=ctx.createRadialGradient(s*.47*u-.015*u,-.82*u,0,s*.47*u,-.8*u,.07*u);g.addColorStop(0,'#4a5565');g.addColorStop(1,'#0c0e12');ctx.fillStyle=g;rr(s*.47*u-.055*u,-.85*u,.11*u,.1*u,.04*u);ctx.fill();ctx.fillStyle=col;ctx.fillRect(s*.47*u-.04*u,-.86*u,.08*u,.012*u);
  ctx.strokeStyle='#444b56';ctx.lineWidth=u*.015;ctx.beginPath();ctx.moveTo(s*.44*u,-.85*u);ctx.lineTo(s*.5*u,-1.04*u);ctx.stroke();
  ctx.fillStyle='#1c2028';rr(s*.5*u-.065*u,-1.1*u,.13*u,.075*u,.03*u);ctx.fill();g=ctx.createLinearGradient(0,-1.1*u,0,-1.03*u);g.addColorStop(0,'#9ecbe8');g.addColorStop(1,'#3b5870');ctx.fillStyle=g;rr(s*.5*u-.05*u,-1.092*u,.1*u,.058*u,.022*u);ctx.fill()}
 // jacket torso
 g=ctx.createLinearGradient(-.28*u,0,.28*u,0);g.addColorStop(0,'#0e131c');g.addColorStop(.4,'#3c4a60');g.addColorStop(1,'#0e131c');rr(-.28*u,-1.14*u,.56*u,.6*u,.2*u);ctx.fillStyle=g;ctx.fill();
 for(const s of[-1,1]){g=ctx.createRadialGradient(s*.24*u-.02*u,-1.06*u,0,s*.24*u,-1.04*u,.1*u);g.addColorStop(0,sh(col,.5));g.addColorStop(1,sh(col,-.4));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(s*.24*u,-1.04*u,.09*u,.075*u,0,0,7);ctx.fill()}
 ctx.fillStyle='rgba(0,0,0,.35)';for(let i=0;i<5;i++){rr(-.022*u,-1.06*u+i*.07*u,.044*u,.055*u,.014*u);ctx.fill()}ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(-.008*u,-1.06*u,.016*u,.33*u);
 ctx.fillStyle=col;ctx.fillRect(-.28*u,-.86*u,.56*u,.045*u);ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(-.28*u,-.8*u,.56*u,.02*u);
 ctx.fillStyle='#0b0d12';ctx.fillRect(-.22*u,-.64*u,.44*u,.035*u);
 // helmet
 ctx.fillStyle='#0a0c10';ctx.beginPath();ctx.ellipse(0,-1.13*u,.17*u,.05*u,0,0,7);ctx.fill();
 const hg=ctx.createRadialGradient(-.06*u,-1.3*u,.01*u,0,-1.24*u,.2*u);hg.addColorStop(0,sh(col,.7));hg.addColorStop(.6,col);hg.addColorStop(1,sh(col,-.5));ctx.fillStyle=hg;ctx.beginPath();ctx.arc(0,-1.26*u,.19*u,0,7);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(0,-1.26*u,.19*u,0,7);ctx.clip();ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(-.028*u,-1.5*u,.056*u,.5*u);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(-.045*u,-1.5*u,.012*u,.5*u);ctx.fillRect(.033*u,-1.5*u,.012*u,.5*u);
 g=ctx.createLinearGradient(0,-1.45*u,0,-1.07*u);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.4)');ctx.fillStyle=g;ctx.fillRect(-.2*u,-1.45*u,.4*u,.4*u);ctx.restore();
 ctx.fillStyle='rgba(8,10,14,.85)';for(let i=0;i<3;i++){rr(-.065*u,-1.2*u+i*.03*u,.13*u,.016*u,.007*u);ctx.fill()}
 poly([[-.1*u,-1.14*u],[.1*u,-1.14*u],[.075*u,-1.095*u],[-.075*u,-1.095*u]],'#0b0d12');
 ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(-.07*u,-1.34*u,.05*u,.025*u,-.5,0,7);ctx.fill();
}
function big(x,y,w,col,type,al,hero,st){
 const blink=Math.floor(pT*3.6)%2===0,sg=st?st.sig:0,bk=!!(st&&st.bk),ph=(((st&&st.ph!==undefined)?st.ph:travel*.5)%1+1)%1;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=al;ctx.fillStyle='rgba(8,6,20,.55)';ctx.beginPath();ctx.ellipse(0,0,w*.6,w*.07,0,0,7);ctx.fill();
 if(type==='truck')truckRear(w,col,st,ph,blink,sg,bk);else bikeRear(w,col,hero,st,ph,blink,sg,bk);
 if(hero){if(boost){const xs=type==='truck'?[-.3*w,.3*w]:[.17*w],yy=-.1*w,sc=type==='truck'?1:1.3;for(const ex of xs){const L=w*(.35+.25*Math.random())*sc;poly([[ex-.05*w,yy],[ex+.05*w,yy],[ex,yy+L]],'rgba(70,190,255,.85)');glow(ex,yy+.1*w,w*.4,'rgba(60,170,255,.9)')}}glow(0,0,w*.8,V.glow,.5)}
 ctx.restore()}
// showroom (hub)
function showroom(){const d=VEH[prev],mob=W<700,s=mob?Math.min(W*.62,H*.4):Math.min(W*.4,H*.62),x=mob?W*.5:W*.27,y=mob?H*.34:H*.8,k=V,kb=boost;
 const pc=SV.paint[d.id]||d.c;V={col:pc,str:d.str,glow:d.g};boost=false;
 const rw=s*.8,rh=s*.16,py=y+rh*.3;let g;
 // spotlight cone
 ctx.save();g=ctx.createLinearGradient(0,y-s*1.7,0,y);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.13)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-s*.1,y-s*1.7);ctx.lineTo(x+s*.1,y-s*1.7);ctx.lineTo(x+rw,py);ctx.lineTo(x-rw,py);ctx.closePath();ctx.fill();ctx.restore();
 // turntable
 ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(x,py+rh*.35,rw*1.04,rh*1.05,0,0,7);ctx.fill();
 g=ctx.createLinearGradient(0,py-rh,0,py+rh);g.addColorStop(0,'#2b4a70');g.addColorStop(1,'#0b1730');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,py,rw,rh,0,0,7);ctx.fill();
 ctx.strokeStyle=d.g;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,py,rw*.96,rh*.94,0,0,7);ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,py,rw*.7,rh*.68,0,0,7);ctx.stroke();
 for(let i=0;i<28;i++){const a=pT*.7+i/28*6.283,px=x+Math.cos(a)*rw*.83,qy=py+Math.sin(a)*rh*.8,l=.5+.5*Math.sin(a*2-pT*3);ctx.fillStyle=`rgba(255,255,255,${.15+l*.6})`;ctx.fillRect(px-1.5,qy-1.5,3,3)}
 glow(x,py,s*.95,d.g,.55);
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(pT*.8)*.03);ctx.translate(-x,-y);car(x,y,s*(HW[d.m]||2.1)/2.1*(d.m==='truck'?.68:1),pc,d.m,true,1);ctx.restore();
 V=k;boost=kb}
function showName(){const d=VEH[prev],mob=W<700;if(mob)return;const x=W*.27,own=SV.own.includes(d.id),ty=H*.13;ctx.save();ctx.textAlign='center';ctx.textBaseline='alphabetic';
 ctx.fillStyle='#fff';ctx.shadowColor='rgba(5,12,30,.8)';ctx.shadowBlur=16;ctx.font=`900 ${Math.min(58,W*.042)}px 'Barlow Condensed',Impact,sans-serif`;try{ctx.letterSpacing='2px'}catch(e){}ctx.fillText(d.n.toUpperCase(),x,ty);
 ctx.shadowBlur=8;ctx.font=`800 12px 'DM Sans',sans-serif`;try{ctx.letterSpacing='3px'}catch(e){}ctx.fillStyle='#6ff0ef';
 ctx.fillText((d.m==='bike'?'SUPERBIKE':d.m==='truck'?'HEAVY TRUCK':'SPORTS CAR')+'  •  '+(own?(SV.sel===d.id?'EQUIPPED':'OWNED'):'LOCKED'),x,ty+24);ctx.restore()}
// hub UI
const $b=$('tabBody'),upCost=(i,u)=>Math.round(200*(u[i]+1)*(1+SV.sel*.5));
const UI=['⚙️','🎯','⚡','🛡️','🧲','🔰'],TI={coins:'✦',pass:'🏁',nitro:'⚡',dist:'🛣️',clean:'🛡️'};
function renderHub(){$('wallet').textContent=SV.coins.toLocaleString();document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
 if(tab==='play'){const seg=`<div class="seg"><button data-m="journey"${endless?'':' class="on"'}>JOURNEY</button><button data-m="endless"${endless?' class="on"':''}>ENDLESS</button></div>`;
  if(endless)$b.innerHTML=seg+`<div class="task-card"><small>ENDLESS MODE</small><h3>3 lives • speed never stops rising</h3><p>Drive as far as you can. When health hits zero you lose a life and respawn with full health. Lose all 3 and the run ends. Best: ${SV.endBest||0} m • coins you collect are yours to keep.</p></div><button class="play-btn" id="goBtn">START ENDLESS →</button>`;
  else{const k=mkTask(selLv);$b.innerHTML=seg+`<div class="lvgrid">${Array.from({length:100},(_,i)=>{const n=i+1,c=n>SV.unlocked?'lock':n<SV.unlocked?'done':'';return`<button data-l="${n}" class="${c} ${n===selLv?'sel':''}">${n>SV.unlocked?'🔒':n}</button>`}).join('')}</div><div class="task-card"><small>LEVEL ${selLv} TASK</small><h3><span class="ti">${TI[k.t]}</span>${k.tx}</h3><p>Reward ✦ ${k.rw} • complete it to unlock the next level</p></div><button class="play-btn" id="goBtn">START LEVEL ${selLv} →</button>`}}
 else if(tab==='veh'){const bar=(x,a,b)=>`<i><b style="width:${Math.round(clamp((x-a)/(b-a),.05,1)*100)}%"></b></i>`;
  $b.innerHTML='<p class="hint">Bars: speed • handling • nitro. Buy with coins from your runs.</p>'+VEH.map(v=>{const o=SV.own.includes(v.id);return`<div class="vc${v.id===prev?' sel':''}${o?'':' locked'}" data-v="${v.id}"><span class="sw" style="background:linear-gradient(145deg,${v.c},${v.c}99)">${v.m==='bike'?'🏍':v.m==='truck'?'🚚':'🏎'}</span><div class="vi"><b>${v.n}</b> <small>${v.m==='bike'?'BIKE':v.m==='truck'?'TRUCK':'CAR'}</small><div class="bars"><div class="sr"><em>SPD</em>${bar(v.s[0],.9,1.5)}</div><div class="sr"><em>HND</em>${bar(v.s[1],.9,1.35)}</div><div class="sr"><em>NOS</em>${bar(v.s[2],20,40)}</div></div></div>${o?(SV.sel===v.id?'<button disabled>EQUIPPED</button>':`<button data-s="${v.id}">EQUIP</button>`):`<button data-b="${v.id}"${SV.coins<v.p?' disabled':''}>✦ ${v.p.toLocaleString()}</button>`}</div>`}).join('')}
 else{const d=VEH[SV.sel],u=UP(d.id),pw=SV.pown[d.id]=SV.pown[d.id]||[],cur=SV.paint[d.id]||d.c;$b.innerHTML=`<div class="uphead">${d.n}</div><p class="hint">PAINT • ✦150 per new color (owned colors are free)</p><div class="pal">${PAL.map(c=>`<button class="pc${c===cur?' on':''}" data-p="${c}" style="background:${c}"${c!==cur&&c!==d.c&&!pw.includes(c)&&SV.coins<150?' disabled':''}></button>`).join('')}</div>`+['ENGINE • top speed','HANDLING • steering','NITRO • charge per canister','ARMOR • max health','MAGNET • coin pickup range','SHIELD • longer protection after a hit'].map((n,i)=>{const c=upCost(i,u);return`<div class="ur"><div class="ic">${UI[i]}</div><div class="tx"><b>${n.split(' • ')[0]}</b><small>${n.split(' • ')[1]}</small><div class="pips">${[0,1,2,3,4].map(q=>`<u class="${q<u[i]?'f':''}"></u>`).join('')}</div></div><button data-u="${i}"${u[i]>=5||SV.coins<c?' disabled':''}>${u[i]>=5?'MAX':'✦ '+c}</button></div>`}).join('')}}
$b.onclick=e=>{const t=e.target.closest('[data-m],[data-p],[data-b],[data-s],[data-u],[data-l],[data-v],#goBtn');if(!t)return;resumeAudio();SFX.click();const d=t.dataset;
 if(t.id==='goBtn'){lvl=endless?1:selLv;start();return}
 if(d.m!==undefined)endless=d.m==='endless';
 else if(d.p!==undefined){const id=SV.sel,pw=SV.pown[id]=SV.pown[id]||[];if(pw.includes(d.p)||d.p===VEH[id].c||SV.coins>=150){if(!pw.includes(d.p)&&d.p!==VEH[id].c){SV.coins-=150;pw.push(d.p)}SV.paint[id]=d.p}}
 else if(d.b!==undefined){const v=VEH[+d.b];if(SV.coins>=v.p){SV.coins-=v.p;SV.own.push(v.id);SV.sel=prev=v.id}}
 else if(d.s!==undefined)SV.sel=prev=+d.s;
 else if(d.u!==undefined){const i=+d.u,u=UP(SV.sel),c=upCost(i,u);if(u[i]<5&&SV.coins>=c){SV.coins-=c;u[i]++}}
 else if(d.l!==undefined){if(+d.l<=SV.unlocked)selLv=+d.l}
 else if(d.v!==undefined)prev=+d.v;
 saveSV();applyV();renderHub()};
document.querySelector('.tabs').onclick=e=>{const t=e.target.dataset.t;if(t){tab=t;prev=SV.sel;renderHub()}};
function openHub(){updateEngine(0,false,false);root.classList.add('in-hub');mode='hub';objects=[];sparks=[];boost=false;playerX=0;selLv=Math.min(selLv,SV.unlocked);prev=SV.sel;$('overlay').classList.add('hidden');$('taskHud').style.display='none';$('hub').classList.remove('hidden');renderHub()}
$('nextBtn').onclick=()=>{lvl=Math.min(100,lvl+1);selLv=lvl;start()};$('menuBtn').onclick=openHub;
function updateHUD(force=false){if(!force&&hudElapsed<.08)return;hudElapsed=0; $('distance').innerHTML=String(Math.floor(distance)).padStart(5,'0')+' <small>m</small>';$('coins').textContent='✦ '+coins;$('speed').textContent=String(Math.round((118+lvl*.47+Math.min(189,time*1.42))*V.spd+(boost?95:0)));$('healthVal').textContent=Math.round(health/maxHP*100)+'%';$('healthFill').style.width=health/maxHP*100+'%';$('nitroVal').textContent=Math.round(nitro)+'%';$('nitroFill').style.width=nitro+'%';const full=nitro>=100;$('nitroState').textContent=boost?'BOOST':full?'FULL':'CHARGING';$('nitroHint').textContent=full?'READY — PRESS NITRO':'COLLECT BLUE CANISTERS';$('nitroBtn').classList.toggle('ready',full)}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');toastLeft=.7}
function start(){resumeAudio();SFX.start();root.classList.remove('in-hub');if(endless)lvl=1;lives=3;task=endless?{t:'endless',T:1e9,rw:0,tx:'Endless run'}:mkTask(lvl);passed=gN=hits=0;applyV();$('hub').classList.add('hidden');$('taskHud').style.display='block';$('nextBtn').style.display='none';mode='run';time=0;travel=0;distance=0;coins=0;health=maxHP;nitro=0;boost=false;playerX=0;velocity=0;keyLeft=false;keyRight=false;objects=[];sparks=[];skidMarks=[];spawnT=2;coinT=.2;addCoinTrail(2,-22,13);invincible=0;flash=0;steerInput=0;camSmooth=0;$('overlay').classList.add('hidden');updateHUD(true)}
function end(why){
 const won=why==='win';mode='over';boost=false;updateEngine(0,false,false);won?SFX.win():SFX.lose();const d=Math.floor(distance);let rw=0;
 if(d>best){best=d;try{localStorage.setItem('highway-rush-3d-best',String(best))}catch(e){}}
 if(won){rw=task.rw;if(lvl===SV.unlocked&&lvl<100)SV.unlocked++}
 if(endless&&d>(SV.endBest||0))SV.endBest=d;SV.coins+=coins+rw;saveSV();
 $('best').innerHTML=String(best).padStart(5,'0')+' <small>m</small>';
 $('menuTag').textContent=won?'LEVEL '+lvl+' COMPLETE':why==='clean'?'TASK FAILED — YOU GOT HIT':(endless?'OUT OF LIVES':'CRASHED OUT');
 $('menuTitle').innerHTML=won?'LEVEL<br><em>CLEARED</em>':'GAME<br><em>OVER</em>';
 $('menuText').innerHTML=`Distance <b>${d}m</b> • Coins <b>✦${coins}</b>${won?` • Bonus <b>✦${rw}</b>`:''}<br>${endless?'Best endless: '+Math.max(SV.endBest||0,d)+' m':'Task: '+task.tx}`;
 $('playBtn').textContent=won?'REPLAY LEVEL →':'RETRY →';$('nextBtn').style.display=won&&lvl<100?'':'none';$('overlay').classList.remove('hidden')}
const TM={sedan:[1.75,1.76,2.65],suv:[1.85,1.82,2.7],sport:[1.75,1.76,2.6],truck:[2.4,2.1,4.2],bike:[.9,1.3,1.8]},CC=['#de4234','#efb83f','#4777f0','#a74edc','#ee8097','#31b2aa','#d4e0ec','#f27d2a'];
const NSP={sedan:[.30,.44],suv:[.26,.38],sport:[.44,.58],truck:[.14,.27],bike:[.40,.54]},NWV={sedan:.30,suv:.22,sport:.45,truck:.10,bike:.50},CITY=['KHI','LHR','ISB','PSH','QTA','MUX'],BRAND=['CARGO','SPEEDEX','TRANS-PK','HAULER','NOOR'];
function mk(lane,z){const r=Math.random(),model=r<.28?'sedan':r<.43?'suv':r<.58?'sport':r<.8?'truck':'bike',t=TM[model],s=R(NSP[model][0],NSP[model][1]);
 objects.push({id:++itemId,kind:'car',x:(lane-2)*2.83,z,color:CC[Math.floor(R(0,CC.length))],model,hx:t[1],hz:t[2],done:false,
  lane,tl:lane,tx:(lane-2)*2.83,sp0:s,sp:s,ph:Math.random(),lean:0,vx:0,sig:0,sigT:0,sigOff:0,cd:R(.2,1.2),wv:NWV[model]*(1+lvl*.01),bk:false,bkp:false,
  art:Math.random()<.6,pax:Math.random()<.3,plate:CITY[Math.floor(R(0,CITY.length))]+'-'+(10+Math.floor(R(0,90))),brand:BRAND[Math.floor(R(0,BRAND.length))]})}
// NPC traffic: own speed, keeps distance to the car ahead, signals then changes lanes
function npcAI(o,dt,base){
 let tg=o.sp0,br=false;
 for(const q of objects){if(q===o||q.kind!=='car'||q.done||q.z>=o.z||Math.abs(q.x-o.x)>2.1)continue;const d=o.z-q.z,th=(o.hz+q.hz)*1.1+3;
  if(d<th){tg=Math.min(tg,Math.max(.08,q.sp-.04));if(d<th*.8)br=true}}
 o.sp+=(tg-o.sp)*Math.min(1,dt*3);
 o.ph+=o.sp*base*dt*.55;
 const dx=o.tx-o.x;
 if(Math.abs(dx)>.01){const sp=o.model==='bike'?3.4:o.model==='truck'?1.7:2.5,mv=Math.sign(dx)*Math.min(Math.abs(dx),sp*dt);o.x+=mv;o.vx=mv/Math.max(dt,.001)}else{o.x=o.tx;o.vx=0}
 o.lean+=((o.vx||0)*(o.model==='bike'?.075:.04)-o.lean)*Math.min(1,dt*7);
 if(o.sigT>0){o.sigT-=dt;if(o.sigT<=0){o.lane=o.tl;o.tx=(o.tl-2)*2.83;o.sigOff=.7}}
 else{
  if(o.sigOff>0){o.sigOff-=dt;if(o.sigOff<=0)o.sig=0}
  o.cd-=dt;
  if(o.cd<=0){o.cd=R(.5,.9);
   if(!o.sig&&o.z>-168&&o.z<-95&&Math.random()<o.wv){const d=Math.random()<.5?-1:1,nl=o.lane+d;
    if(nl>=0&&nl<=4&&!objects.some(q=>q!==o&&q.kind==='car'&&!q.done&&(q.tl===nl||q.lane===nl)&&Math.abs(q.z-o.z)<22)){o.sig=d;o.sigT=.9;o.tl=nl;o.bkp=Math.random()<.6}}}}
 o.bk=br||(o.sigT>0&&o.bkp);
}
function spawn(){const lane=Math.floor(R(0,5));mk(lane,-175);if(Math.random()<.35+Math.min(.3,lvl*.004))mk((lane+1+Math.floor(R(0,4)))%5,-193)}
// More collectible trails; hazards have their own capped probability at every level.
function addCoinTrail(lane,z,count=10){
 for(let i=0;i<count;i++)objects.push({id:++itemId,kind:'coin',x:(lane-2)*2.83,z:z-i*5.4,done:false});
}
function spawnPickups(){
 const available=[0,1,2,3,4].filter(l=>!objects.some(o=>o.kind==='car'&&!o.done&&Math.abs(o.x-(l-2)*2.83)<1.4&&o.z>-195&&o.z<-115));
 const lanes=available.length?available:[0,1,2,3,4];const lane=lanes[Math.floor(R(0,lanes.length))];
 addCoinTrail(lane,-145,V.cn);
 if(Math.random()<.55&&lanes.length>1){const others=lanes.filter(l=>l!==lane);addCoinTrail(others[Math.floor(R(0,others.length))],-163,7)}
 const r=Math.random();if(r<.52){const itemLane=Math.floor(R(0,5));const kind=r<.12?'bomb':r<.23&&health<maxHP?'heal':'nitro';objects.push({id:++itemId,kind,x:(itemLane-2)*2.83,z:-156,done:false})}
}
function update(dt){hudElapsed+=dt;taskElapsed+=dt;if(mode!=='run')return;time+=dt;invincible=Math.max(0,invincible-dt);
 // analog steering: buttons = full, touch drag = proportional
 let steer=(keyRight?1:0)-(keyLeft?1:0);if(Math.abs(steerInput)>Math.abs(steer))steer=steerInput;
 const maxV=8.2*V.hnd,acc=22*V.hnd;
 if(Math.abs(steer)>.02){velocity+=steer*acc*dt;if(Math.abs(velocity)>3.5&&Math.abs(steer)>.6&&skidMarks.length<256&&Math.random()<.08)skidMarks.push({x:playerX+R(-.15,.15),z:2.6,a:.35})}
 else velocity*=Math.exp(-7.5*dt);
 velocity=clamp(velocity,-maxV,maxV);playerX=clamp(playerX+velocity*dt,-5.55,5.55);
 if(Math.abs(playerX)>=5.55){velocity*=.3;playerX=clamp(playerX,-5.55,5.55)}
const base=(25+lvl*.1+Math.min(40,time*.3))*V.spd,speed=base+(boost?27:0); travel+=speed*dt;distance+=speed*dt*.75;if(boost){nitro=Math.max(0,nitro-29*dt);if(nitro<=0)boost=false}
spawnT-=dt;coinT-=dt;if(spawnT<=0){spawn();spawnT=Math.max(.45,1.9-time*.008-lvl*.01)}if(coinT<=0){spawnPickups();coinT=R(.85,1.15)}
for(const o of objects){if(o.kind==='car'&&!o.done)npcAI(o,dt,base);o.z+=(o.kind==='car'?speed-o.sp*base:speed)*dt;if(o.done)continue;if(o.kind==='car'&&o.z>5&&!o.ps){o.ps=1;passed++;if(Math.random()<.35)SFX.pass()}const dz=Math.abs(o.z-3),dx=Math.abs(o.x-playerX);if(dz<(o.hz||2)&&dx<(o.hx?o.hx+V.ax:1.35+(o.kind==='coin'?V.mg:0))){
o.done=true;if(o.kind==='car'||o.kind==='bomb'){if(invincible<=0){health=Math.max(0,health-25);invincible=V.inv;flash=.28;toast('-25 HEALTH');hits++;(o.kind==='bomb'?SFX.bomb:SFX.hit)();fx(pr(playerX,3)[0],pr(playerX,3)[1],18,'debris',280);if(task.t==='clean'){end('clean');break}if(health<=0){if(endless&&lives>1){lives--;health=maxHP;invincible=2.5;toast('LIFE LOST • '+lives+' LEFT');for(const q of objects)if(q.kind==='car'&&q.z>-70)q.done=true}else{end();break}}}}else if(o.kind==='coin'){coins++;distance+=8;toast('✦ +1 COIN');SFX.coin()}else if(o.kind==='heal'){health=Math.min(maxHP,health+25);toast('♥ +25 HEALTH');SFX.heal()}else{const was=nitro;nitro=Math.min(100,nitro+V.nit);gN++;toast(nitro>=100?'⚡ NITRO READY':'+'+V.nit+' NITRO');SFX.nitro();if(was<100&&nitro>=100)SFX.ready()}}}
objects=objects.filter(o=>!o.done&&o.z<18);if(toastLeft>0){toastLeft-=dt;if(toastLeft<=0)$('toast').classList.remove('show')}flash=Math.max(0,flash-dt);if(taskElapsed>=.08){checkTask();taskElapsed=0}updateHUD();const spdN=clamp((25+lvl*.1+Math.min(40,time*.3))*V.spd/70,0,1.4);updateEngine(spdN+(boost?.3:0),boost,true)}
function frame(t){const elapsed=clamp((t-last)/1000||0,0,.12);last=t;if(document.hidden){simulationDebt=0;requestAnimationFrame(frame);return}simulationDebt+=elapsed;let steps=0;while(simulationDebt>=1/60&&steps<8){update(1/60);simulationDebt-=1/60;steps++}const interval=mode==='pause'?100:mode==='hub'?1000/30:1000/60;if(t-lastDrawTime>=interval-.5){draw();lastDrawTime=t}requestAnimationFrame(frame)}
 document.addEventListener('visibilitychange',()=>{last=performance.now();pT0=last;simulationDebt=0;if(document.hidden&&mode==='run')$('pauseBtn').click()});
$('playBtn').onclick=()=>{if(mode==='pause'){$('overlay').classList.add('hidden');mode='run'}else start()};$('pauseBtn').onclick=()=>{if(mode==='run'){mode='pause';boost=false;updateEngine(0,false,false);$('menuTag').textContent='TAKE A BREAK';$('menuTitle').innerHTML='RACE<br><em>PAUSED</em>';$('menuText').textContent='Your highway is waiting';$('playBtn').textContent='RESUME RACE →';$('overlay').classList.remove('hidden')}else if(mode==='pause'){$('overlay').classList.add('hidden');mode='run'}};
function hold(id,on,off){let el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);on();el.classList.add('pressed')});const stop=()=>{off();el.classList.remove('pressed')};['pointerup','pointercancel','lostpointercapture'].forEach(event=>el.addEventListener(event,stop))}
function nitroStart(){if(mode!=='run')return;if(nitro>=100||boost){if(!boost)SFX.boostOn();boost=true}else toast('COLLECT NITRO FIRST')}
hold('leftBtn',()=>{keyLeft=true;steerInput=-1},()=>{keyLeft=false;if(!keyRight)steerInput=0});hold('rightBtn',()=>{keyRight=true;steerInput=1},()=>{keyRight=false;if(!keyLeft)steerInput=0});hold('nitroBtn',nitroStart,()=>boost=false);
window.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if(['arrowleft','arrowright',' ','arrowup','a','d'].includes(k)&&mode==='run')e.preventDefault();if(k==='arrowleft'||k==='a'){keyLeft=true;steerInput=-1}if(k==='arrowright'||k==='d'){keyRight=true;steerInput=1}if((k===' '||k==='arrowup')&&!e.repeat)nitroStart();if(k==='p'&&!e.repeat)$('pauseBtn').click();if(k==='enter'&&!e.repeat&&mode!=='run'&&mode!=='hub')$('playBtn').click()});window.addEventListener('keyup',e=>{let k=e.key.toLowerCase();if(k==='arrowleft'||k==='a'){keyLeft=false;if(!keyRight)steerInput=0}if(k==='arrowright'||k==='d'){keyRight=false;if(!keyLeft)steerInput=0}if(k===' '||k==='arrowup')boost=false});window.addEventListener('blur',()=>{boost=false;keyLeft=false;keyRight=false;steerInput=0});let initial=null;canvas.addEventListener('pointerdown',e=>{if(mode!=='run')return;initial=e.clientX;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(initial===null)return;const diff=e.clientX-initial;steerInput=clamp(diff/(W*.22),-1,1);keyLeft=steerInput<-.15;keyRight=steerInput>.15});['pointerup','pointercancel'].forEach(x=>canvas.addEventListener(x,()=>{initial=null;keyLeft=false;keyRight=false;steerInput=0}));$('muteBtn').onclick=()=>{resumeAudio();muted=!muted;$('muteBtn').textContent=muted?'🔇':'🔊';if(muted){updateEngine(0,false,false);if(masterGain)masterGain.gain.value=0}else if(masterGain)masterGain.gain.value=.45};
updateHUD();openHub();
const loading=document.createElement('div');loading.className='asset-loading';loading.textContent='LOADING APEX GT + 4 TREE MODELS…';root.append(loading);
try{
 world3D=await window.createHighwayWorld(root,window.HIGHWAY_ASSETS);
 loading.remove();saveSV();
 const modelName=document.createElement('div');modelName.id='modelName';root.append(modelName);
 const route=document.createElement('div');route.className='route-label';route.textContent='WINDING HIGHWAY • 4 TREE SPECIES';root.append(route);
 // Read-only runtime snapshot for diagnostics and game verification.
 window.highwayDebug={snapshot:()=>({mode,travel,distance,playerX,coins,health,nitro,selected:VEH[SV.sel].n,coinObjects:objects.filter(o=>o.kind==='coin').length,trees:world3D.stats.trees,treeSpecies:world3D.stats.treeSpecies,render:{...world3D.stats},roadOffsets:[-40,-100,-160].map(z=>world3D.offset(z))})};
 last=performance.now();requestAnimationFrame(frame);
}catch(error){console.error('3D assets failed',error);loading.textContent='3D could not start. Please enable WebGL / hardware acceleration and reopen index.html.';loading.classList.add('failed')}

['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,()=>{resumeAudio()}, {once:true}));
})();
