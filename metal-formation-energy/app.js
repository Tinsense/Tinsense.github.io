const data=(window.FORMATION_DATA||[]).filter(d=>Number.isFinite(d.sulfide_e)&&Number.isFinite(d.chloride_e));
const meta=window.FORMATION_META||{};
const svg=document.getElementById('plot'),tip=document.getElementById('tip'),NS='http://www.w3.org/2000/svg';
const groups={
  alkali:new Set(['Li','Be','Na','Mg','K','Ca','Rb','Sr','Cs','Ba','Fr','Ra']),
  post:new Set(['Al','Ga','In','Sn','Sb','Tl','Pb','Bi','Po']),
  lanth:new Set(['La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf'])
};
const colors={alkali:'#2563eb',transition:'#0f766e',post:'#c2410c',lanth:'#7c3aed'};
function group(m){return groups.alkali.has(m)?'alkali':groups.post.has(m)?'post':groups.lanth.has(m)?'lanth':'transition'}
function E(n,a={}){const e=document.createElementNS(NS,n);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e}
function fmt(v){return Number(v).toFixed(3)}
function formulaHTML(s){return String(s||'—').replace(/(\d+)/g,'<sub>$1</sub>')}
function entryUrl(id){return id?`https://materialsproject.org/materials/${id}`:'https://materialsproject.org/'}
function render(){
  document.getElementById('pointCount').textContent=data.length||'0';
  const dt=meta.generated_at_utc?new Date(meta.generated_at_utc):null;
  document.getElementById('updatedAt').textContent=dt&&!isNaN(dt)?dt.toISOString().slice(0,10):'pending';
  document.getElementById('sourceText').textContent=`Source: ${meta.source||'Materials Project'} · snapshot ${meta.snapshot_date||'—'} · ${meta.energy_unit||'eV/atom'}`;
  svg.innerHTML='';
  if(!data.length){
    const t=E('text',{x:460,y:360,'text-anchor':'middle','font-size':18,fill:'#64748b'});
    t.textContent='数据正在生成；请稍后刷新页面';svg.appendChild(t);return;
  }
  const W=920,H=760,ml=92,mr=28,mt=42,mb=82,iw=W-ml-mr,ih=H-mt-mb;
  const vals=data.flatMap(d=>[d.sulfide_e,d.chloride_e]);
  const rawMin=Math.min(...vals),rawMax=Math.max(...vals,0);
  const pad=Math.max(.15,(rawMax-rawMin)*.08);
  const lo=Math.floor((rawMin-pad)*5)/5,hi=Math.min(.2,Math.ceil((rawMax+pad)*5)/5);
  const X=v=>ml+(v-lo)/(hi-lo)*iw,Y=v=>mt+ih-(v-lo)/(hi-lo)*ih;
  svg.appendChild(E('polygon',{points:`${X(lo)},${Y(lo)} ${X(hi)},${Y(lo)} ${X(hi)},${Y(hi)}`,fill:'rgba(13,148,136,.055)'}));
  svg.appendChild(E('polygon',{points:`${X(lo)},${Y(lo)} ${X(lo)},${Y(hi)} ${X(hi)},${Y(hi)}`,fill:'rgba(37,99,235,.045)'}));
  const ticks=7;
  for(let i=0;i<=ticks;i++){
    const v=lo+(hi-lo)*i/ticks,x=X(v),y=Y(v);
    svg.appendChild(E('line',{x1:x,y1:mt,x2:x,y2:mt+ih,stroke:'#e5e7eb','stroke-width':1}));
    svg.appendChild(E('line',{x1:ml,y1:y,x2:ml+iw,y2:y,stroke:'#e5e7eb','stroke-width':1}));
    let tx=E('text',{x,y:H-45,'text-anchor':'middle','font-size':11,fill:'#64748b'});tx.textContent=v.toFixed(1);svg.appendChild(tx);
    let ty=E('text',{x:ml-13,y:y+4,'text-anchor':'end','font-size':11,fill:'#64748b'});ty.textContent=v.toFixed(1);svg.appendChild(ty);
  }
  svg.appendChild(E('line',{x1:X(lo),y1:Y(lo),x2:X(hi),y2:Y(hi),stroke:'#475569','stroke-width':1.5,'stroke-dasharray':'7 6'}));
  svg.appendChild(E('line',{x1:ml,y1:mt+ih,x2:ml+iw,y2:mt+ih,stroke:'#0f172a','stroke-width':1.4}));
  svg.appendChild(E('line',{x1:ml,y1:mt,x2:ml,y2:mt+ih,stroke:'#0f172a','stroke-width':1.4}));
  let xt=E('text',{x:ml+iw/2,y:H-10,'text-anchor':'middle','font-size':14,'font-weight':700,fill:'#0f172a'});xt.textContent='最稳定二元氯化物形成能  E_f(M–Cl)  / eV atom⁻¹';svg.appendChild(xt);
  let yt=E('text',{x:22,y:mt+ih/2,'text-anchor':'middle','font-size':14,'font-weight':700,fill:'#0f172a',transform:`rotate(-90 22 ${mt+ih/2})`});yt.textContent='最稳定二元硫化物形成能  E_f(M–S)  / eV atom⁻¹';svg.appendChild(yt);
  let a=E('text',{x:X(lo)+(iw*.18),y:Y(hi)+(ih*.12),'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#2563eb'});a.textContent='氯化物形成能更负';svg.appendChild(a);
  let b=E('text',{x:X(hi)-(iw*.18),y:Y(lo)-(ih*.10),'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#0f766e'});b.textContent='硫化物形成能更负';svg.appendChild(b);
  data.forEach((d,i)=>{
    const cx=X(d.chloride_e),cy=Y(d.sulfide_e),g=group(d.m);
    const p=E('circle',{cx,cy,r:5.7,fill:colors[g],stroke:'#fff','stroke-width':1.4});p.style.cursor='crosshair';
    const show=(ev)=>{
      const delta=d.delta_s_minus_cl;
      const verdict=delta<0?`<span class="good">硫化物更负 ${Math.abs(delta).toFixed(3)} eV/atom</span>`:`<span class="warm">氯化物更负 ${Math.abs(delta).toFixed(3)} eV/atom</span>`;
      tip.innerHTML=`<b>${d.m}</b><br>M–S: ${formulaHTML(d.sulfide_formula)} <span class="muted">#${d.sulfide_entry_id??'—'}</span><br>E<sub>f</sub> = ${fmt(d.sulfide_e)} eV/atom · E<sub>hull</sub> = ${Number(d.sulfide_e_hull||0).toFixed(6)}<br>stable phases: ${d.sulfide_stable_count}<br>M–Cl: ${formulaHTML(d.chloride_formula)} <span class="muted">#${d.chloride_entry_id??'—'}</span><br>E<sub>f</sub> = ${fmt(d.chloride_e)} eV/atom · E<sub>hull</sub> = ${Number(d.chloride_e_hull||0).toFixed(6)}<br>stable phases: ${d.chloride_stable_count}<br>Δ(S−Cl) = ${delta>=0?'+':''}${fmt(delta)} eV/atom<br>${verdict}`;
      tip.style.display='block';
      const wrap=svg.parentElement.getBoundingClientRect(),px=ev.clientX-wrap.left+14,py=ev.clientY-wrap.top+14;
      tip.style.left=Math.min(px,wrap.width-340)+'px';tip.style.top=Math.max(8,py)+'px';
    };
    p.addEventListener('pointerenter',show);p.addEventListener('pointermove',show);p.addEventListener('pointerleave',()=>tip.style.display='none');
    p.addEventListener('click',()=>window.open(entryUrl(d.sulfide_entry_id),'_blank','noopener'));svg.appendChild(p);
    const lab=E('text',{x:cx+7,y:cy+(i%2?11:-7),'font-size':9.7,'font-weight':600,fill:'#334155'});lab.textContent=d.m;lab.style.pointerEvents='none';svg.appendChild(lab);
  });
}
render();
