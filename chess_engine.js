/* ميزان | محرك الشطرنج المشترك (يستخدمه chess.html و chess_admin.html) */
const CH=(()=>{
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DG=[[-1,-1],[-1,1],[1,-1],[1,1]],OR=[[-1,0],[1,0],[0,-1],[0,1]],ALL=DG.concat(OR);
const VAL={P:100,N:320,B:330,R:500,Q:900,K:0};
const isW=p=>!!p&&p===p.toUpperCase();
const inb=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const sq=i=>'abcdefgh'[i&7]+(8-(i>>3));
const idx=n=>(8-+n[1])*8+'abcdefgh'.indexOf(n[0]);
const uci=m=>sq(m.f)+sq(m.t)+(m.p||'');

function fromFEN(f){const p=f.split(' '),b=[];
 for(const ch of p[0]){if(ch==='/')continue;if(/\d/.test(ch))for(let k=0;k<+ch;k++)b.push('');else b.push(ch)}
 return{b,turn:p[1]||'w',cs:(p[2]||'-')==='-'?'':p[2],ep:(p[3]&&p[3]!=='-')?idx(p[3]):-1,hm:+p[4]||0,fm:+p[5]||1}}
function toFEN(s){let o='';for(let r=0;r<8;r++){let e=0;for(let c=0;c<8;c++){const p=s.b[r*8+c];if(!p)e++;else{if(e){o+=e;e=0}o+=p}}if(e)o+=e;if(r<7)o+='/'}
 return o+' '+s.turn+' '+(s.cs||'-')+' '+(s.ep>=0?sq(s.ep):'-')+' '+s.hm+' '+s.fm}

function att(b,s,by){const r=s>>3,c=s&7,w=by==='w';
 const pr=w?r+1:r-1,P=w?'P':'p';
 for(const dc of[-1,1])if(inb(pr,c+dc)&&b[pr*8+c+dc]===P)return true;
 const N=w?'N':'n',K=w?'K':'k';
 for(const[a,d]of KN)if(inb(r+a,c+d)&&b[(r+a)*8+c+d]===N)return true;
 for(const[a,d]of ALL)if(inb(r+a,c+d)&&b[(r+a)*8+c+d]===K)return true;
 for(const[a,d]of ALL){let x=r+a,y=c+d;while(inb(x,y)){const p=b[x*8+y];if(p){if(isW(p)===w){const u=p.toUpperCase();if(u==='Q'||(a&&d?u==='B':u==='R'))return true}break}x+=a;y+=d}}
 return false}
const kingAt=(b,w)=>b.indexOf(w?'K':'k');
const inCheck=s=>{const w=s.turn==='w';return att(s.b,kingAt(s.b,w),w?'b':'w')};

function gen(s){const b=s.b,w=s.turn==='w',ms=[],opp=w?'b':'w';
 for(let i=0;i<64;i++){const p=b[i];if(!p||isW(p)!==w)continue;const u=p.toUpperCase(),r=i>>3,c=i&7;
  if(u==='P'){const d=w?-1:1,sr=w?6:1,pr=w?0:7;
   const add=(t,e)=>{if((t>>3)===pr)for(const q of'qrbn')ms.push({f:i,t,p:q});else ms.push({f:i,t,e})};
   if(inb(r+d,c)&&!b[(r+d)*8+c]){add((r+d)*8+c);if(r===sr&&!b[(r+2*d)*8+c])ms.push({f:i,t:(r+2*d)*8+c})}
   for(const dc of[-1,1]){if(!inb(r+d,c+dc))continue;const t=(r+d)*8+c+dc;
    if(b[t]&&isW(b[t])!==w)add(t);else if(t===s.ep)ms.push({f:i,t,e:1})}}
  else if(u==='N'||u==='K'){for(const[a,d]of(u==='N'?KN:ALL)){if(!inb(r+a,c+d))continue;const t=(r+a)*8+c+d;if(!b[t]||isW(b[t])!==w)ms.push({f:i,t})}}
  else{for(const[a,d]of(u==='B'?DG:u==='R'?OR:ALL)){let x=r+a,y=c+d;while(inb(x,y)){const t=x*8+y;if(b[t]){if(isW(b[t])!==w)ms.push({f:i,t});break}ms.push({f:i,t});x+=a;y+=d}}}}
 const k=w?60:4;
 if(b[k]===(w?'K':'k')&&!att(b,k,opp)){
  if(s.cs.includes(w?'K':'k')&&!b[k+1]&&!b[k+2]&&b[k+3]===(w?'R':'r')&&!att(b,k+1,opp))ms.push({f:k,t:k+2,c:1});
  if(s.cs.includes(w?'Q':'q')&&!b[k-1]&&!b[k-2]&&!b[k-3]&&b[k-4]===(w?'R':'r')&&!att(b,k-1,opp))ms.push({f:k,t:k-2,c:1})}
 return ms}

function apply(s,m){const b=s.b.slice(),p=b[m.f],w=s.turn==='w';let cs=s.cs,ep=-1;
 const cap=!!b[m.t]||!!m.e;
 b[m.t]=m.p?(w?m.p.toUpperCase():m.p):p;b[m.f]='';
 if(m.e)b[m.t+(w?8:-8)]='';
 if(m.c){if(m.t>m.f){b[m.t-1]=b[m.t+1];b[m.t+1]=''}else{b[m.t+1]=b[m.t-2];b[m.t-2]=''}}
 if(p.toUpperCase()==='P'&&Math.abs(m.t-m.f)===16)ep=(m.f+m.t)/2;
 const rm=x=>{cs=cs.replace(x,'')};
 if(p==='K'){rm('K');rm('Q')}if(p==='k'){rm('k');rm('q')}
 for(const q of[m.f,m.t]){if(q===63)rm('K');if(q===56)rm('Q');if(q===7)rm('k');if(q===0)rm('q')}
 return{b,turn:w?'b':'w',cs,ep,hm:(p.toUpperCase()==='P'||cap)?0:s.hm+1,fm:s.fm+(w?0:1)}}

function legal(s){const w=s.turn==='w';
 return gen(s).filter(m=>{const n=apply(s,m);return!att(n.b,kingAt(n.b,w),w?'b':'w')})}

function status(s){const ms=legal(s),chk=inCheck(s);
 if(!ms.length)return chk?{over:1,res:s.turn==='w'?'b':'w',why:'كش مات',check:1}:{over:1,res:'d',why:'تعادل (ستيل ميت)'};
 const pcs=s.b.filter(x=>x&&x.toUpperCase()!=='K');
 if(!pcs.length||(pcs.length===1&&/[nb]/i.test(pcs[0])))return{over:1,res:'d',why:'تعادل (مواد غير كافية)'};
 if(s.hm>=100)return{over:1,res:'d',why:'تعادل (قاعدة 50 نقلة)'};
 return{over:0,check:chk}}

function play(s,u){const m=legal(s).find(x=>uci(x)===u);return m?apply(s,m):null}
function movesFrom(s,i){return legal(s).filter(m=>m.f===i)}

/* ===== ذكاء المحرك ===== */
let TO=0;
function ev(s){let v=0;for(let i=0;i<64;i++){const p=s.b[i];if(!p)continue;const u=p.toUpperCase(),r=i>>3,c=i&7,w=isW(p);
  let x=VAL[u];const cen=(3.5-Math.abs(c-3.5))+(3.5-Math.abs(r-3.5));
  if(u==='P')x+=(w?6-r:r-1)*6+cen*2;else if(u==='N'||u==='B')x+=cen*7;else if(u==='Q')x+=cen*2;
  else if(u==='K')x+=((w&&r===7)||(!w&&r===0))?10:-cen*3;
  v+=w?x:-x}
 return s.turn==='w'?v:-v}
function nm(s,d,a,b,dl){if(Date.now()>dl){TO=1;return 0}
 const ms=legal(s);if(!ms.length)return inCheck(s)?-99999-d:0;
 if(d<=0)return ev(s);
 ms.sort((x,y)=>(s.b[y.t]?VAL[s.b[y.t].toUpperCase()]:0)-(s.b[x.t]?VAL[s.b[x.t].toUpperCase()]:0));
 for(const m of ms){const v=-nm(apply(s,m),d-1,-b,-a,dl);if(TO)return 0;if(v>=b)return b;if(v>a)a=v}
 return a}
function best(s,lv){const ms=legal(s);if(!ms.length)return null;
 if(lv===1&&Math.random()<.45)return ms[Math.random()*ms.length|0];
 const maxD=lv<=1?1:lv===2?2:lv===3?3:6,dl=Date.now()+(lv===4?2600:lv===3?1800:900);
 let bm=ms[0];
 for(let d=1;d<=maxD;d++){TO=0;let bv=-1e9,cur=null;
  const ord=ms.slice().sort((x,y)=>(y===bm)-(x===bm));
  for(const m of ord){const v=-nm(apply(s,m),d-1,-1e9,1e9,dl)+Math.random()*(lv<=2?25:2);if(TO)break;if(v>bv){bv=v;cur=m}}
  if(TO){break}if(cur)bm=cur}
 return bm}

/* ===== العرض والثيمات ===== */
const GL={solid:{K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟︎'},line:{K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙'}};
const THEMES={classic:['#EEEED2','#769656'],wood:['#F0D9B5','#B58863'],blue:['#DEE3E6','#8CA2AD'],night:['#9AA5B1','#3E4C59'],gold:['#F5F1E8','#C9A961'],rose:['#F7E1E7','#C2738A'],ice:['#E8F4FA','#5B9BBF']};
function applyTheme(c){c=c||{};const t=THEMES[c.board]||[c.light||THEMES.classic[0],c.dark||THEMES.classic[1]];
 const R=document.documentElement.style;R.setProperty('--bl',c.light&&c.board==='custom'?c.light:t[0]);R.setProperty('--bd',c.dark&&c.board==='custom'?c.dark:t[1]);
 document.documentElement.dataset.ps=c.pieces||'solid';
 R.setProperty('--pw',c.pw||'#fff');R.setProperty('--pb',c.pb||'#1a1a1a')}
const st=document.createElement('style');st.textContent=`
.bd{--s:min(92vw,500px);width:var(--s);height:var(--s);display:grid;grid-template-columns:repeat(8,1fr);direction:ltr;border:4px solid var(--accent,#C9A961);border-radius:10px;overflow:hidden;margin:auto;user-select:none;touch-action:manipulation}
.sq{display:flex;align-items:center;justify-content:center;font-size:calc(var(--s)/8*.78);position:relative;cursor:pointer;line-height:1}
.sq.l{background:var(--bl,#EEEED2)}.sq.d{background:var(--bd,#769656)}
.sq.lm{box-shadow:inset 0 0 0 100px rgba(255,235,59,.35)}.sq.sel{box-shadow:inset 0 0 0 100px rgba(255,200,0,.6)}
.sq.chk{box-shadow:inset 0 0 0 100px rgba(231,76,60,.65)}
.sq.tg::after{content:'';width:28%;height:28%;border-radius:50%;background:rgba(20,20,20,.28);position:absolute}
.sq.cap{box-shadow:inset 0 0 0 calc(var(--s)/8*.09) rgba(231,76,60,.85)}
.sq.hint{box-shadow:inset 0 0 0 100px rgba(46,204,113,.55)}
.pc{font-style:normal;transition:transform .12s}
.pc.w{color:var(--pw,#fff);text-shadow:0 0 2px #000,0 0 2px #000,0 1px 3px #000}
.pc.b{color:var(--pb,#1a1a1a);text-shadow:0 0 1px rgba(255,255,255,.5)}
[data-ps=line] .pc.w,[data-ps=line] .pc.b{text-shadow:none}
[data-ps=line] .pc.w{color:var(--pw,#fff);-webkit-text-stroke:0}
.sq:active .pc{transform:scale(1.12)}`;
document.head.appendChild(st);
function render(el,s,o){o=o||{};const ps=document.documentElement.dataset.ps==='line'?'line':'solid';
 const ck=o.chk===undefined?(inCheck(s)?kingAt(s.b,s.turn==='w'):-1):o.chk;let h='';
 for(let k=0;k<64;k++){const i=o.flip?63-k:k,r=i>>3,c=i&7,p=s.b[i];
  let cl='sq '+((r+c)%2?'d':'l');
  if(i===o.sel)cl+=' sel';if((o.last||[]).includes(i))cl+=' lm';if(i===ck)cl+=' chk';
  if((o.tg||[]).includes(i))cl+=p?' cap':' tg';if(i===o.hint)cl+=' hint';
  h+=`<div class="${cl}" data-i="${i}">${p?`<i class="pc ${isW(p)?'w':'b'}">${GL[ps][p.toUpperCase()]}</i>`:''}</div>`}
 el.className='bd';el.innerHTML=h;
 if(o.on)el.onclick=e=>{const q=e.target.closest('.sq');if(q)o.on(+q.dataset.i)}}

/* ===== مزودو الذكاء الاصطناعي (Gemini / متوافق مع OpenAI / مخصص) ===== */
async function askAI(p,prompt){
 const to=new AbortController();const tm=setTimeout(()=>to.abort(),25000);
 try{let url=p.url,r,j;
  if(p.type==='gemini'){if(p.model&&!/:generateContent/.test(url))url=url.replace(/\/$/,'')+'/models/'+p.model+':generateContent';
   url+=(url.includes('?')?'&':'?')+'key='+encodeURIComponent(p.key);
   r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:to.signal,body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
   j=await r.json();return j.candidates[0].content.parts.map(x=>x.text).join('')}
  if(p.type==='openai'){r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+p.key},signal:to.signal,body:JSON.stringify({model:p.model,messages:[{role:'user',content:prompt}]})});
   j=await r.json();return j.choices[0].message.content}
  r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+p.key},signal:to.signal,body:JSON.stringify({prompt,model:p.model})});
  j=await r.json();return j.text||j.response||j.output||j.answer||JSON.stringify(j)
 }finally{clearTimeout(tm)}}
async function aiMove(p,s){const ms=legal(s).map(uci);
 const t=await askAI(p,`You are a chess engine. FEN: ${toFEN(s)}\nLegal moves (UCI): ${ms.join(' ')}\nReply with ONLY the best move, one UCI move from the list, nothing else.`);
 const f=(t.match(/[a-h][1-8][a-h][1-8][qrbn]?/g)||[]).find(x=>ms.includes(x));return f||null}
const coach=(p,fen,q)=>askAI(p,`أنت مدرب شطرنج ودود للمبتدئين. اشرح بالعربية المصرية في 3 جمل بالكثير. الوضع (FEN): ${fen}\n${q}`);

return{START,fromFEN,toFEN,legal,apply,uci,sq,idx,status,play,movesFrom,best,inCheck,kingAt,isW,render,applyTheme,THEMES,askAI,aiMove,coach}})();
