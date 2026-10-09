const data=(window.BDE_DATA||[]).filter(d=>d.cl!=null&&d.s!=null);
const REPORTED_SCL3={
  Be:['[SCl₃][BeCl₃]'], Al:['[SCl₃][AlCl₄]'], Ga:['[SCl₃][GaCl₄]','[SCl₃][Ga₂Cl₇]'],
  In:['[SCl₃][InCl₄]'], Ti:['[SCl₃][Ti₂Cl₉]'], Sn:['[SCl₃]₂[SnCl₆]'],
  Hf:['[SCl₃]₂[HfCl₆]','[SCl₃][Hf₂Cl₉]']
};
const svg=document.getElementById('plot'),tip=document.getElementById('tip'),NS='http://www.w3.org/2000/svg';
const LI=156.5,NA=164.9;let selected='Fe';
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function E(n,a={}){const e=document.createElementNS(NS,n);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e}
function zone(d){if(d.delta>=0)return 1;if(d.delta>=-LI)return 2;if(d.delta>=-NA)return 3;return 4}
function ztxt(d){const z=zone(d);return z===1?'Region I：M–S 优势':z===2?'Region II：Li/Na 描述符为正':z===3?'Region III：Na 正、Li 近边界':'Region IV：Li/Na 描述符为负'}
function mixed(d){return d.clSrc==='dft'||d.sSrc==='dft'}
function fmt(v){return (Math.round(v*10)/10).toFixed(1)}

/* Homolytic average single-bond enthalpies (298.15 K), IB Chemistry Data Booklet 2025.
 * Reference nonmetal points are plotted on the same axes, but DO NOT receive
 * metal-exchange descriptors, quadrant interpretations, or DFT/experimental markers.
 * SCl(g) radical bond dissociation enthalpy (~242 kJ/mol from JANAF) is a
 * molecule-specific quantity; NOT the same as the average S–Cl value below.
 */
const SCL_BDE_298=271;
const NONMETAL_POINTS=[
  {m:'S',cl:271,s:266,xBond:'S–Cl',yBond:'S–S',color:'#ffda7b',kind:'nonmetal'},
  {m:'Cl',cl:242,s:271,xBond:'Cl–Cl',yBond:'Cl–S',color:'#ff93bc',kind:'nonmetal'}
];
const SCL_FORMATION_298=[
  {name:'S₂Cl₂',oxi:'+I',gas:-16.74,liquid:-58.16},
  {name:'SCl₂',oxi:'+II',gas:-17.57,liquid:-49.79},
  {name:'SCl₄',oxi:'+IV',gas:null,liquid:null}
];
function renderSclBond(){
  const d=NONMETAL_POINTS.find(x=>x.m===selected)||data.find(x=>x.m===selected)||data.find(x=>x.m==='Fe')||data[0];
  const title=document.getElementById('compare-metal');
  const target=document.getElementById('scl-bond-bars');
  if(!d||!title||!target)return;
  title.textContent=d.m;
  const bars=[
    {name:d.kind==='nonmetal'?d.xBond:d.m+'–Cl',value:d.cl,cls:'cl'},
    {name:d.kind==='nonmetal'?d.yBond:d.m+'–S',value:d.s,cls:'s'}
  ];
  if(d.kind!=='nonmetal')bars.push({name:'S–Cl¹',value:SCL_BDE_298,cls:'scl'});
  const extent=Math.max(500,...bars.map(x=>x.value));
  target.innerHTML=bars.map(b=>
    '<div class="scl-bar-row"><span class="scl-bar-label">'+b.name+'</span>'+
    '<div class="scl-bar-track"><div class="scl-bar-fill '+b.cls+'" style="width:'+
    (b.value/extent*100).toFixed(2)+'%"></div></div><span class="scl-bar-value">'+
    fmt(b.value)+' kJ/mol</span></div>'
  ).join('');
  target.setAttribute('aria-label',(d.kind==='nonmetal'?d.xBond:d.m+'–Cl')+' '+fmt(d.cl)+'，'+(d.kind==='nonmetal'?d.yBond:d.m+'–S')+' '+fmt(d.s)+(d.kind==='nonmetal'?'': '，S–Cl 平均键焓 271.0 kJ/mol'));
}
function renderSclEnthalpy(){
  const select=document.getElementById('scl-phase'),target=document.getElementById('scl-enthalpy-bars');
  if(!select||!target)return;
  const phase=select.value;
  target.innerHTML=SCL_FORMATION_298.map(d=>{
    const v=d[phase],known=Number.isFinite(v);
    return '<div class="scl-enthalpy-row '+(known?'':'na')+'">'+
      '<div class="scl-enthalpy-head"><span class="scl-enthalpy-name">'+d.name+
      ' <span style="font-size:.7rem;color:var(--text-tertiary)">S('+d.oxi+')</span></span>'+
      '<span class="scl-enthalpy-number'+(known?'':' missing')+'">'+
      (known?(v<0?'−':'+')+Math.abs(v).toFixed(2)+' kJ/mol':'未核实')+'</span></div>'+
      '<div class="scl-enthalpy-track">'+(known?'<div class="scl-enthalpy-fill '+phase+
      '" style="width:'+Math.min(100,Math.abs(v)/65*100).toFixed(1)+'%"></div>':'')+'</div></div>';
  }).join('');
  target.setAttribute('aria-label',(phase==='gas'?'气相':'液相')+'硫氯化合物标准生成焓对比');
}
function syncSclVisibility(){
  const checked=document.getElementById('scl-toggle').checked;
  document.getElementById('scl-compare').hidden=!checked;
  document.getElementById('scl-enthalpy-card').hidden=!checked;
  document.getElementById('scl-plot-legend').hidden=!checked;
  if(!checked && NONMETAL_POINTS.some(d=>d.m===selected))selected='Fe';
  render();
}


function renderNonmetalPoints(X,Y,axis,panel){
  const note=document.getElementById('scl-toggle');
  if(!note||!note.checked)return;
  const colors={S:'#ffda7b',Cl:'#ff93bc'};
  NONMETAL_POINTS.forEach((d)=>{
    const cx=X(d.cl),cy=Y(d.s),color=colors[d.m];
    const g=E('g',{role:'button',tabindex:0,'aria-label':d.m+'：'+d.xBond+' = '+d.cl+'，'+d.yBond+' = '+d.s+' 千焦每摩尔'});
    g.style.cursor='pointer';
    const labelX=d.m==='S'?cx+23:cx-109;
    const labelY=d.m==='S'?cy-48:cy+20;
    const connectorEndX=d.m==='S'?cx+26:cx-10;
    const connectorEndY=d.m==='S'?cy-13:cy+24;
    g.appendChild(E('line',{x1:cx,y1:cy,x2:connectorEndX,y2:connectorEndY,stroke:color,'stroke-width':1.5,'stroke-dasharray':'3 2',opacity:.95}));
    g.appendChild(E('rect',{x:labelX,y:labelY,width:86,height:37,rx:8,ry:8,
      fill:panel,stroke:color,'stroke-width':1.3}));
    const symbol=E('text',{x:labelX+9,y:labelY+15,fill:color,'font-weight':800,'font-size':13});symbol.textContent=d.m;g.appendChild(symbol);
    const coords=E('text',{x:labelX+9,y:labelY+29,fill:axis,'font-size':10.5,'font-weight':600});
    coords.textContent=d.cl+', '+d.s;g.appendChild(coords);
    const focus=selected===d.m;
    g.appendChild(E('circle',{cx,cy,r:focus?16:14,fill:'none',stroke:color,'stroke-width':focus?3:2,opacity:.85}));
    const hexPoints=Array.from({length:6},(_,i)=>{
      const a=Math.PI/3*i+Math.PI/6;
      return (cx+10*Math.cos(a)).toFixed(1)+','+(cy+10*Math.sin(a)).toFixed(1);
    }).join(' ');
    g.appendChild(E('polygon',{points:hexPoints,fill:color,stroke:'#15181d','stroke-width':1.7}));
    const letter=E('text',{x:cx,y:cy+4,'text-anchor':'middle','font-size':10,'font-weight':800,fill:'#171717'});
    letter.textContent=d.m;g.appendChild(letter);
    // Larger invisible hit area for keyboard/touch and reliable SVG pointer targeting.
    g.appendChild(E('circle',{cx,cy,r:18,fill:'transparent',stroke:'none'}));
    const show=()=>{
      selected=d.m;renderSclBond();
      tip.innerHTML='<b style="color:'+color+'">'+d.m+' · 非金属参照点</b>'+
        '<br>X '+d.xBond+': <b>'+fmt(d.cl)+'</b> kJ mol⁻¹'+
        '<br>Y '+d.yBond+': <b>'+fmt(d.s)+'</b> kJ mol⁻¹'+
        '<br>298 K 平均单键焓 · IB Chemistry Data Booklet'+
        '<br><span style="color:#cdd7e0">不是金属置换反应的 Region I–IV 判据</span>';
      const parent=svg.parentElement.getBoundingClientRect();
      const box=svg.getBoundingClientRect();
      tip.style.left=Math.min(parent.width-260,Math.max(6,(cx/720)*box.width+16))+'px';
      tip.style.top=Math.max(8,(cy/720)*box.height-112)+'px';
      tip.style.display='block';
    };
    g.addEventListener('pointerenter',show);
    g.addEventListener('pointerleave',()=>{tip.style.display='none'});
    g.addEventListener('click',()=>{selected=d.m;render();tip.style.display='none'});
    g.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=d.m;render();}});
    svg.appendChild(g);
  });
}

function render(){
  const grid=css('--plot-grid'),axis=css('--plot-axis'),label=css('--plot-label'),panel=css('--bg-elevated');
  svg.innerHTML='';const W=720,H=720,ml=70,mr=18,mt=18,mb=64,iw=W-ml-mr,ih=H-mt-mb,max=800;
  const X=v=>ml+v/max*iw,Y=v=>mt+ih-v/max*ih;
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(max)},${Y(max)} ${X(0)},${Y(max)}`,fill:'rgba(16,185,129,.12)'}));
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(LI)},${Y(0)} ${X(max)},${Y(max-LI)} ${X(max)},${Y(max)}`,fill:'rgba(59,130,246,.10)'}));
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(NA)},${Y(0)} ${X(max)},${Y(max-NA)} ${X(max)},${Y(max-LI)} ${X(LI)},${Y(0)}`,fill:'rgba(124,58,237,.09)'}));
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(max)},${Y(0)} ${X(max)},${Y(max-NA)} ${X(NA)},${Y(0)}`,fill:'rgba(148,163,184,.09)'}));
  for(let t=0;t<=800;t+=100){
    const x=X(t),y=Y(t);
    svg.appendChild(E('line',{x1:x,y1:mt,x2:x,y2:mt+ih,stroke:grid,'stroke-width':1}));
    svg.appendChild(E('line',{x1:ml,y1:y,x2:ml+iw,y2:y,stroke:grid,'stroke-width':1}));
    let tx=E('text',{x,y:H-36,'text-anchor':'middle','font-size':10,fill:label});tx.textContent=t;svg.appendChild(tx);
    let ty=E('text',{x:ml-10,y:y+3,'text-anchor':'end','font-size':10,fill:label});ty.textContent=t;svg.appendChild(ty);
  }
  svg.appendChild(E('line',{x1:ml,y1:Y(0),x2:X(max),y2:Y(max),stroke:'#55c79a','stroke-dasharray':'6 5','stroke-width':1.6}));
  svg.appendChild(E('line',{x1:X(LI),y1:Y(0),x2:X(max),y2:Y(max-LI),stroke:'#5aa9ff','stroke-dasharray':'5 5','stroke-width':1.6}));
  svg.appendChild(E('line',{x1:X(NA),y1:Y(0),x2:X(max),y2:Y(max-NA),stroke:'#a98bff','stroke-dasharray':'3 5','stroke-width':1.6}));
  svg.appendChild(E('line',{x1:ml,y1:mt+ih,x2:ml+iw,y2:mt+ih,stroke:axis,'stroke-width':1.2}));
  svg.appendChild(E('line',{x1:ml,y1:mt,x2:ml,y2:mt+ih,stroke:axis,'stroke-width':1.2}));
  let xt=E('text',{x:ml+iw/2,y:H-8,'text-anchor':'middle','font-size':12,fill:axis});xt.textContent='M–Cl  (kJ mol⁻¹)';svg.appendChild(xt);
  let yt=E('text',{x:17,y:mt+ih/2,'text-anchor':'middle','font-size':12,fill:axis,transform:`rotate(-90 17 ${mt+ih/2})`});yt.textContent='M–S  (kJ mol⁻¹)';svg.appendChild(yt);
  [['I',120,715],['II',520,610],['III',675,550],['IV',700,135]].forEach(([t,x,y])=>{let s=E('text',{x:X(x),y:Y(y),'font-size':13,'font-weight':700,fill:label});s.textContent=t;svg.appendChild(s)});
  const legendRing=E('circle',{cx:505,cy:31,r:6.5,fill:'none',stroke:'#fb7185','stroke-width':2.2});
  const legendText=E('text',{x:518,y:35,'font-size':10.5,'font-weight':600,fill:'#fb7185'});
  legendText.textContent='已报道 SCl₃⁺ 络盐';svg.appendChild(legendRing);svg.appendChild(legendText);
  data.forEach((d,i)=>{
    const cx=X(d.cl),cy=Y(d.s),z=zone(d),c=z===1?'#55c79a':z===2?'#5aa9ff':z===3?'#a98bff':'#e6a15f',reported=REPORTED_SCL3[d.m];let mark;
    if(reported){const ring=E('circle',{cx,cy,r:9.2,fill:'none',stroke:'#fb7185','stroke-width':2.2});ring.style.pointerEvents='none';svg.appendChild(ring)}
    if(mixed(d)) mark=E('rect',{x:cx-5,y:cy-5,width:10,height:10,fill:panel,stroke:c,'stroke-width':selected===d.m?2.8:1.7,transform:`rotate(45 ${cx} ${cy})`});
    else mark=E('circle',{cx,cy,r:selected===d.m?6.8:5,fill:c,stroke:selected===d.m?axis:panel,'stroke-width':selected===d.m?2.4:1});
    mark.style.cursor='pointer';
    const show=()=>{selected=d.m;renderSclBond();const reportedHtml=reported?`<br><span style="color:#fb7185;font-weight:700">✓ 已报道 SCl₃⁺ 络盐</span><br>${reported.join('<br>')}`:'';tip.innerHTML=`<b>${d.m}</b><br>M–Cl: ${fmt(d.cl)}<br>M–S: ${fmt(d.s)}<br>Δ: ${d.delta>=0?'+':''}${fmt(d.delta)}<br>S<sub>Li</sub>: ${d.liScore>=0?'+':''}${fmt(d.liScore)}<br>S<sub>Na</sub>: ${d.naScore>=0?'+':''}${fmt(d.naScore)}<br>${ztxt(d)}${reportedHtml}`;tip.style.display='block'};
    mark.addEventListener('click',()=>{selected=d.m;render();tip.style.display='none'});
    mark.addEventListener('pointerenter',show);
    mark.addEventListener('pointerleave',()=>{tip.style.display='none'});
    svg.appendChild(mark);
    const lab=E('text',{x:cx+7,y:cy+(i%2?-7:11),'font-size':9.3,fill:axis,'font-weight':selected===d.m?700:500});lab.textContent=d.m;lab.style.pointerEvents='none';svg.appendChild(lab);
  });
  renderNonmetalPoints(X,Y,axis,panel);
  renderSclBond();
  renderSclEnthalpy();
}
function init(){
  document.getElementById('scl-toggle').addEventListener('change',syncSclVisibility);
  document.getElementById('scl-phase').addEventListener('change',renderSclEnthalpy);
  syncSclVisibility();
  render();
}
window.addEventListener('research-theme-change',render);
init();