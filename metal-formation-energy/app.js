
const data=(window.FORMATION_DATA||[]).filter(d=>Number.isFinite(d.sulfide_e)&&Number.isFinite(d.chloride_e));
const phases=window.FORMATION_PHASES||{};
const meta=window.FORMATION_META||{};
const svg=document.getElementById('plot'),tip=document.getElementById('tip'),NS='http://www.w3.org/2000/svg';
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const LINA=new Set(['Li','Na']);
const REPORTED_SCL3={
  Be:['[SCl3][BeCl3]'],
  Al:['[SCl3][AlCl4]'],
  Ga:['[SCl3][GaCl4]','[SCl3][Ga2Cl7]'],
  In:['[SCl3][InCl4]'],
  Ti:['[SCl3][Ti2Cl9]','[SCl3]2[TiCl6]'],
  Sn:['[SCl3]2[SnCl6]'],
  Hf:['[SCl3]2[HfCl6]','[SCl3][Hf2Cl9]'],
  Fe:['[SCl3][FeCl4]'],
  Au:['[SCl3][AuCl4]'],
  Sb:['[SCl3][SbCl6]'],
  Nb:['[SCl3][NbCl6]'],
  Ta:['[SCl3][TaCl6]'],
  Mo:['[SCl3][MoCl6]'],
  Os:['[SCl3][OsCl6]','[SCl3]2[OsCl6]'],
  Ir:['[SCl3]2[IrCl6]']
};

function E(n,a={}){const e=document.createElementNS(NS,n);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e}
function fmt(v){return Number(v).toFixed(3)}
function oxi(v){if(v==null||!Number.isFinite(Number(v)))return '—';const n=Number(v);return (n>0?'+':'')+(Math.abs(n-Math.round(n))<1e-6?Math.round(n):n.toFixed(2))}
function formulaHTML(s){return String(s||'—').replace(/(\d+)/g,'<sub>$1</sub>')}
function mpUrl(id){return id?'https://materialsproject.org/materials/'+id:'https://materialsproject.org/'}
function pointColor(m){return LINA.has(m)?'#38bdf8':REPORTED_SCL3[m]?'#fb7185':(getComputedStyle(document.documentElement).getPropertyValue('--plot-label').trim()||'#64748b')}
function pointRadius(m){return (LINA.has(m)||REPORTED_SCL3[m])?7.2:5.2}
function oxiCandidates(p){const a=p&&p.metal_oxi_candidates;return Array.isArray(a)&&a.length?a.map(oxi).join(' / '):'—'}

function renderReportedStrip(){
  const el=document.getElementById('scl3Strip');
  if(!el)return;
  el.innerHTML='';
  Object.keys(REPORTED_SCL3).forEach(m=>{
    const b=document.createElement('button');
    b.className='reported-chip';
    const vals=(data.filter(d=>d.m===m).map(d=>oxi(d.valence)));
    b.textContent=m+(vals.length?' · '+vals.join('/'):' · no matched point');
    b.title=REPORTED_SCL3[m].join('；');
    b.addEventListener('click',()=>selectMetal(m));
    el.appendChild(b);
  });
}

function renderPhaseList(items,targetId){
  const el=document.getElementById(targetId);
  if(!items||!items.length){el.innerHTML='<div class="phase-empty">该快照中无凸包稳定二元相</div>';return}
  let rows='';
  for(const p of items){
    rows+='<div class="phase-row"><code>'+formulaHTML(p.formula)+'</code><span class="oxi">'+oxi(p.metal_oxi)+'</span><span>'+fmt(p.e_form)+'</span><a href="'+mpUrl(p.mpid)+'" target="_blank" rel="noreferrer">'+p.mpid+'</a></div>';
  }
  el.innerHTML='<div class="phase-row head"><span>化学式</span><span>M价态候选</span><span>E<sub>f</sub></span><span>MP-ID</span></div>'+rows;
}

function selectMetal(m){
  document.getElementById('phaseTitle').textContent=m+'：全部稳定二元硫化物 / 氯化物';
  let extra='';
  if(LINA.has(m)) extra=' · Li/Na 高亮';
  if(REPORTED_SCL3[m]) extra=' · 已报道 SCl3+ 络盐：'+REPORTED_SCL3[m].join('，');
  document.getElementById('phaseSubtitle').textContent='E_f 单位 eV/atom；氯化物按 Cl⁻ 配平，硫化物同时保留 S²⁻ 与 S⁻（二硫/多硫近似）两套金属形式价态候选'+extra;
  const p=phases[m]||{};
  renderPhaseList(p.sulfides||[],'sulfideList');
  renderPhaseList(p.chlorides||[],'chlorideList');
}

function render(){
  renderReportedStrip();
  document.getElementById('pointCount').textContent=data.length||'0';
  document.getElementById('metalCount').textContent=new Set(data.map(d=>d.m)).size||'0';
  const dt=meta.generated_at_utc?new Date(meta.generated_at_utc):null;
  document.getElementById('updatedAt').textContent=dt&&!isNaN(dt)?dt.toISOString().slice(0,10):'pending';
  document.getElementById('sourceText').textContent='Source: '+(meta.source||'Materials Project')+' · snapshot '+(meta.snapshot_date||'—')+' · '+(meta.energy_unit||'eV/atom');
  svg.innerHTML='';
  const cs=getComputedStyle(document.documentElement),grid=cs.getPropertyValue('--plot-grid').trim(),axis=cs.getPropertyValue('--plot-axis').trim(),label=cs.getPropertyValue('--plot-label').trim(),panel=cs.getPropertyValue('--bg-elevated').trim();
  if(!data.length){
    const t=E('text',{x:460,y:360,'text-anchor':'middle','font-size':18,fill:label});
    t.textContent='数据正在生成；请稍后刷新页面';svg.appendChild(t);return;
  }

  const W=920,H=760,ml=92,mr=28,mt=42,mb=82,iw=W-ml-mr,ih=H-mt-mb;
  const vals=data.flatMap(d=>[d.sulfide_e,d.chloride_e]);
  const rawMin=Math.min(...vals),rawMax=Math.max(...vals,0);
  const pad=Math.max(.15,(rawMax-rawMin)*.08);
  const lo=Math.floor((rawMin-pad)*5)/5,hi=Math.min(.2,Math.ceil((rawMax+pad)*5)/5);
  const X=v=>ml+(v-lo)/(hi-lo)*iw,Y=v=>mt+ih-(v-lo)/(hi-lo)*ih;

  svg.appendChild(E('polygon',{points:X(lo)+','+Y(lo)+' '+X(hi)+','+Y(lo)+' '+X(hi)+','+Y(hi),fill:'rgba(13,148,136,.045)'}));
  svg.appendChild(E('polygon',{points:X(lo)+','+Y(lo)+' '+X(lo)+','+Y(hi)+' '+X(hi)+','+Y(hi),fill:'rgba(37,99,235,.035)'}));

  const ticks=7;
  for(let i=0;i<=ticks;i++){
    const v=lo+(hi-lo)*i/ticks,x=X(v),y=Y(v);
    svg.appendChild(E('line',{x1:x,y1:mt,x2:x,y2:mt+ih,stroke:grid,'stroke-width':1}));
    svg.appendChild(E('line',{x1:ml,y1:y,x2:ml+iw,y2:y,stroke:grid,'stroke-width':1}));
    let tx=E('text',{x:x,y:H-45,'text-anchor':'middle','font-size':11,fill:label});tx.textContent=v.toFixed(1);svg.appendChild(tx);
    let ty=E('text',{x:ml-13,y:y+4,'text-anchor':'end','font-size':11,fill:label});ty.textContent=v.toFixed(1);svg.appendChild(ty);
  }

  svg.appendChild(E('line',{x1:X(lo),y1:Y(lo),x2:X(hi),y2:Y(hi),stroke:label,'stroke-width':1.5,'stroke-dasharray':'7 6'}));
  svg.appendChild(E('line',{x1:ml,y1:mt+ih,x2:ml+iw,y2:mt+ih,stroke:axis,'stroke-width':1.4}));
  svg.appendChild(E('line',{x1:ml,y1:mt,x2:ml,y2:mt+ih,stroke:axis,'stroke-width':1.4}));

  let xt=E('text',{x:ml+iw/2,y:H-10,'text-anchor':'middle','font-size':14,'font-weight':700,fill:axis});
  xt.textContent='同价态稳定氯化物形成能 E_f(M–Cl) / eV atom⁻¹';svg.appendChild(xt);
  let yt=E('text',{x:22,y:mt+ih/2,'text-anchor':'middle','font-size':14,'font-weight':700,fill:axis,transform:'rotate(-90 22 '+(mt+ih/2)+')'});
  yt.textContent='同价态稳定硫化物形成能 E_f(M–S) / eV atom⁻¹';svg.appendChild(yt);

  data.forEach((d,i)=>{
    const cx=X(d.chloride_e),cy=Y(d.sulfide_e),color=pointColor(d.m);
    const p=E('circle',{cx:cx,cy:cy,r:pointRadius(d.m),fill:color,stroke:panel,'stroke-width':1.7});
    p.style.cursor='pointer';
    const show=(ev)=>{
      const delta=d.delta_s_minus_cl;
      const cls=delta<0?'good':'warm';
      const msg=delta<0?'硫化物更负 '+Math.abs(delta).toFixed(3)+' eV/atom':'氯化物更负 '+Math.abs(delta).toFixed(3)+' eV/atom';
      let tag=LINA.has(d.m)?'<br><span class="tag tag-lina">Li / Na</span>':'';
      if(REPORTED_SCL3[d.m]) tag+='<br><span class="tag tag-scl3">实验报道 SCl3+ 络盐</span><br>'+REPORTED_SCL3[d.m].join('<br>');
      tip.innerHTML='<b>'+d.m+'<sup>'+oxi(d.valence)+'</sup></b><br>M–S: '+formulaHTML(d.sulfide_formula)+' <span class="muted">'+d.sulfide_entry_id+'</span><br>E<sub>f</sub> = '+fmt(d.sulfide_e)+' eV/atom<br>M–Cl: '+formulaHTML(d.chloride_formula)+' <span class="muted">'+d.chloride_entry_id+'</span><br>E<sub>f</sub> = '+fmt(d.chloride_e)+' eV/atom<br>Δ(S−Cl) = '+(delta>=0?'+':'')+fmt(delta)+' eV/atom<br><span class="'+cls+'">'+msg+'</span>'+tag;
      tip.style.display='block';
      const wrap=svg.parentElement.getBoundingClientRect(),px=ev.clientX-wrap.left+14,py=ev.clientY-wrap.top+14;
      tip.style.left=Math.min(px,wrap.width-340)+'px';tip.style.top=Math.max(8,py)+'px';
    };
    p.addEventListener('pointerenter',show);p.addEventListener('pointermove',show);p.addEventListener('pointerleave',()=>tip.style.display='none');
    p.addEventListener('click',()=>selectMetal(d.m));svg.appendChild(p);

    const lab=E('text',{x:cx+8,y:cy+(i%2?12:-8),'font-size':(LINA.has(d.m)||REPORTED_SCL3[d.m])?10.5:9.2,'font-weight':(LINA.has(d.m)||REPORTED_SCL3[d.m])?800:600,fill:color});
    lab.textContent=d.m+oxi(d.valence);lab.style.pointerEvents='none';svg.appendChild(lab);
  });

  if(phases.Fe) selectMetal('Fe');
  else if(data[0]) selectMetal(data[0].m);
}
render();
window.addEventListener('research-theme-change',render);

window.addEventListener('research-theme-change',render);
