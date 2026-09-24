const data = window.BDE_DATA;
const LI_SHIFT = 156.5, NA_SHIFT = 164.9;
const q=s=>document.querySelector(s), NS='http://www.w3.org/2000/svg';
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const search=q('#search'), zone=q('#zone'), sortHm=q('#sortHm'), showHm=q('#showHm');
let selected='Fe';

function zoneText(z){
  return {
    both_strong:'Region I：对 Li / Na 都强有利',
    li_na:'Region II：对 Li / Na 都可能有利',
    na_only:'Region III：Na 可能有利 / Li 偏不利',
    unfav:'Region IV：Li / Na 都偏不利',
    nodata:'无完整成对数据'
  }[z] || '—';
}
function inferZone(d){
  if(d.delta==null) return 'nodata';
  if(d.delta >= 0) return 'both_strong';
  if(d.delta >= -LI_SHIFT) return 'li_na';
  if(d.delta >= -NA_SHIFT) return 'na_only';
  return 'unfav';
}
data.forEach(d=>d.zone=inferZone(d));

function fmt(v){ return v==null ? '—' : (Math.round(v*10)/10).toFixed(1); }
function mixed(d){ return d.clSrc==='dft' || d.sSrc==='dft'; }
function filtered(d){
  const s=search.value.trim().toLowerCase();
  if(s && !d.m.toLowerCase().includes(s)) return false;
  if(zone.value!=='all' && d.zone!==zone.value) return false;
  return true;
}
function updateStats(){
  const paired = data.filter(d=>d.cl!=null && d.s!=null);
  q('#nBoth').textContent = paired.length;
  q('#nR1').textContent = paired.filter(d=>d.zone==='both_strong').length;
  q('#nR2').textContent = paired.filter(d=>d.zone==='li_na').length;
  q('#nR3').textContent = paired.filter(d=>d.zone==='na_only').length;
  q('#nR4').textContent = paired.filter(d=>d.zone==='unfav').length;
}
function detail(){
  const d = data.find(x=>x.m===selected) || data[0];
  q('#dm').textContent = d.m;
  q('#dcl').textContent = d.cl==null?'—':fmt(d.cl)+' kJ mol⁻¹';
  q('#ds').textContent = d.s==null?'—':fmt(d.s)+' kJ mol⁻¹';
  q('#dd').textContent = d.delta==null?'—':(d.delta>=0?'+':'')+fmt(d.delta)+' kJ mol⁻¹';
  q('#dli').textContent = d.liScore==null?'—':(d.liScore>=0?'+':'')+fmt(d.liScore);
  q('#dna').textContent = d.naScore==null?'—':(d.naScore>=0?'+':'')+fmt(d.naScore);
  let note = zoneText(d.zone)+'。';
  if(d.zone==='both_strong') note += ' 金属本身就偏向形成 M–S。';
  else if(d.zone==='li_na') note += ' M–S 虽略弱于 M–Cl，但 LiCl/NaCl 形成驱动力通常足以补偿。';
  else if(d.zone==='na_only') note += ' 位于 Li 和 Na 的边界之间，按这个 descriptor 看更接近“Na 可行，Li 较难”。';
  else if(d.zone==='unfav') note += ' 从键能交换看，对 Li/Na 都偏不利。';
  else note += ' 缺少成对数据，无法进入分区判定。';
  if(mixed(d) && d.zone!=='nodata') note += ' 该元素至少一个值来自 DFT 数据库补齐。';
  q('#dnote').textContent = note;
}
function E(name, attrs={}){
  const e=document.createElementNS(NS,name);
  Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
  return e;
}
function renderChart(){
  const svg=q('#chart'), tip=q('#tip');
  svg.innerHTML='';
  const cs=getComputedStyle(document.documentElement),grid=cs.getPropertyValue('--plot-grid').trim(),axis=cs.getPropertyValue('--plot-axis').trim(),label=cs.getPropertyValue('--plot-label').trim(),panel=cs.getPropertyValue('--bg-elevated').trim();
  const W=760,H=760, ml=78,mr=24,mt=20,mb=70, iw=W-ml-mr, ih=H-mt-mb, max=800;
  const X=v=>ml+v/max*iw, Y=v=>mt+ih-v/max*ih;

  svg.appendChild(E('polygon', {points:`${X(0)},${Y(0)} ${X(max)},${Y(0)} ${X(max)},${Y(max-LI_SHIFT)} ${X(LI_SHIFT)},${Y(0)}`, fill:'var(--r2)'}));
  svg.appendChild(E('polygon', {points:`${X(0)},${Y(0)} ${X(NA_SHIFT)},${Y(0)} ${X(max)},${Y(max-NA_SHIFT)} ${X(max)},${Y(max-LI_SHIFT)} ${X(LI_SHIFT)},${Y(0)}`, fill:'var(--r3)'}));
  svg.appendChild(E('polygon', {points:`${X(0)},${Y(0)} ${X(max)},${Y(0)} ${X(max)},${Y(max-NA_SHIFT)} ${X(NA_SHIFT)},${Y(0)}`, fill:'var(--r4)'}));
  svg.appendChild(E('polygon', {points:`${X(0)},${Y(0)} ${X(max)},${Y(max)} ${X(0)},${Y(max)}`, fill:'var(--r1)'}));

  for(let t=0;t<=max;t+=100){
    let x=X(t), y=Y(t);
    svg.appendChild(E('line',{x1:x,y1:mt,x2:x,y2:mt+ih,stroke:grid}));
    svg.appendChild(E('line',{x1:ml,y1:y,x2:ml+iw,y2:y,stroke:grid}));
    let tx=E('text',{x:x,y:H-40,'text-anchor':'middle','font-size':11,fill:label}); tx.textContent=t; svg.appendChild(tx);
    let ty=E('text',{x:ml-12,y:y+4,'text-anchor':'end','font-size':11,fill:label}); ty.textContent=t; svg.appendChild(ty);
  }
  svg.appendChild(E('line',{x1:ml,y1:Y(0),x2:X(max),y2:Y(max),stroke:'#16a34a','stroke-dasharray':'6 5','stroke-width':1.7}));
  svg.appendChild(E('line',{x1:X(LI_SHIFT),y1:Y(0),x2:X(max),y2:Y(max-LI_SHIFT),stroke:'#2563eb','stroke-dasharray':'5 5','stroke-width':1.7}));
  svg.appendChild(E('line',{x1:X(NA_SHIFT),y1:Y(0),x2:X(max),y2:Y(max-NA_SHIFT),stroke:'#7c3aed','stroke-dasharray':'3 5','stroke-width':1.7}));
  svg.appendChild(E('line',{x1:ml,y1:mt+ih,x2:ml+iw,y2:mt+ih,stroke:axis}));
  svg.appendChild(E('line',{x1:ml,y1:mt,x2:ml,y2:mt+ih,stroke:axis}));

  let xt=E('text',{x:ml+iw/2,y:H-8,'text-anchor':'middle','font-size':13,fill:axis});
  xt.textContent='M–Cl  (kJ mol⁻¹)'; svg.appendChild(xt);
  let yt=E('text',{x:17,y:mt+ih/2,'text-anchor':'middle','font-size':13,fill:axis,transform:`rotate(-90 17 ${mt+ih/2})`});
  yt.textContent='M–S  (kJ mol⁻¹)'; svg.appendChild(yt);

  [['y = x',585,610,'#15803d'],['Li 边界',545,390,'#2563eb'],['Na 边界',515,325,'#7c3aed']].forEach(([txt,x,y,c])=>{let t=E('text',{x:X(x),y:Y(y),'font-size':11,fill:c});t.textContent=txt;svg.appendChild(t);});
  [['Region I',150,690],['Region II',520,605],['Region III',680,560],['Region IV',700,160]].forEach(([txt,x,y])=>{let t=E('text',{x:X(x),y:Y(y),'font-size':14,fill:label,'font-weight':700});t.textContent=txt;svg.appendChild(t);});

  data.filter(d=>filtered(d) && d.cl!=null && d.s!=null).forEach((d,i)=>{
    const cx=X(d.cl), cy=Y(d.s);
    const color = d.zone==='both_strong' ? 'var(--green)' : d.zone==='li_na' ? 'var(--blue)' : d.zone==='na_only' ? 'var(--purple)' : 'var(--orange)';
    let mark;
    if(mixed(d)){
      mark=E('rect',{x:cx-5.1,y:cy-5.1,width:10.2,height:10.2,fill:panel,stroke:color,'stroke-width':d.m===selected?2.8:1.8,transform:`rotate(45 ${cx} ${cy})`});
    } else {
      mark=E('circle',{cx,cy,r:d.m===selected?7:5.2,fill:color,stroke:d.m===selected?axis:panel,'stroke-width':d.m===selected?2.4:1.1});
    }
    mark.style.cursor='pointer';
    mark.addEventListener('click',()=>{selected=d.m; renderAll();});
    mark.addEventListener('pointerenter',e=>{
      const r=q('#chartWrap').getBoundingClientRect();
      tip.innerHTML=`<b>${d.m}</b><br>M–Cl: ${fmt(d.cl)}<br>M–S: ${fmt(d.s)}<br>Δ: ${d.delta>=0?'+':''}${fmt(d.delta)}<br>S_Li: ${d.liScore>=0?'+':''}${fmt(d.liScore)}<br>S_Na: ${d.naScore>=0?'+':''}${fmt(d.naScore)}<br>${zoneText(d.zone)}`;
      tip.style.left=Math.min(e.clientX-r.left+10,r.width-260)+'px';
      tip.style.top=Math.max(5,e.clientY-r.top-105)+'px';
      tip.style.display='block';
    });
    mark.addEventListener('pointerleave',()=>tip.style.display='none');
    svg.appendChild(mark);
    let dx=7, dy=(i%2===0?-7:12); if(d.m===selected){dx=10;dy=-10;}
    let lab=E('text',{x:cx+dx,y:cy+dy,'font-size':9.5,fill:axis,'font-weight':d.m===selected?700:500});
    lab.textContent=d.m; lab.style.pointerEvents='none'; svg.appendChild(lab);
  });
}
function heatColor(score){
  if(score==null) return getComputedStyle(document.documentElement).getPropertyValue('--surface-strong').trim();
  const min=-100, max=250;
  let t=(score-min)/(max-min); t=Math.max(0,Math.min(1,t));
  const hue=120*t; const sat=65; const light=90-50*t;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
function heatText(score){
  if(score==null) return '无数据';
  if(score>100) return '很可能';
  if(score>0) return '可能';
  if(score>-50) return '边界';
  return '偏不利';
}
function renderHeatmap(){
  let arr = data.filter(filtered);
  if(showHm.value==='paired') arr = arr.filter(d=>d.liScore!=null && d.naScore!=null);
  if(sortHm.value==='liDesc') arr.sort((a,b)=>(b.liScore??-1e9)-(a.liScore??-1e9));
  else if(sortHm.value==='naDesc') arr.sort((a,b)=>(b.naScore??-1e9)-(a.naScore??-1e9));
  else if(sortHm.value==='avgDesc') arr.sort((a,b)=>(((b.liScore??-1e9)+(b.naScore??-1e9))/2)-(((a.liScore??-1e9)+(a.naScore??-1e9))/2));
  else if(sortHm.value==='deltaDesc') arr.sort((a,b)=>(b.delta??-1e9)-(a.delta??-1e9));
  else arr.sort((a,b)=>a.z-b.z);

  q('#hmBody').innerHTML = arr.map(d=>`
    <tr ${d.m===selected?'style="background:#eef4ff"':''}>
      <td><button class="linkbtn hmPick" data-m="${d.m}">${d.m}</button></td>
      <td>
        <span class="cell hmPick" data-m="${d.m}" style="background:${heatColor(d.liScore)};">
          <div class="big">${d.liScore==null?'—':(d.liScore>=0?'+':'')+fmt(d.liScore)}</div>
          <div class="small">${heatText(d.liScore)}</div>
        </span>
      </td>
      <td>
        <span class="cell hmPick" data-m="${d.m}" style="background:${heatColor(d.naScore)};">
          <div class="big">${d.naScore==null?'—':(d.naScore>=0?'+':'')+fmt(d.naScore)}</div>
          <div class="small">${heatText(d.naScore)}</div>
        </span>
      </td>
      <td>${d.delta==null?'—':(d.delta>=0?'+':'')+fmt(d.delta)}</td>
      <td><span class="badge">${zoneText(d.zone)}</span></td>
    </tr>
  `).join('');
  document.querySelectorAll('.hmPick').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.m; renderAll();}));
}
function renderTable(){
  const a = data.filter(filtered);
  q('#tbody').innerHTML = a.map(d=>`
    <tr ${d.m===selected?'style="background:#eef4ff"':''}>
      <td>${d.z}</td>
      <td><button class="linkbtn pick" data-m="${d.m}">${d.m}</button></td>
      <td>${d.cl==null?'—':fmt(d.cl)}</td>
      <td>${d.s==null?'—':fmt(d.s)}</td>
      <td>${d.delta==null?'—':(d.delta>=0?'+':'')+fmt(d.delta)}</td>
      <td>${d.liScore==null?'—':(d.liScore>=0?'+':'')+fmt(d.liScore)}</td>
      <td>${d.naScore==null?'—':(d.naScore>=0?'+':'')+fmt(d.naScore)}</td>
      <td>${d.clSrc==='exp'?'实验':d.clSrc==='dft'?'DFT补齐':'—'}</td>
      <td>${d.sSrc==='exp'?'实验':d.sSrc==='dft'?'DFT补齐':'—'}</td>
      <td><span class="badge">${zoneText(d.zone)}</span></td>
    </tr>`).join('');
  document.querySelectorAll('.pick').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.m; renderAll();}));
}
function renderAll(){ updateStats(); detail(); renderChart(); renderHeatmap(); renderTable(); }
[search,zone,sortHm,showHm].forEach(x=>x.addEventListener(x===search?'input':'change', renderAll));
q('#reset').addEventListener('click',()=>{ search.value=''; zone.value='all'; sortHm.value='liDesc'; showHm.value='paired'; selected='Fe'; renderAll(); });
renderAll();
window.addEventListener('research-theme-change',renderAll);
