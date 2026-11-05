/* chess_core.js — قوانين الشطرنج الكاملة + لوحة ثابتة واقعية. يتحمّل بعد chess_engine.js ويعرّف window.CH2 */
(()=>{
const O=(typeof CH!=='undefined'&&CH)||{};
const F='abcdefgh',START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const N=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]],D=[[1,1],[1,-1],[-1,1],[-1,-1]],R=[[1,0],[-1,0],[0,1],[0,-1]],DR=D.concat(R);
const G={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const THEMES=[['green','#EEEED2','#769656'],['brown','#F0D9B5','#B58863'],['blue','#DEE3E6','#8CA2AD'],['gray','#E8E8E8','#9A9A9A'],['purple','#EFE6F5','#8F6BAE']];
const isW=p=>!!p&&p>='A'&&p<='Z',idx=s=>(8-s[1])*8+F.indexOf(s[0]),sq=i=>F[i&7]+(8-(i>>3));
const key=S=>S.b.map(p=>p||'1').join('')+S.turn+S.c+S.ep;
const uci=m=>sq(m.f)+sq(m.t)+(m.p||'');

function fromFEN(s){const[p,t,c,e,h,m]=s.trim().split(/\s+/),b=[];
 for(const ch of p.replace(/\//g,''))if(ch>='1'&&ch<='8')for(let k=0;k<+ch;k++)b.push('');else b.push(ch);
 const S={b,turn:t||'w',c:c&&c!=='-'?c:'',ep:e&&e!=='-'?idx(e):-1,hm:+h||0,fm:+m||1};S.h=[key(S)];return S}
function toFEN(S){const o=[];for(let r=0;r<8;r++){let s='',n=0;for(let f=0;f<8;f++){const p=S.b[r*8+f];if(p){if(n){s+=n;n=0}s+=p}else n++}if(n)s+=n;o.push(s)}
 return o.join('/')+' '+S.turn+' '+(S.c||'-')+' '+(S.ep<0?'-':sq(S.ep))+' '+S.hm+' '+S.fm}

function att(b,i,by){const w=by==='w',r=i>>3,f=i&7,g=(rr,ff)=>rr<0||rr>7||ff<0||ff>7?undefined:b[rr*8+ff],c=x=>w?x:x.toLowerCase();
 for(const d of[-1,1])if(g(r+(w?1:-1),f+d)===c('P'))return 1;
 for(const[x,y]of N)if(g(r+y,f+x)===c('N'))return 1;
 for(const[x,y]of DR){if(g(r+y,f+x)===c('K'))return 1;
  for(let k=1,p;(p=g(r+y*k,f+x*k))!==undefined;k++)if(p){if(p===c('Q')||p===c(x&&y?'B':'R'))return 1;break}}
 return 0}

function pseudo(S){const b=S.b,w=S.turn==='w',out=[],add=(f,t,x)=>out.push({f,t,...x});
 for(let i=0;i<64;i++){const p=b[i];if(!p||isW(p)!==w)continue;const P=p.toUpperCase(),r=i>>3,f=i&7;
  if(P==='P'){const d=w?-1:1,r1=r+d;if(r1<0||r1>7)continue;
   const push=t=>{if(r1===0||r1===7)for(const q of'qrbn')add(i,t,{p:q});else add(i,t)};
   if(!b[r1*8+f]){push(r1*8+f);if(r===(w?6:1)&&!b[(r+2*d)*8+f])add(i,(r+2*d)*8+f)}
   for(const x of[-1,1]){const ff=f+x;if(ff<0||ff>7)continue;const t=r1*8+ff;
    if(b[t]&&isW(b[t])!==w)push(t);else if(t===S.ep)add(i,t,{e:1})}}
  else if(P==='N'||P==='K'){
   for(const[x,y]of P==='N'?N:DR){const rr=r+y,ff=f+x;if(rr<0||rr>7||ff<0||ff>7)continue;const t=rr*8+ff;if(!b[t]||isW(b[t])!==w)add(i,t)}
   const h=w?60:4;
   if(P==='K'&&i===h)for(const[fl,rk,em,ps,dest]of[['K',h+3,[h+1,h+2],[h,h+1,h+2],h+2],['Q',h-4,[h-1,h-2,h-3],[h,h-1,h-2],h-2]]){
    if(S.c.includes(w?fl:fl.toLowerCase())&&b[rk]===(w?'R':'r')&&em.every(s=>!b[s])&&ps.every(s=>!att(b,s,w?'b':'w')))add(i,dest,{c:1})}}
  else for(const[x,y]of P==='B'?D:P==='R'?R:DR)for(let k=1;;k++){const rr=r+y*k,ff=f+x*k;if(rr<0||rr>7||ff<0||ff>7)break;const t=rr*8+ff;
   if(!b[t])add(i,t);else{if(isW(b[t])!==w)add(i,t);break}}}
 return out}

function ap(S,m,full){const b=S.b.slice(),p=b[m.f],w=isW(p),P=p.toUpperCase();let c=S.c,ep=-1,cap=b[m.t];
 b[m.t]=m.p?(w?m.p.toUpperCase():m.p):p;b[m.f]='';
 if(m.e){b[m.t+(w?8:-8)]='';cap='x'}
 if(m.c){const r=m.t>m.f?m.f+3:m.f-4,rt=m.t>m.f?m.f+1:m.f-1;b[rt]=b[r];b[r]=''}
 if(P==='K')c=c.replace(w?/[KQ]/g:/[kq]/g,'');
 for(const s of[m.f,m.t]){if(s===63)c=c.replace('K','');if(s===56)c=c.replace('Q','');if(s===7)c=c.replace('k','');if(s===0)c=c.replace('q','')}
 if(P==='P'&&Math.abs(m.t-m.f)===16&&[m.t-1,m.t+1].some(a=>(a>>3)===(m.t>>3)&&b[a]===(w?'p':'P')))ep=(m.f+m.t)/2;
 const n={b,turn:w?'b':'w',c,ep,hm:(P==='P'||cap)?0:S.hm+1,fm:S.fm+(w?0:1)};
 if(full)n.h=[...(S.h||[]),key(n)];return n}

function legal(S){const w=S.turn==='w',o=[];
 for(const m of pseudo(S)){const n=ap(S,m),k=n.b.indexOf(w?'K':'k');if(k<0||!att(n.b,k,w?'b':'w'))o.push(m)}return o}
function inCheck(S){const k=S.b.indexOf(S.turn==='w'?'K':'k');return k>=0&&!!att(S.b,k,S.turn==='w'?'b':'w')}
function insuf(b){const o=[];b.forEach((p,i)=>{if(p&&p.toLowerCase()!=='k')o.push([p.toLowerCase(),((i>>3)+(i&7))%2])});
 if(!o.length)return true;if(o.length===1&&'bn'.includes(o[0][0]))return true;
 return o.every(x=>x[0]==='b'&&x[1]===o[0][1])}
function status(S){const L=legal(S),ck=inCheck(S);
 if(!L.length)return ck?{over:1,res:S.turn==='w'?'b':'w',why:'كش مات',check:1}:{over:1,res:'d',why:'تعادل — ستيلميت (خنق)',check:0};
 if(insuf(S.b))return{over:1,res:'d',why:'تعادل — مواد غير كافية',check:ck};
 if(S.hm>=100)return{over:1,res:'d',why:'تعادل — قاعدة الخمسين نقلة',check:ck};
 const h=S.h;if(h&&h.filter(x=>x===h[h.length-1]).length>=3)return{over:1,res:'d',why:'تعادل — تكرار الوضع 3 مرات',check:ck};
 return{over:0,check:ck}}

function san(S,m){const p=S.b[m.f],P=p.toUpperCase(),cap=S.b[m.t]||m.e;let s;
 if(m.c)s=m.t>m.f?'O-O':'O-O-O';
 else if(P==='P')s=(cap?F[m.f&7]+'x':'')+sq(m.t)+(m.p?'='+m.p.toUpperCase():'');
 else{const ot=legal(S).filter(x=>x.f!==m.f&&x.t===m.t&&S.b[x.f]===p);let d='';
  if(ot.length){d=ot.every(x=>(x.f&7)!==(m.f&7))?F[m.f&7]:ot.every(x=>(x.f>>3)!==(m.f>>3))?8-(m.f>>3):sq(m.f)}
  s=P+d+(cap?'x':'')+sq(m.t)}
 const n=ap(S,m);return s+(legal(n).length?(inCheck(n)?'+':''):(inCheck(n)?'#':''))}
function replay(us){let S=fromFEN(START);for(const u of us){const m=legal(S).find(x=>uci(x)===u);if(!m)return null;S=ap(S,m,1)}return S}
function sans(us){let S=fromFEN(START);const o=[];for(const u of us){const m=legal(S).find(x=>uci(x)===u);if(!m)break;o.push(san(S,m));S=ap(S,m,1)}return o}

/* ألغاز */
const good=(S,m,n,ck)=>{const ns=ap(S,m),dl=legal(ns),c=inCheck(ns);if(!dl.length)return c;return n>1&&(!ck||c)&&dl.every(r=>mateIn(ap(ns,r),n-1,ck))};
const mateIn=(S,n,ck)=>legal(S).some(m=>good(S,m,n,ck));
const goodMoves=(S,n,ck)=>legal(S).filter(m=>good(S,m,n,ck));

/* ذكاء */
const V={p:100,n:320,b:330,r:500,q:900,k:0};
function ev(S){let s=0;for(let i=0;i<64;i++){const p=S.b[i];if(!p)continue;const w=isW(p),P=p.toLowerCase(),r=i>>3,f=i&7,c=(7-Math.abs(r-3.5)-Math.abs(f-3.5))*3;
 let v=V[P]+(P==='p'?(w?6-r:r-1)*6+c/2:P==='n'||P==='b'||P==='q'?c:0);s+=w?v:-v}return s}
const sc=(S,m)=>(V[(S.b[m.t]||'').toLowerCase()]||0)*10-(V[S.b[m.f].toLowerCase()]||0)+(m.p?800:0);
function ab(S,d,a,b){const L=legal(S);if(!L.length)return inCheck(S)?-99999-d:0;if(!d)return(S.turn==='w'?1:-1)*ev(S);
 L.sort((x,y)=>sc(S,y)-sc(S,x));for(const m of L){const v=-ab(ap(S,m),d-1,-b,-a);if(v>=b)return b;if(v>a)a=v}return a}
function best(S,lv){const L=legal(S);if(!L.length)return null;const d=lv<2?1:lv<3?2:3;let bm=null,bv=-1e9;
 for(const m of L){const v=-ab(ap(S,m),d-1,-1e9,1e9)+Math.random()*(lv<2?150:lv<3?25:3);if(v>bv){bv=v;bm=m}}return bm}

/* اللوحة: تتبني مرة واحدة بحجم ثابت وبعدين بنحدّث محتواها بس */
function render(el,S,o){
 if(!el.dataset.b){el.dataset.b=1;el.className='cb';let h='';for(let d=0;d<64;d++)h+='<div class="q"><i class="rk"></i><i class="fl"></i><span class="pc"></span></div>';el.innerHTML=h}
 const q=el.children,K=S.b.indexOf(S.turn==='w'?'K':'k'),ck=K>=0&&att(S.b,K,S.turn==='w'?'b':'w');
 for(let d=0;d<64;d++){const i=o.flip?63-d:d,e=q[d],p=S.b[i],r=i>>3,f=i&7;e.dataset.i=i;
  e.className='q '+((r+f)%2?'d':'l')+(o.sel===i?' sel':'')+(o.last&&o.last.includes(i)?' last':'')+(o.hint===i?' hint':'')+(o.tg&&o.tg.includes(i)?(p?' cap':' mv'):'')+(ck&&i===K?' chk':'');
  const pc=e.children[2];pc.textContent=p?G[p.toLowerCase()]+'\uFE0E':'';pc.className='pc '+(p?(isW(p)?'w':'b'):'');
  e.children[0].textContent=(o.flip?f===7:f===0)?8-r:'';e.children[1].textContent=(o.flip?r===0:r===7)?F[f]:''}
 el.onclick=ev=>{const t=ev.target.closest('.q');if(t&&o.on)o.on(+t.dataset.i)}}

const board=()=>localStorage.chess_board||'green',setBoard=n=>{localStorage.chess_board=n;document.documentElement.dataset.board=n};
document.documentElement.dataset.board=board();
const st=document.createElement('style');st.textContent=`
:root{--bs:min(calc(100vw - 8px),calc(100dvh - 215px),740px);--l:#EEEED2;--d:#769656}
${THEMES.map(t=>`html[data-board=${t[0]}]{--l:${t[1]};--d:${t[2]}}`).join('')}
.bw{position:relative;width:var(--bs);margin:0 auto}
.cb{width:var(--bs);height:var(--bs);display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);direction:ltr;border-radius:6px;overflow:hidden;box-shadow:0 8px 24px var(--shadow);user-select:none;touch-action:manipulation;margin:0 auto}
.q{position:relative;display:flex;align-items:center;justify-content:center;background:var(--l);cursor:pointer;overflow:hidden}.q.d{background:var(--d)}
.q.last::before,.q.sel::before,.q.hint::before{content:'';position:absolute;inset:0;background:rgba(255,235,59,.5)}.q.sel::before{background:rgba(255,235,59,.7)}.q.hint::before{background:rgba(39,174,96,.6)}
.q.chk::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,0,0,.9),rgba(255,0,0,0) 72%)}
.q.mv::after{content:'';position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(0,0,0,.22);z-index:3;pointer-events:none}
.q.cap::after{content:'';position:absolute;inset:3%;border-radius:50%;border:calc(var(--bs)/8*.09) solid rgba(0,0,0,.25);z-index:3;pointer-events:none}
.pc{position:relative;z-index:2;font-size:calc(var(--bs)/8*.8);line-height:1;font-family:'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans','Arial Unicode MS',sans-serif;pointer-events:none}
.pc.w,.pm .w{color:#fff;text-shadow:-1px -1px 0 #222,1px -1px 0 #222,-1px 1px 0 #222,1px 1px 0 #222,0 2px 3px rgba(0,0,0,.45)}
.pc.b,.pm .b{color:#161616;text-shadow:0 1px 0 rgba(255,255,255,.25),0 2px 3px rgba(0,0,0,.4)}
.rk,.fl{position:absolute;font-style:normal;font-weight:800;font-size:calc(var(--bs)/8*.17);z-index:1;pointer-events:none;opacity:.9}.rk{top:2px;left:3px}.fl{bottom:1px;right:3px}
.q.l .rk,.q.l .fl{color:var(--d)}.q.d .rk,.q.d .fl{color:var(--l)}
.pl{display:flex;justify-content:space-between;align-items:center;width:var(--bs);margin:6px auto;padding:8px 12px;background:var(--bg-card);border:2px solid var(--border);border-radius:12px;font-weight:800;font-size:14px}
.pl b{font-family:monospace;font-size:20px;direction:ltr;background:var(--bg-input);padding:2px 10px;border-radius:8px}.pl.on{border-color:var(--accent)}.pl.on b{background:var(--primary);color:#fff}[data-theme=dark] .pl.on b{color:#0A1612}.pl.low b{color:var(--error)}.pl.on.low b{background:var(--error);color:#fff}
.pm{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:8px;background:rgba(0,0,0,.6);border-radius:6px;z-index:5}
.pm button{width:19%;aspect-ratio:1;font-size:calc(var(--bs)/8*.85);line-height:1;border-radius:12px;border:3px solid var(--accent);background:var(--l);cursor:pointer;font-family:'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',sans-serif}
.bd{display:flex;gap:8px;justify-content:center;margin:10px 0}.sw{width:34px;height:34px;border-radius:10px;border:3px solid var(--border);cursor:pointer}.sw.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
.stt{min-height:48px}
.inp{width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--bg-input);color:var(--text-main);font:inherit;font-weight:700}
.spin{width:44px;height:44px;border:5px solid var(--border);border-top-color:var(--accent);border-radius:50%;margin:10px auto;animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}`;
st.textContent+=`
body.gm .top{display:none}body.gm .wrap{max-width:none;padding:6px 4px}body.gm .gh{margin-bottom:2px}body.gm .stt{min-height:30px;margin:2px 0;font-size:13px}body.gm .cb{border-radius:4px}
body.gm .mv{max-height:64px;overflow:auto;margin-top:6px}
.mdl{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100;display:none;align-items:center;justify-content:center;padding:14px}
.mc{background:var(--bg-card);border:2px solid var(--border);border-radius:18px;padding:16px;width:100%;max-width:420px;max-height:85dvh;overflow:auto}.mc h3{margin-bottom:10px}
.cl{height:240px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.cm{max-width:80%;padding:7px 11px;border-radius:12px;background:var(--bg-input);font-size:13.5px;font-weight:600;align-self:flex-start;word-break:break-word}
.cm.me{align-self:flex-end;background:var(--primary);color:#fff}[data-theme=dark] .cm.me{color:#0A1612}
.dot{position:relative}.dot::after{content:'';position:absolute;top:3px;right:3px;width:10px;height:10px;background:#e74c3c;border-radius:50%}`;
document.head.appendChild(st);
/* أصوات الرقعة (مولّدة بالكود، بدون ملفات) */
let AC;const muted=()=>localStorage.chess_snd==='0';
function snd(k){if(muted())return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();const n=AC.currentTime;
 const nz=(t,v,fr)=>{const b=AC.createBuffer(1,AC.sampleRate*.07,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=fr;g.gain.value=v;s.connect(f).connect(g).connect(AC.destination);s.start(n+t)};
 const tn=(t,f,d,v,ty)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=ty||'sine';o.frequency.setValueAtTime(f,n+t);g.gain.setValueAtTime(v,n+t);g.gain.exponentialRampToValueAtTime(.001,n+t+d);o.connect(g).connect(AC.destination);o.start(n+t);o.stop(n+t+d+.02)};
 const mv=t=>{nz(t,1,1400);tn(t,190,.09,.5,'triangle')},cp=t=>{nz(t,1.4,1000);tn(t,150,.12,.7,'triangle')};
 if(k==='move')mv(0);else if(k==='cap'){cp(0);nz(.07,.8,1900)}else if(k==='castle'){mv(0);mv(.13)}
 else if(k==='check'){mv(0);tn(.1,880,.25,.25)}else if(k==='end'){[523,392,330].forEach((f,i)=>tn(.15+i*.18,f,.4,.3,'triangle'))}
 else if(k==='chat'){tn(0,1040,.12,.25);tn(.1,1320,.18,.25)}}catch(e){}}

window.CH2={...O,START,fromFEN,toFEN,isW,idx,sq,uci,legal,movesFrom:(S,i)=>legal(S).filter(m=>m.f===i),apply:(S,m)=>ap(S,m,1),inCheck,status,best,mateIn,goodMoves,san,sans,replay,render,
 snd,muted,setMute:v=>localStorage.chess_snd=v?'0':'1',glyph:p=>G[p]+'\uFE0E',themes:THEMES,board,setBoard,
 applyTheme(cfg){try{O.applyTheme&&O.applyTheme(cfg)}catch(e){}if(cfg&&cfg.board&&!localStorage.chess_board)document.documentElement.dataset.board=cfg.board},
 aiMove:O.aiMove||(async()=>null),coach:O.coach||(async()=>{throw 0})};
})();
