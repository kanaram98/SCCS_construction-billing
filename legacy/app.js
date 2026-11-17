const K='billing_v1';let view='entry',lastDoc='bill';
function load(){try{const s=JSON.parse(localStorage.getItem(K));if(s)return s}catch(e){}
return{p:{firm:'',name:'',client:'',no:'1',date:new Date().toISOString().slice(0,10),hdr:'all',pb:'room'},
rates:[{id:1,name:'Floor tiles',unit:'sqft',type:'area',rate:85},{id:2,name:'Skirting',unit:'rft',type:'length',rate:30},{id:3,name:'Gas hole',unit:'nos',type:'count',rate:250}],floors:[],uid:10}}
let S=load();if(!S.bills){S.bills=[{id:1,p:S.p,floors:S.floors}];S.bid=1}
S.firm=S.firm||{name:(S.p&&S.p.firm)||'',addr:'',phone:'',gstin:'',bank:'',logo:''};
{const b=S.bills.find(x=>x.id==S.bid)||S.bills[0];S.bid=b.id;S.p=b.p;S.floors=b.floors}
if(!S.m2){S.m2=1;(S.rates||[]).forEach(r=>{if(r.name=='Window'&&r.type=='length')r.type='lenw'});save()}if(!S.m1){S.m1=1;['Window','Door'].forEach(n=>{if(!S.rates.some(r=>r.name==n))S.rates.push({id:++S.uid,name:n,unit:'rft',type:n=='Window'?'lenw':'length',rate:0})});save()}
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const ft=d=>{if(Array.isArray(d))return(+d[0]||0)+(+d[1]||0)/12;const p=String(d||'').trim().split('.');return(+p[0]||0)+(p[1]?+p[1]:0)/12},
fi=d=>{if(Array.isArray(d))return(+d[0]||0)+"'"+(+d[1]||0)+'"';const p=String(d||'').split('.');return(+p[0]||0)+"'"+(+p[1]||0)+'"'},
dv=d=>Array.isArray(d)?((+d[0]||+d[1])?((+d[0]||0)+(d[1]?'.'+d[1]:'')):''):(d==null?'':d);
const R=id=>S.rates.find(r=>r.id==id)||{name:'(deleted)',unit:'',type:'direct',rate:0};
const T={area:'Length × Breadth',length:'Length',lenw:'Length, width noted',volume:'L × B × H',count:'Count (nos)',direct:'Enter quantity'};
function qty(it){const r=R(it.rid),n=+it.n||0,L=ft(it.l),B=ft(it.b),H=ft(it.h);
const q={area:L*B*n,length:L*n,lenw:L*n,volume:L*B*H*n,count:n,direct:+it.q||0}[r.type]||0;return Math.round(q*100)/100}
const amt=it=>Math.round(qty(it)*(R(it.rid).rate||0));
const sum=a=>a.reduce((x,y)=>x+y,0),roomT=r=>sum(r.items.map(amt)),floorT=f=>sum(f.rooms.map(roomT)),grand=()=>sum(S.floors.map(floorT));
const nid=()=>++S.uid;
function go(v){view=v;if(['meas','bill','sum'].includes(v))lastDoc=v;draw();window.scrollTo(0,0)}
function seg(k){return`<div class="seg no-print">${[['meas','Measurement'],['bill','Bill'],['sum','Summary']].map(a=>`<button class="${k==a[0]?'on':''}" onclick="go('${a[0]}')">${a[1]}</button>`).join('')}</div>`}
function ch(){save();const m=document.getElementById('main');const a=document.activeElement;const ix=[...m.querySelectorAll('input,textarea')].indexOf(a);draw();if(ix>=0){const e=m.querySelectorAll('input,textarea')[ix];if(e)e.focus()}}
function sp(k,v){S.p[k]=v;save()}
function draw(){
const ic={entry:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',rates:'<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>',project:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',doc:'<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'};
const isDoc=['meas','bill','sum'].includes(view);
const tabs=[['entry','Entry','entry'],['rates','Rates','rates'],['project','Project','project'],[lastDoc,'Print','doc']];
document.getElementById('pn').textContent=S.p.name||'Project not named';
document.getElementById('tabs').innerHTML=tabs.map(t=>`<button class="${(t[2]=='doc'?isDoc:view==t[0])?'on':''}" onclick="go('${t[0]}')"><svg viewBox="0 0 24 24">${ic[t[2]]}</svg>${t[1]}</button>`).join('');
const m=document.getElementById('main');
m.innerHTML=({entry:vEntry,rates:vRates,project:vProject,meas:()=>vDoc('meas'),bill:()=>vDoc('bill'),sum:()=>vDoc('sum')})[view]();
}
function vProject(){const p=S.p;const f=(k,l)=>`<label>${l}<input value="${esc(p[k])}" onchange="sp('${k}',this.value)"></label>`;
return`<div class="card"><h3>Bill details</h3><div class="grid">${f('firm','Firm name')}${f('name','Project / site')}${f('client','Client')}${f('no','Bill no.')}${f('l1','First level name (default: Section)')}${f('l2','Second level name (default: Area)')}<label>Date<input type="date" value="${esc(p.date)}" onchange="sp('date',this.value)"></label></div></div>
<div class="card"><h3>Print settings</h3><div class="grid"><label>Page header<select onchange="sp('hdr',this.value)"><option value="all" ${p.hdr=='all'?'selected':''}>Repeat on every page</option><option value="first" ${p.hdr=='first'?'selected':''}>First page only</option></select></label>
<label>Numbering<select onchange="sp('sr',this.value==='1')"><option value="" ${!p.sr?'selected':''}>No serial numbers</option><option value="1" ${p.sr?'selected':''}>Number the rows (1, 2, 3…)</option></select></label><label>Page break<select onchange="sp('pb',this.value)"><option value="room" ${p.pb=='room'?'selected':''}>New page for each ${L2()}</option><option value="floor" ${p.pb=='floor'?'selected':''}>New page for each ${L1()}</option><option value="none" ${p.pb=='none'?'selected':''}>Continuous</option></select></label></div>
<label style="margin-top:10px">Footer lines (up to 3 lines, printed at the end of every bill with date and signature)<textarea rows="3" style="font:inherit;color:var(--tx);background:var(--in);border:1px solid var(--bd);border-radius:6px;padding:6px 8px" onchange="sp('foot',this.value)">${esc(footTxt())}</textarea></label><p class="note">Your data is saved in this browser only. Paper size: A4.</p></div>`}
function vRates(){return`<div class="card"><p class="note">Set each work item once with its fixed rate. “Measured as” decides which boxes appear in Entry.</p>`+S.rates.map((r,i)=>r.hidden?'':`<div class="row rrow"><input style="flex:1;min-width:130px" value="${esc(r.name)}" onchange="S.rates[${i}].name=this.value;ch()"><input style="width:64px" value="${esc(r.unit)}" onchange="S.rates[${i}].unit=this.value;ch()"><select onchange="S.rates[${i}].type=this.value;ch()">${Object.keys(T).map(k=>`<option value="${k}" ${r.type==k?'selected':''}>${T[k]}</option>`).join('')}</select><input type="number" step="any" value="${r.rate}" onchange="S.rates[${i}].rate=+this.value;ch()"><label style="flex-direction:row;align-items:center;gap:4px"><input type="checkbox" ${r.auto?'checked':''} onchange="S.rates[${i}].auto=this.checked;save()">In every new ${L2()}</label><button class="b x" onclick="S.rates.splice(${i},1);ch()">✕</button></div>`).join('')+`<button class="b p" onclick="S.rates.push({id:nid(),name:'New item',unit:'sqft',type:'area',rate:0});ch()">Add work item</button></div>`}
function vEntry(){
let h=S.floors.map((f,fi_)=>`<div class="card fcard"><div class="row fh"><input class="fname" value="${esc(f.name)}" onchange="S.floors[${fi_}].name=this.value;ch()"><button class="b" onclick="addRoom(${fi_})">Add ${L2()}</button><select onchange="addAll(${fi_},this.value)"><option value="">+ Item in every ${L2()}…</option>${S.rates.filter(x=>!x.hidden).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button class="b x" onclick="if(this.dataset.s){S.floors.splice(${fi_},1);ch()}else{this.dataset.s=1;this.textContent='Sure?'}">Delete ${L1()}</button></div>`+
f.rooms.map((r,ri)=>`<div class="rm"><div class="row rh"><input class="rname" value="${esc(r.name)}" onchange="S.floors[${fi_}].rooms[${ri}].name=this.value;ch()"><button class="b" onclick="cpRoom(${fi_},${ri},0)">Copy</button><button class="b" onclick="cpRoom(${fi_},${ri},1)">Copy, clear sizes</button><button class="b x" onclick="if(this.dataset.s){S.floors[${fi_}].rooms.splice(${ri},1);ch()}else{this.dataset.s=1;this.textContent='Sure?'}">Delete</button></div>`+
r.items.map((it,ii)=>itemRow2(fi_,ri,ii,it)).join('')+
`<div class="row addrow">${S.clip?`<button class="b p" onclick="pasteItem(${fi_},${ri})">Paste: ${esc(R(S.clip.rid).name)}</button>`:''}<button class="b" onclick="addCustom(${fi_},${ri})">+ Custom item</button><select onchange="addItem(${fi_},${ri},this.value)"><option value="">+ Add work item…</option>${S.rates.filter(x=>!x.hidden).map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.unit)})</option>`).join('')}</select></div><div class="tot"><span>Total · ${esc(r.name)}</span><b>${inr(roomT(r))}</b></div></div>`).join('')+
`<div class="tot ftot"><span>${esc(f.name)} total</span><b>${inr(floorT(f))}</b></div></div>`).join('');
return clipBar()+h+`<button class="b p wide" onclick="S.floors.push({id:nid(),name:'${L1()} ${S.floors.length+1}',rooms:[]});ch()">Add ${L1()}</button>`+(S.floors.length?`<div class="card gbar"><span>Grand total</span><b>${inr(grand())}</b></div>`:`<div class="empty"><b>No ${L1()} yet</b><span>Add a ${L1()} to begin, then ${L2()}s and work items.</span></div>`)}
function dimIn(l,fi_,ri,ii,k,it,lab){return`<span class="dim">${lab}<input type="number" step="any" value="${it[k][0]}" onchange="sd(${fi_},${ri},${ii},'${k}',0,this.value)">'<input type="number" step="any" value="${it[k][1]}" onchange="sd(${fi_},${ri},${ii},'${k}',1,this.value)">"</span>`}
function itemRow(f,r,i,it){const x=R(it.rid),t=x.type;
return`<div class="item"><span class="nm">${esc(x.name)}</span>`+
(t=='direct'?`<span class="dim">Qty<input type="number" step="any" value="${it.q}" onchange="si(${f},${r},${i},'q',this.value)"></span>`:`<span class="dim">Nos<input type="number" step="any" value="${it.n}" onchange="si(${f},${r},${i},'n',this.value)"></span>`)+
((t=='area'||t=='length'||t=='volume')?dimIn(0,f,r,i,'l',it,'L'):'')+((t=='area'||t=='volume')?dimIn(0,f,r,i,'b',it,'B'):'')+(t=='volume'?dimIn(0,f,r,i,'h',it,'H'):'')+
`<span class="note">= ${qty(it)} ${esc(x.unit)} × ${x.rate}</span><span class="amt">${inr(amt(it))}</span><button class="b" onclick="cpItem(${f},${r},${i})">Copy</button><button class="b x" onclick="S.floors[${f}].rooms[${r}].items.splice(${i},1);ch()">✕</button></div>`}
function addItem(f,r,id){if(!id)return;S.floors[f].rooms[r].items.push({rid:+id,n:1,l:[0,0],b:[0,0],h:[0,0],q:0});ch()}
function itemRow2(f,r,i,it){const x=R(it.rid),t=x.type,u=esc(x.unit);
const n=t=='direct'?`<label>Quantity (${u})<input type="number" inputmode="decimal" step="any" value="${it.q}" onchange="si(${f},${r},${i},'q',this.value)"></label>`:`<label>Nos<input type="number" inputmode="decimal" step="any" value="${it.n}" onchange="si(${f},${r},${i},'n',this.value)"></label>`;
const d=(k,lab)=>{const v=dv(it[k]),w=ft(it[k]),bad=(String(v).split('.')[1]||0)>11;return`<label>${lab} (feet.inches)<input type="text" inputmode="decimal" placeholder="e.g. 15.4" value="${esc(v)}" onchange="sdd(${f},${r},${i},'${k}',this.value)"><span class="note" ${bad?'style="color:#c0392b"':''}>${bad?'Inches must be 0–11':'= '+(Math.round(w*100)/100)+' ft'}</span></label>`};
return`<div class="ic"><div class="ih"><b>${esc(x.name)}</b><span class="amt">${inr(amt(it))}</span></div>${x.hidden?customEd(x):''}<div class="ib">${n}${(t=='area'||t=='length'||t=='lenw'||t=='volume')?d('l','Length'):''}${(t=='area'||t=='lenw'||t=='volume')?d('b','Width'):''}${t=='volume'?d('h','Height'):''}</div><div class="ih"><span class="note">${qty(it)} ${u} × ₹${x.rate}</span><span class="row"><button class="b" onclick="cpItem(${f},${r},${i})">Copy</button><button class="b x" onclick="S.floors[${f}].rooms[${r}].items.splice(${i},1);ch()">Remove</button></span></div></div>`}
const L1=()=>S.p.l1||'Section',L2=()=>S.p.l2||'Area';
function addCustom(f,r){const id=nid();S.rates.push({id,name:'Custom item',unit:'nos',type:'count',rate:0,hidden:true});S.floors[f].rooms[r].items.push(newItem(id));ch()}
function customEd(x){const k=S.rates.indexOf(x);return`<div class="ib"><label>Item name<input value="${esc(x.name)}" onchange="S.rates[${k}].name=this.value;ch()"></label><label>Unit<input value="${esc(x.unit)}" onchange="S.rates[${k}].unit=this.value;ch()"></label><label>Measured as<select onchange="S.rates[${k}].type=this.value;ch()">${Object.keys(T).map(q=>`<option value="${q}" ${x.type==q?'selected':''}>${T[q]}</option>`).join('')}</select></label><label>Rate (₹)<input type="number" inputmode="decimal" step="any" value="${x.rate}" onchange="S.rates[${k}].rate=+this.value;ch()"></label><button class="b" onclick="S.rates[${k}].hidden=false;ch()">Save to Rates list</button></div>`}
function sdd(f,r,i,k,v){S.floors[f].rooms[r].items[i][k]=v.trim();ch()}
function si(f,r,i,k,v){S.floors[f].rooms[r].items[i][k]=+v;ch()}
function sd(f,r,i,k,j,v){S.floors[f].rooms[r].items[i][k][j]=+v;ch()}
function cpRoom(f,r,c){const o=JSON.parse(JSON.stringify(S.floors[f].rooms[r]));o.id=nid();o.name+=' copy';if(c)o.items.forEach(it=>{it.n=1;it.l=[0,0];it.b=[0,0];it.h=[0,0];it.q=0});S.floors[f].rooms.splice(r+1,0,o);ch()}
function newItem(id){return{rid:+id,n:1,l:[0,0],b:[0,0],h:[0,0],q:0}}
function addRoom(f){const F=S.floors[f];F.rooms.push({id:nid(),name:L2()+' '+(F.rooms.length+1),items:S.rates.filter(x=>x.auto).map(x=>newItem(x.id))});ch()}
function addAll(f,id){if(!id)return;S.floors[f].rooms.forEach(r=>r.items.push(newItem(id)));ch()}
function cpItem(f,r,i){S.clip=JSON.parse(JSON.stringify(S.floors[f].rooms[r].items[i]));ch()}
function pasteItem(f,r){if(!S.clip)return;S.floors[f].rooms[r].items.push(JSON.parse(JSON.stringify(S.clip)));ch()}
function clipBar(){if(!S.clip)return'';const x=R(S.clip.rid);return`<div class="card row" style="position:sticky;top:0;z-index:5;border-color:var(--ac)"><span>Copied: <b>${esc(x.name)}</b> × ${qty(S.clip)} ${esc(x.unit)}. Tap Paste in any ${L2()}.</span><button class="b" onclick="S.clip=null;ch()">Clear</button></div>`}
const DEF='This bill is based on site measurements taken jointly.\nRates are as agreed. Payment is due on receipt of this bill.';
const footTxt=()=>S.p.foot==null?DEF:S.p.foot;
function footer(){const L=footTxt().split('\n').filter(x=>x.trim()).slice(0,3).map(x=>`<div>${esc(x)}</div>`).join('');return`<div class="foot">${L}<div class="sg"><span>Date: ____________</span><span>Signature: ____________________</span></div></div>`}
function hdr(title){const p=S.p;return`<div class="ph"><h2>${esc(p.firm||'Firm name')}</h2><div>Project: ${esc(p.name)} &nbsp; Client: ${esc(p.client)}</div><div><b>${title}</b> &nbsp; Bill no. ${esc(p.no)} &nbsp; Date: ${esc(p.date)}</div></div>`}
function vDoc(kind){
const p=S.p,title={meas:'Measurement sheet',bill:'Bill',sum:'Summary bill'}[kind];
const cols={meas:['Item','Nos','Length','Breadth','Height','Qty','Unit'],bill:['Item','Qty','Unit','Rate','Amount'],sum:['Category','Amount']}[kind];
const N=cols.length;let rows='',first=true;
S.floors.forEach((f,fx)=>{
const fb=(p.pb=='floor'&&fx>0)?' brk':'';
if(!(kind=='sum'&&p.depth=='floor'))rows+=`<tr class="fl${fb}"><td colspan="${N}">${esc(f.name)}</td></tr>`;
f.rooms.forEach((r,rx)=>{
const rb=(p.pb=='room'&&!(fx==0&&rx==0))?' brk':'';
if(kind=='sum'){if(p.depth!='floor')rows+=`<tr><td>${p.sr?(rx+1)+'. ':''}${esc(r.name)}</td><td class="r">${inr(roomT(r))}</td></tr>`;return}
rows+=`<tr class="rmr${rb}"><td colspan="${N}">${esc(r.name)}</td></tr>`;
r.items.forEach((it,ix)=>{const x=R(it.rid),t=x.type,sn=p.sr?(ix+1)+'. ':'';
if(kind=='meas')rows+=`<tr><td>${sn}${esc(x.name)}${it.d?`<div class="rem">${esc(it.d)}</div>`:''}</td><td class="r">${t=='direct'?'':it.n}</td><td class="r">${(t=='area'||t=='length'||t=='lenw'||t=='volume')?fi(it.l):''}</td><td class="r">${(t=='area'||t=='lenw'||t=='volume')?fi(it.b):''}</td><td class="r">${t=='volume'?fi(it.h):''}</td><td class="r">${qty(it)}</td><td>${esc(x.unit)}</td></tr>`;
else rows+=`<tr><td>${sn}${esc(x.name)}${it.d?`<div class="rem">${esc(it.d)}</div>`:''}</td><td class="r">${qty(it)}</td><td>${esc(x.unit)}</td><td class="r">${x.rate}</td><td class="r">${inr(amt(it))}</td></tr>`});
if(kind=='bill')rows+=`<tr class="rt"><td colspan="${N-1}">${esc(r.name)} total</td><td>${inr(roomT(r))}</td></tr>`});
if(kind=='sum'&&p.depth=='floor')rows+=`<tr><td>${p.sr?(fx+1)+'. ':''}${esc(f.name)}</td><td class="r">${inr(floorT(f))}</td></tr>`;else if(kind!='meas')rows+=`<tr class="ft"><td colspan="${N-1}">${esc(f.name)} total</td><td>${inr(floorT(f))}</td></tr>`});
if(kind!='meas'&&S.floors.length){const c=calc(),adj=c.disc||c.tax||c.adv;rows+=`<tr class="${adj?'rt':'gt'}"><td colspan="${N-1}">${adj?'Sub-total':'Grand total'}</td><td>${inr(c.sub)}</td></tr>`+tx(N)}
if(!S.floors.length)rows=`<tr><td colspan="${N}">No ${L1()}s yet. Add them in Entry.</td></tr>`;
const head=`<tr>${cols.map((c,i)=>`<th class="${i&&kind!='meas'||i>0&&kind=='meas'?'r':''}">${c}</th>`).join('')}</tr>`;
const all=p.hdr=='all';
const dsel=kind=='sum'?`<label>Detail<select onchange="sp('depth',this.value);draw()"><option value="room" ${p.depth!='floor'?'selected':''}>${L1()}s and ${L2()}s</option><option value="floor" ${p.depth=='floor'?'selected':''}>${L1()} totals only</option></select></label>`:'';
return`${seg(kind)}<div class="row no-print">${dsel}<button class="b p" onclick="window.print()">Print / Save as PDF</button><span class="note">If Print does nothing here, open the page in a full browser tab.</span></div><div class="paper">${all?'':`<div class="hd1">${hdr(title)}</div>`}<table class="doc"><thead>${all?`<tr><th class="ph" colspan="${N}">${hdr(title)}</th></tr>`:''}${head}</thead><tbody>${rows}</tbody></table>${footer()}</div>`}
/* ---- v2 ---- */
function save(){try{localStorage.setItem(K,JSON.stringify(S,function(k,v){return this===S&&(k=='p'||k=='floors')?undefined:v}))}catch(e){}}
function totalOf(b){const sub=b.floors.reduce((a,f)=>a+f.rooms.reduce((x,r)=>x+roomT(r),0),0),p=b.p,disc=+p.disc||0,tax=Math.round((sub-disc)*(+p.gst||0)/100),total=sub-disc+tax,adv=+p.adv||0;return{sub,disc,tax,total,adv,bal:total-adv}}
function calc(){return totalOf(S)}
function words(n){n=Math.round(n);if(n<=0)return'Zero';const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];const t=x=>x<20?a[x]:b[Math.floor(x/10)]+(x%10?' '+a[x%10]:'');const h=x=>(x>99?a[Math.floor(x/100)]+' Hundred'+(x%100?' ':''):'')+(x%100?t(x%100):'');let s='';[[1e7,'Crore'],[1e5,'Lakh'],[1e3,'Thousand']].forEach(q=>{if(n>=q[0]){s+=t(Math.floor(n/q[0]))+' '+q[1]+' ';n%=q[0]}});return(s+h(n)).trim()}
function tx(N){const c=calc(),W=N-1;const r=(l,v,k)=>`<tr class="${k||'rt'}"><td colspan="${W}">${l}</td><td>${inr(v)}</td></tr>`;let s='';
if(c.disc)s+=r('Discount',-c.disc);if(c.tax)s+=r('GST @ '+(+S.p.gst)+'%',c.tax);if(c.disc||c.tax)s+=r('Total',c.total,'ft');if(c.adv)s+=r('Advance received',-c.adv)+r('Balance due',c.bal,'gt');
const w=c.adv?c.bal:c.total;if(w>0)s+=`<tr><td colspan="${N}" style="text-align:left;font-style:italic">Amount in words: Rupees ${words(w)} Only</td></tr>`;return s}
function sf(k,v){S.firm[k]=v;save()}
function logo(i){const fl=i.files[0];if(!fl)return;const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,240/im.width,120/im.height),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);S.firm.logo=c.toDataURL('image/png');save();draw()};im.src=rd.result};rd.readAsDataURL(fl)}
function hdr(title){const p=S.p,F=S.firm,l=a=>a.filter(Boolean).join(' &nbsp; ');return`<div class="ph"><div style="display:flex;gap:10px;align-items:center">${F.logo?`<img src="${F.logo}" alt="" style="height:52px;max-width:110px;object-fit:contain">`:''}<div><h2>${esc(F.name||'Firm name')}</h2>${F.addr?`<div>${esc(F.addr)}</div>`:''}<div>${l([F.phone&&'Ph: '+esc(F.phone),F.gstin&&'GSTIN: '+esc(F.gstin)])}</div></div></div><div style="margin-top:6px"><b>${title}</b> &nbsp; Bill no. ${esc(p.no)} &nbsp; Date: ${esc(p.date)}</div><div>${l(['Project: '+esc(p.name),'Client: '+esc(p.client),p.caddr&&esc(p.caddr),p.cgst&&'Client GSTIN: '+esc(p.cgst)])}</div></div>`}
function footer(){const L=footTxt().split('\n').filter(x=>x.trim()).slice(0,3).map(x=>`<div>${esc(x)}</div>`).join('');const bk=S.firm.bank?`<div style="margin-top:6px"><b>Bank details:</b> ${esc(S.firm.bank).replace(/\n/g,'<br>')}</div>`:'';return`<div class="foot">${L}${bk}<div class="sg"><span>Date: ____________</span><span>Signature: ____________________</span></div></div>`}
function go(v){view=v;if(['meas','bill','sum','items'].includes(v))lastDoc=v;draw();window.scrollTo(0,0)}
function seg(k){return`<div class="seg no-print">${[['meas','Measure'],['bill','Bill'],['sum','Summary'],['items','Items']].map(a=>`<button class="${k==a[0]?'on':''}" onclick="go('${a[0]}')">${a[1]}</button>`).join('')}</div>`}
function draw(){const isDoc=['meas','bill','sum','items'].includes(view);
const ic={bills:'<rect x="4" y="4" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="16" width="16" height="4" rx="1"/>',entry:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',rates:'<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>',project:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',doc:'<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'};
const tabs=[['bills','Bills','bills'],['entry','Entry','entry'],['rates','Rates','rates'],['project','Project','project'],[lastDoc,'Print','doc']];
document.getElementById('pn').textContent='Bill '+(S.p.no||'')+' \u00b7 '+(S.p.name||'Project not named');
document.getElementById('tabs').innerHTML=tabs.map(t=>`<button class="${(t[2]=='doc'?isDoc:view==t[0])?'on':''}" onclick="go('${t[0]}')"><svg viewBox="0 0 24 24">${ic[t[2]]}</svg>${t[1]}</button>`).join('');
let st=document.getElementById('pgn');if(!st){st=document.createElement('style');st.id='pgn';document.head.appendChild(st)}
st.textContent=S.p.pn?'@page{@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:10px}}':'';
document.getElementById('main').innerHTML=({bills:vBills,entry:vEntry,rates:vRates,project:vProject,meas:()=>vDoc('meas'),bill:()=>vDoc('bill'),sum:()=>vDoc('sum'),items:vItems})[view]()}
function newItem(id){return{id:nid(),rid:+id,n:1,l:[0,0],b:[0,0],h:[0,0],q:0,d:''}}
function addItem(f,r,id){if(!id)return;const it=newItem(id);S.ex=it.id;S.floors[f].rooms[r].items.push(it);ch()}
function addCustom(f,r){const id=nid();S.rates.push({id,name:'Custom item',unit:'nos',type:'count',rate:0,hidden:true});const it=newItem(id);S.ex=it.id;S.floors[f].rooms[r].items.push(it);ch()}
function pasteItem(f,r){if(!S.clip)return;const c=JSON.parse(JSON.stringify(S.clip));c.id=nid();S.ex=c.id;S.floors[f].rooms[r].items.push(c);ch()}
function addRoom(f){const F=S.floors[f];F.rooms.forEach(x=>x.c=true);F.rooms.push({id:nid(),name:L2()+' '+(F.rooms.length+1),items:S.rates.filter(x=>x.auto).map(x=>newItem(x.id))});ch()}
function cpRoom(f,r,c){const o=JSON.parse(JSON.stringify(S.floors[f].rooms[r]));o.id=nid();o.name+=' copy';o.c=false;o.items.forEach(it=>{it.id=nid();if(c){it.n=1;it.l=[0,0];it.b=[0,0];it.h=[0,0];it.q=0}});S.floors[f].rooms.forEach(x=>x.c=true);S.floors[f].rooms.splice(r+1,0,o);ch()}
function addFloor(){S.floors.forEach(f=>f.c=true);S.floors.push({id:nid(),name:L1()+' '+(S.floors.length+1),rooms:[]});ch()}
function tg(f){S.floors[f].c=!S.floors[f].c;ch()}
function tga(f,r){const o=S.floors[f].rooms[r];o.c=!o.c;ch()}
function colAll(v){S.floors.forEach(f=>{f.c=!!v;f.rooms.forEach(r=>r.c=!!v)});ch()}
function mvItem(f,r,i,d){const a=S.floors[f].rooms[r].items,j=i+d;if(j<0||j>=a.length)return;const t=a[i];a[i]=a[j];a[j]=t;ch()}
function itemRow2(f,r,i,it){if(!it.id)it.id=nid();const x=R(it.rid),t=x.type,u=esc(x.unit);
const sm=`${qty(it)} ${u} \u00d7 \u20b9${x.rate}${it.d?' \u00b7 '+esc(it.d):''}`;
if(S.ex!=it.id)return`<div class="ic cmp" onclick="S.ex=${it.id};draw()"><div class="ih"><div><b>${esc(x.name)}</b><div class="note">${sm}</div></div><span class="amt">${inr(amt(it))}</span></div></div>`;
const n=t=='direct'?`<label>Quantity (${u})<input type="number" inputmode="decimal" step="any" value="${it.q}" onchange="si(${f},${r},${i},'q',this.value)"></label>`:`<label>Nos<input type="number" inputmode="decimal" step="any" value="${it.n}" onchange="si(${f},${r},${i},'n',this.value)"></label>`;
const d=(k,lab)=>{const v=dv(it[k]),w=ft(it[k]),bad=(String(v).split('.')[1]||0)>11;return`<label>${lab} (feet.inches)<input type="text" inputmode="decimal" placeholder="e.g. 15.4" value="${esc(v)}" onchange="sdd(${f},${r},${i},'${k}',this.value)"><span class="note" ${bad?'style="color:#c0392b"':''}>${bad?'Inches must be 0\u201311':'= '+(Math.round(w*100)/100)+' ft'}</span></label>`};
return`<div class="ic open"><div class="ih"><b>${esc(x.name)}</b><span class="amt">${inr(amt(it))}</span></div>${x.hidden?customEd(x):''}<div class="ib">${n}${(t=='area'||t=='length'||t=='lenw'||t=='volume')?d('l','Length'):''}${(t=='area'||t=='lenw'||t=='volume')?d('b','Width'):''}${t=='volume'?d('h','Height'):''}</div><label class="rmk">Remarks (optional)<input value="${esc(it.d||'')}" onchange="S.floors[${f}].rooms[${r}].items[${i}].d=this.value;save()"></label><div class="ih"><span class="note">${sm}</span><span class="row"><button class="b" onclick="mvItem(${f},${r},${i},-1)">\u25b2</button><button class="b" onclick="mvItem(${f},${r},${i},1)">\u25bc</button><button class="b" onclick="cpItem(${f},${r},${i})">Copy</button><button class="b x" onclick="S.floors[${f}].rooms[${r}].items.splice(${i},1);S.ex=0;ch()">Remove</button><button class="b p" onclick="S.ex=0;draw()">Done</button></span></div></div>`}
function areaHTML(f,ri,r){return`<div class="rm"><div class="rhd"><button class="chev" onclick="tga(${f},${ri})">${r.c?'\u25b8':'\u25be'}</button><input class="rname" value="${esc(r.name)}" onchange="S.floors[${f}].rooms[${ri}].name=this.value;ch()"><b>${inr(roomT(r))}</b></div>`+(r.c?'':`<div class="row rh"><button class="b" onclick="cpRoom(${f},${ri},0)">Copy</button><button class="b" onclick="cpRoom(${f},${ri},1)">Copy, clear sizes</button><button class="b x" onclick="if(this.dataset.s){S.floors[${f}].rooms.splice(${ri},1);ch()}else{this.dataset.s=1;this.textContent='Sure?'}">Delete</button></div>`+r.items.map((it,ii)=>itemRow2(f,ri,ii,it)).join('')+`<div class="row addrow">${S.clip?`<button class="b p" onclick="pasteItem(${f},${ri})">Paste: ${esc(R(S.clip.rid).name)}</button>`:''}<button class="b" onclick="addCustom(${f},${ri})">+ Custom item</button><select onchange="addItem(${f},${ri},this.value)"><option value="">+ Add work item\u2026</option>${S.rates.filter(x=>!x.hidden).map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.unit)})</option>`).join('')}</select></div>`)+`</div>`}
function vEntry(){
const hd=S.floors.length?`<div class="row" style="justify-content:flex-end"><button class="b" onclick="colAll(1)">Collapse all</button><button class="b" onclick="colAll(0)">Expand all</button></div>`:'';
const h=S.floors.map((f,fx)=>{const T1=floorT(f);
return`<div class="card fcard"><div class="fhd"><button class="chev" onclick="tg(${fx})">${f.c?'\u25b8':'\u25be'}</button><input class="fname" value="${esc(f.name)}" onchange="S.floors[${fx}].name=this.value;ch()"><b class="ftt">${inr(T1)}</b></div>`+
(f.c?'':`<div class="row fh"><button class="b" onclick="addRoom(${fx})">Add ${L2()}</button><select onchange="addAll(${fx},this.value)"><option value="">+ Item in every ${L2()}\u2026</option>${S.rates.filter(x=>!x.hidden).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button class="b x" onclick="if(this.dataset.s){S.floors.splice(${fx},1);ch()}else{this.dataset.s=1;this.textContent='Sure?'}">Delete ${L1()}</button></div>`+f.rooms.map((r,rx)=>areaHTML(fx,rx,r)).join('')+`<div class="tot ftot"><span>${esc(f.name)} total</span><b>${inr(T1)}</b></div>`)+`</div>`}).join('');
return clipBar()+hd+h+`<button class="b p wide" onclick="addFloor()">Add ${L1()}</button>`+(S.floors.length?`<div class="card gbar"><span>Total payable</span><b>${inr(calc().total)}</b></div>`:`<div class="empty"><b>No ${L1()} yet</b><span>Add a ${L1()} to begin, then ${L2()}s and work items.</span></div>`)}
function vProject(){const p=S.p,F=S.firm;
const f=(k,l,n)=>`<label>${l}<input ${n?'inputmode="decimal" ':''}value="${esc(p[k])}" onchange="sp('${k}',this.value)"></label>`;
const g=(k,l)=>`<label>${l}<input value="${esc(F[k])}" onchange="sf('${k}',this.value)"></label>`;
const o=(k,v,l,d)=>`<option value="${v}" ${(p[k]===undefined?d:p[k])==v?'selected':''}>${l}</option>`;
const yn=(k,a,b)=>`<select onchange="sp('${k}',this.value==='1')"><option value="">${a}</option><option value="1" ${p[k]?'selected':''}>${b}</option></select>`;
return`<div class="card"><h3>Bill details</h3><div class="grid">${f('name','Project / site')}${f('client','Client name')}${f('caddr','Client address')}${f('cgst','Client GSTIN')}${f('no','Bill no.')}<label>Date<input type="date" value="${esc(p.date)}" onchange="sp('date',this.value)"></label>${f('l1','First level name (default: Section)')}${f('l2','Second level name (default: Area)')}</div></div>
<div class="card"><h3>Amounts</h3><div class="grid">${f('disc','Discount (\u20b9)',1)}${f('gst','GST % (0 = none)',1)}${f('adv','Advance received (\u20b9)',1)}</div><p class="note">Shown at the end of the bill and summary, with the amount in words.</p></div>
<div class="card"><h3>Your firm (used on all bills)</h3><div class="grid">${g('name','Firm name')}${g('addr','Address')}${g('phone','Phone')}${g('gstin','GSTIN')}</div><label style="margin-top:10px">Bank details (printed at the bottom)<textarea class="ta" rows="3" onchange="sf('bank',this.value)">${esc(F.bank)}</textarea></label><div class="row"><label>Logo<input type="file" accept="image/*" onchange="logo(this)"></label>${F.logo?`<img src="${F.logo}" alt="" style="height:40px"><button class="b x" onclick="sf('logo','');draw()">Remove logo</button>`:''}</div></div>
<div class="card"><h3>Print settings</h3><div class="grid"><label>Page header<select onchange="sp('hdr',this.value)">${o('hdr','all','Repeat on every page','all')}${o('hdr','first','First page only','all')}</select></label><label>Numbering<select onchange="sp('sr',this.value==='1')"><option value="">No serial numbers</option><option value="1" ${p.sr?'selected':''}>Number the rows (1, 2, 3\u2026)</option></select></label><label>Page numbers<select onchange="sp('pn',this.value==='1')"><option value="">Off</option><option value="1" ${p.pn?'selected':''}>Page 1 of N (Chrome/Edge)</option></select></label><label>Page break<select onchange="sp('pb',this.value)">${o('pb','room','New page for each '+L2(),'room')}${o('pb','floor','New page for each '+L1(),'room')}${o('pb','none','Continuous','room')}</select></label></div><label style="margin-top:10px">Footer lines (up to 3, printed with date and signature)<textarea class="ta" rows="3" onchange="sp('foot',this.value)">${esc(footTxt())}</textarea></label></div>`}
function nextNo(){return String(Math.max(0,...S.bills.map(b=>parseInt(b.p.no)||0))+1)}
function mkB(src,keep){const p=Object.assign({},src.p,{no:nextNo(),date:new Date().toISOString().slice(0,10)});if(!keep)Object.assign(p,{name:'',client:'',caddr:'',cgst:'',disc:'',gst:'',adv:''});return{id:nid(),p,floors:keep?JSON.parse(JSON.stringify(src.floors)):[]}}
function openB(id){const b=S.bills.find(x=>x.id==id);S.bid=id;S.p=b.p;S.floors=b.floors;S.ex=0;view='entry';save();draw();window.scrollTo(0,0)}
function newB(){const b=mkB(S,0);S.bills.unshift(b);openB(b.id)}
function dupB(id){const s=S.bills.find(x=>x.id==id),b=mkB(s,1);b.p.name=(s.p.name||'Untitled')+' (copy)';S.bills.unshift(b);openB(b.id)}
function delB(id){S.bills=S.bills.filter(x=>x.id!=id);if(!S.bills.length)S.bills.push(mkB(S,0));if(id==S.bid)openB(S.bills[0].id);else{save();draw()}}
function vBills(){return`<button class="b p wide" onclick="newB()">+ New bill</button><div style="height:12px"></div>`+S.bills.map(b=>{const c=totalOf(b);return`<div class="card bl ${b.id==S.bid?'cur':''}"><div class="ih"><div><b>Bill ${esc(b.p.no)} \u00b7 ${esc(b.p.name||'Untitled')}</b><div class="note">${esc(b.p.client||'No client')} \u00b7 ${esc(b.p.date||'')}</div></div><b>${inr(c.total)}</b></div><div class="row"><button class="b p" onclick="openB(${b.id})">${b.id==S.bid?'Open (current)':'Open'}</button><button class="b" onclick="dupB(${b.id})">Duplicate</button><button class="b x" onclick="if(this.dataset.s){delB(${b.id})}else{this.dataset.s=1;this.textContent='Sure?'}">Delete</button></div></div>`}).join('')}
function vItems(){const p=S.p,m={};S.floors.forEach(f=>f.rooms.forEach(r=>r.items.forEach(it=>{const x=R(it.rid),o=m[it.rid]||(m[it.rid]={x,q:0,a:0});o.q+=qty(it);o.a+=amt(it)})));
const rows=Object.values(m).map((o,i)=>`<tr><td>${p.sr?(i+1)+'. ':''}${esc(o.x.name)}</td><td class="r">${Math.round(o.q*100)/100}</td><td>${esc(o.x.unit)}</td><td class="r">${o.x.rate}</td><td class="r">${inr(o.a)}</td></tr>`).join('')||'<tr><td colspan="5">No items yet.</td></tr>';
const all=p.hdr!='first',hd=hdr('Item-wise totals');
return`${seg('items')}<div class="row no-print"><button class="b p" onclick="window.print()">Print / Save as PDF</button></div><div class="paper">${all?'':`<div class="hd1">${hd}</div>`}<table class="doc"><thead>${all?`<tr><th class="ph" colspan="5">${hd}</th></tr>`:''}<tr><th>Item</th><th class="r">Qty</th><th>Unit</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}<tr class="gt"><td colspan="4">Total</td><td>${inr(grand())}</td></tr></tbody></table>${footer()}</div>`}

/* ---- v3: print studio ---- */
let PVK=0;
const DN={sum:'Summary bill (master)',bill:'Individual bill',meas:'Measurement sheet',items:'Item totals'},DN2={sum:'Summary',bill:'Bill',meas:'Measure',items:'Items'};
function PR(){const d={paper:'a4',ori:'p',mg:12,fs:9,inc:{sum:1,bill:1,meas:1,items:0},ord:['sum','bill','meas','items'],sig:'last',sw:35,pn:true,pv:'bill'};return S.pr=Object.assign(d,S.pr)}
function po(k,v){PR()[k]=v;save();prv()}
function pp(k,v){S.p[k]=v;save();prv()}
function pinc(k,c){PR().inc[k]=c?1:0;save();draw()}
function pmv(k,d){const o=PR().ord,i=o.indexOf(k),j=i+d;if(j<0||j>=o.length)return;const t=o[i];o[i]=o[j];o[j]=t;save();draw()}
function pvSel(k){PR().pv=k;save();prv()}
function prv(){const e=document.getElementById('pv');if(e)e.innerHTML=pvHTML()}
function sigUp(i){const fl=i.files[0];if(!fl)return;const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,400/im.width,200/im.height),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);S.firm.sig=c.toDataURL('image/png');save();draw()};im.src=rd.result};rd.readAsDataURL(fl)}
function footer(){const L=footTxt().split('\n').filter(x=>x.trim()).slice(0,3).map(x=>`<div>${esc(x)}</div>`).join('');const bk=S.firm.bank?`<div style="margin-top:6px"><b>Bank details:</b> ${esc(S.firm.bank).replace(/\n/g,'<br>')}</div>`:'';const sg=(PVK&&S.firm.sig)?`<img src="${S.firm.sig}" alt="" style="height:${Math.round((+PR().sw||35)*0.6)}mm;max-width:${+PR().sw||35}mm;display:block;margin-left:auto">`:'';return`<div class="foot">${L}${bk}${sg}<div class="sg"><span>Date: ____________</span><span>Signature: ____________________</span></div></div>`}
function pvHTML(){const O=PR(),inc=O.ord.filter(k=>O.inc[k]);if(!inc.length)return'<div class="empty"><b>Nothing selected</b><span>Tick at least one document above.</span></div>';const k=inc.includes(O.pv)?O.pv:inc[0];PVK=(O.sig=='all'||(O.sig=='last'&&k==inc[inc.length-1]))?1:0;const h=k=='items'?vItems():vDoc(k),pg=h.slice(h.indexOf('<div class="paper">'));
return`<div class="seg no-print">${inc.map(x=>`<button class="${x==k?'on':''}" onclick="pvSel('${x}')">${DN2[x]}</button>`).join('')}</div><div style="--pfs:${(+O.fs||9)*1.3}px;max-width:${O.ori=='l'?1000:794}px;margin:0 auto">${pg}</div>`}
function printAll(){const O=PR(),inc=O.ord.filter(k=>O.inc[k]);let h='';inc.forEach((k,i)=>{PVK=(O.sig=='all'||(O.sig=='last'&&i==inc.length-1))?1:0;const s=k=='items'?vItems():vDoc(k);h+=s.slice(s.indexOf('<div class="paper">'))});document.getElementById('pall').innerHTML=h;document.body.classList.add('pa');try{window.print()}catch(e){}setTimeout(()=>{document.body.classList.remove('pa');document.getElementById('pall').innerHTML=''},800)}
function vPrint(){const O=PR(),p=S.p,F=S.firm;
const op=(s,v,l)=>`<option value="${v}" ${s==v?'selected':''}>${l}</option>`;
const dt=(id,t,body,d)=>`<details class="card no-print" ${(S.ui&&S.ui[id]!==undefined?S.ui[id]:d)?'open':''} ontoggle="S.ui=S.ui||{};S.ui['${id}']=this.open"><summary>${t}</summary>${body}</details>`;
const docs=O.ord.map(k=>`<div class="dl"><input type="checkbox" ${O.inc[k]?'checked':''} onchange="pinc('${k}',this.checked)"><span>${DN[k]}</span><button class="b" onclick="pmv('${k}',-1)">\u25b2</button><button class="b" onclick="pmv('${k}',1)">\u25bc</button></div>`).join('');
const n=O.ord.filter(k=>O.inc[k]).length;
return`<div class="card no-print"><h3>Export</h3><p class="note">${n} document${n==1?'':'s'} in one PDF, in the order set below.</p><div class="row"><button class="b p" id="dlb" onclick="dlPDF()">Download PDF</button><button class="b" onclick="printAll()">Print\u2026</button></div><div id="pst" class="note"></div></div>`+
dt('docs','Documents in the PDF',docs+'<p class="note">Use \u25b2 \u25bc to change the order.</p>',1)+
dt('pg','Page setup',`<div class="grid"><label>Paper<select onchange="po('paper',this.value)">${op(O.paper,'a4','A4')}${op(O.paper,'letter','Letter')}${op(O.paper,'a3','A3')}</select></label><label>Orientation<select onchange="po('ori',this.value)">${op(O.ori,'p','Portrait')}${op(O.ori,'l','Landscape')}</select></label><label>Margins (mm)<input type="number" inputmode="decimal" value="${O.mg}" onchange="po('mg',+this.value)"></label><label>Text size<select onchange="po('fs',+this.value)">${[8,9,10,11,12].map(x=>op(O.fs,x,x+' pt')).join('')}</select></label></div>`,0)+
dt('ly','Header, numbering and footer',`<div class="grid"><label>Page header<select onchange="pp('hdr',this.value)">${op(p.hdr||'all','all','Repeat on every page')}${op(p.hdr||'all','first','First page only')}</select></label><label>Page break<select onchange="pp('pb',this.value)">${op(p.pb||'room','room','New page for each '+L2())}${op(p.pb||'room','floor','New page for each '+L1())}${op(p.pb||'room','none','Continuous')}</select></label><label>Row numbers<select onchange="pp('sr',this.value==='1')">${op(p.sr?'1':'','','Off')}${op(p.sr?'1':'','1','1, 2, 3\u2026')}</select></label><label>Summary detail<select onchange="pp('depth',this.value)">${op(p.depth||'room','room',L1()+'s and '+L2()+'s')}${op(p.depth||'room','floor',L1()+' totals only')}</select></label><label>Page numbers<select onchange="po('pn',this.value==='1')">${op(O.pn?'1':'','1','Page 1 of N')}${op(O.pn?'1':'','','Off')}</select></label></div><label style="margin-top:10px">Footer lines (up to 3)<textarea class="ta" rows="3" onchange="pp('foot',this.value)">${esc(footTxt())}</textarea></label>`,0)+
dt('sg','Digital signature',`<div class="row"><label>Signature image (PNG)<input type="file" accept="image/png,image/*" onchange="sigUp(this)"></label>${F.sig?`<img src="${F.sig}" alt="" style="height:44px;background:#fff;border:1px solid var(--bd);border-radius:6px"><button class="b x" onclick="S.firm.sig='';save();draw()">Remove</button>`:''}</div><div class="grid"><label>Show signature on<select onchange="po('sig',this.value)">${op(O.sig,'last','Last document only')}${op(O.sig,'all','Every document')}${op(O.sig,'off','Blank line only')}</select></label><label>Width (mm)<input type="range" min="20" max="70" value="${O.sw}" oninput="po('sw',+this.value)"></label></div><p class="note">Use a PNG with a transparent background so the signature sits cleanly on the line.</p>`,0)+
`<div class="card no-print"><h3>Preview</h3><div id="pv">${pvHTML()}</div><p class="note">The preview shows content and styling. In the PDF, rows are never split and page breaks are exact.</p></div>`}
function pdfChunks(k,N,num){const p=S.p,sn=i=>p.sr?(i+1)+'. ':'';
const FL={fillColor:[43,43,43],textColor:255,fontStyle:'bold'},RM={fillColor:[226,226,226],fontStyle:'bold'},RT={fillColor:[244,244,244],fontStyle:'bold'},FT={fillColor:[189,189,189],fontStyle:'bold'};
const hr=(t,st)=>[{content:t,colSpan:N,styles:st}];
const tr=(l,v,st)=>[{content:l,colSpan:N-1,styles:Object.assign({halign:'right'},st)},{content:v,styles:Object.assign({halign:'right'},st)}];
if(k=='items'){const m={};S.floors.forEach(f=>f.rooms.forEach(r=>r.items.forEach(it=>{const x=R(it.rid),o=m[it.rid]||(m[it.rid]={x,q:0,a:0});o.q+=qty(it);o.a+=amt(it)})));const rows=Object.values(m).map((o,i)=>[sn(i)+o.x.name,String(Math.round(o.q*100)/100),o.x.unit,String(o.x.rate),num(o.a)]);rows.push(tr('Total',num(grand()),{fillColor:[0,0,0],textColor:255,fontStyle:'bold'}));return[rows]}
if(k=='sum'){const rows=[];S.floors.forEach((f,fx)=>{if(p.depth=='floor')rows.push([sn(fx)+f.name,num(floorT(f))]);else{rows.push(hr(f.name,FL));f.rooms.forEach((r,rx)=>rows.push([sn(rx)+r.name,num(roomT(r))]));rows.push(tr(f.name+' total',num(floorT(f)),FT))}});return[rows]}
const ch=[];let cur=[];const cut=()=>{if(cur.length){ch.push(cur);cur=[]}};
S.floors.forEach(f=>{if(p.pb!='none')cut();cur.push(hr(f.name,FL));
f.rooms.forEach((r,rx)=>{if(p.pb=='room'&&rx>0)cut();cur.push(hr(r.name,RM));
r.items.forEach((it,ix)=>{const x=R(it.rid),t=x.type,nm=sn(ix)+x.name+(it.d?'\n'+it.d:'');
if(k=='meas')cur.push([nm,t=='direct'?'':String(it.n),(t=='area'||t=='length'||t=='lenw'||t=='volume')?fi(it.l):'',(t=='area'||t=='lenw'||t=='volume')?fi(it.b):'',t=='volume'?fi(it.h):'',String(qty(it)),x.unit]);
else cur.push([nm,String(qty(it)),x.unit,String(x.rate),num(amt(it))])});
if(k=='bill')cur.push(tr(r.name+' total',num(roomT(r)),RT))});
if(k=='bill')cur.push(tr(f.name+' total',num(floorT(f)),FT))});
cut();return ch.length?ch:[[hr('No entries yet',{})]]}
function mkPDF(){const J=window.jspdf;if(!J)throw new Error('PDF library did not load. Check your internet connection.');
const O=PR(),p=S.p,F=S.firm,doc=new J.jsPDF({unit:'mm',format:O.paper,orientation:O.ori}),pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),m=Math.max(5,+O.mg||12),fs=+O.fs||9,num=x=>Number(x).toLocaleString('en-IN'),list=O.ord.filter(k=>O.inc[k]),hdrAll=p.hdr!='first';
if(!list.length)throw new Error('Select at least one document.');
const TT={sum:'SUMMARY BILL',bill:'BILL',meas:'MEASUREMENT SHEET',items:'ITEM-WISE TOTALS'};
const cols={bill:['Item','Qty','Unit','Rate','Amount (Rs.)'],meas:['Item','Nos','Length','Breadth','Height','Qty','Unit'],sum:['Category','Amount (Rs.)'],items:['Item','Qty','Unit','Rate','Amount (Rs.)']};
const rt={halign:'right'},cs={bill:{1:rt,3:rt,4:rt},items:{1:rt,3:rt,4:rt},meas:{1:rt,2:rt,3:rt,4:rt,5:rt},sum:{1:rt}};
function drawHdr(title){let y=m,x=m;
if(F.logo){try{const ip=doc.getImageProperties(F.logo),h=14,w=Math.min(36,h*ip.width/ip.height);doc.addImage(F.logo,'PNG',m,y,w,h);x=m+w+3}catch(e){}}
doc.setFont('helvetica','bold');doc.setFontSize(fs+6);doc.text(F.name||'Firm name',x,y+5.5);
doc.setFont('helvetica','normal');doc.setFontSize(fs);let yy=y+10.5;
[F.addr,[F.phone&&'Ph: '+F.phone,F.gstin&&'GSTIN: '+F.gstin].filter(Boolean).join('    ')].filter(Boolean).forEach(t=>{const s=doc.splitTextToSize(String(t),pw-m-x);doc.text(s,x,yy);yy+=4.4*s.length});
y=Math.max(yy,y+(F.logo?15:0))+0.5;
doc.setFont('helvetica','bold');doc.text(title+'     Bill no. '+(p.no||'')+'     Date: '+(p.date||''),m,y+3.5);y+=4.5;doc.setFont('helvetica','normal');
[['Project: '+(p.name||''),'Client: '+(p.client||'')].join('     '),p.caddr,p.cgst&&'Client GSTIN: '+p.cgst].filter(Boolean).forEach(t=>{const s=doc.splitTextToSize(String(t),pw-2*m);doc.text(s,m,y+3.5);y+=4.4*s.length});
doc.setDrawColor(0);doc.setLineWidth(.4);doc.line(m,y+1,pw-m,y+1);doc.setLineWidth(.1);return y+4}
list.forEach((k,li)=>{const N=cols[k].length,title=TT[k];if(li>0)doc.addPage();let pg0=doc.internal.getNumberOfPages();const hh=drawHdr(title),chunks=pdfChunks(k,N,num);
if(k=='bill'||k=='sum'){const c=calc(),adj=c.disc||c.tax||c.adv,last=chunks[chunks.length-1],T=(l,v,st)=>[{content:l,colSpan:N-1,styles:Object.assign({halign:'right',fontStyle:'bold'},st)},{content:v,styles:Object.assign({halign:'right',fontStyle:'bold'},st)}];
last.push(adj?T('Sub-total',num(c.sub),{fillColor:[244,244,244]}):T('Grand total',num(c.sub),{fillColor:[0,0,0],textColor:255}));
if(c.disc)last.push(T('Discount','-'+num(c.disc)));if(c.tax)last.push(T('GST @ '+(+p.gst)+'%',num(c.tax)));if(c.disc||c.tax)last.push(T('Total',num(c.total),{fillColor:[189,189,189]}));
if(c.adv){last.push(T('Advance received','-'+num(c.adv)));last.push(T('Balance due',num(c.bal),{fillColor:[0,0,0],textColor:255}))}
const w=c.adv?c.bal:c.total;if(w>0)last.push([{content:'Amount in words: Rupees '+words(w)+' Only',colSpan:N,styles:{halign:'left',fontStyle:'italic'}}])}
chunks.forEach((rows,ci)=>{if(ci>0){doc.addPage();pg0=doc.internal.getNumberOfPages();if(hdrAll)drawHdr(title)}
doc.autoTable({head:[cols[k]],body:rows,startY:(hdrAll||ci==0)?hh:m,margin:{left:m,right:m,top:hdrAll?hh:m,bottom:m+6},theme:'grid',styles:{font:'helvetica',fontSize:fs,cellPadding:1.5,lineColor:[120,120,120],lineWidth:.1,textColor:0,overflow:'linebreak'},headStyles:{fillColor:[235,235,235],textColor:0,fontStyle:'bold'},columnStyles:cs[k],rowPageBreak:'avoid',didDrawPage:()=>{if(doc.internal.getCurrentPageInfo().pageNumber>pg0&&hdrAll)drawHdr(title)}})});
let y=doc.lastAutoTable.finalY+6;const lines=footTxt().split('\n').filter(x=>x.trim()).slice(0,3),bank=F.bank?F.bank.split('\n').filter(Boolean):[],showSig=O.sig=='all'||(O.sig=='last'&&li==list.length-1),sw=+O.sw||35;let sh=0;if(F.sig&&showSig){try{const ip=doc.getImageProperties(F.sig);sh=sw*ip.height/ip.width}catch(e){}}
const fh=lines.length*4.6+(bank.length?bank.length*4.6+6:0)+Math.max(sh,10)+16;
if(y+fh>ph-m-6){doc.addPage();pg0=doc.internal.getNumberOfPages();y=hdrAll?drawHdr(title)+4:m}
doc.setFont('helvetica','normal');doc.setFontSize(fs);
lines.forEach(t=>{const s=doc.splitTextToSize(t,pw-2*m);doc.text(s,m,y);y+=s.length*4.4});
if(bank.length){y+=2;doc.setFont('helvetica','bold');doc.text('Bank details:',m,y);doc.setFont('helvetica','normal');y+=4.4;bank.forEach(t=>{doc.text(t,m,y);y+=4.4})}
y+=6;if(sh)doc.addImage(F.sig,'PNG',pw-m-sw,y,sw,sh);
const ly=y+Math.max(sh,10)+2;doc.setLineWidth(.2);doc.line(pw-m-60,ly,pw-m,ly);doc.text('Signature',pw-m-60,ly+4.5);doc.text('Date: ______________',m,ly+4.5)});
if(O.pn){const n=doc.internal.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Page '+i+' of '+n,pw-m,ph-6,{align:'right'})}}
return doc}
async function dlPDF(){const st=document.getElementById('pst'),b=document.getElementById('dlb'),say=t=>{if(st)st.textContent=t};
try{b.disabled=true;say('Building PDF\u2026');const doc=mkPDF(),dl=window.claude?await window.claude.use('downloads'):null;
if(!dl){say('Direct download is not available in this view. Use Print and choose Save as PDF.');return}
const nm=('Bill '+(S.p.no||'')+(S.p.name?' - '+S.p.name:'')).replace(/[^\w .()-]/g,'').trim()+'.pdf';
await dl.save({filename:nm,data:doc.output('arraybuffer')});say('PDF ready.')}
catch(e){say(e&&e.code=='declined'?'Save cancelled.':'Could not create the PDF: '+((e&&e.message)||e))}finally{b.disabled=false}}
function draw(){const ic={bills:'<rect x="4" y="4" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="16" width="16" height="4" rx="1"/>',entry:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',rates:'<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>',project:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',doc:'<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'};
const tabs=[['bills','Bills','bills'],['entry','Entry','entry'],['rates','Rates','rates'],['project','Project','project'],['print','Print','doc']];
document.getElementById('pn').textContent='Bill '+(S.p.no||'')+' \u00b7 '+(S.p.name||'Project not named');
document.getElementById('tabs').innerHTML=tabs.map(t=>`<button class="${view==t[0]?'on':''}" onclick="go('${t[0]}')"><svg viewBox="0 0 24 24">${ic[t[2]]}</svg>${t[1]}</button>`).join('');
PVK=0;document.getElementById('main').innerHTML=({bills:vBills,entry:vEntry,rates:vRates,project:()=>vProject().replace(/<div class="card"><h3>Print settings<\/h3>[\s\S]*$/,''),print:vPrint,meas:()=>vDoc('meas'),bill:()=>vDoc('bill'),sum:()=>vDoc('sum'),items:vItems})[view]()}

draw();
