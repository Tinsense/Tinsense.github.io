const data=(window.BDE_DATA||[]).filter(d=>d.cl!=null&&d.s!=null);
const REPORTED_SCL3={
  Be:['[SCl₃][BeCl₃]'],
  Al:['[SCl₃][AlCl₄]'],
  Ga:['[SCl₃][GaCl₄]','[SCl₃][Ga₂Cl₇]'],
  In:['[SCl₃][InCl₄]'],
  Ti:['[SCl₃][Ti₂Cl₉]'],
  Sn:['[SCl₃]₂[SnCl₆]'],
  Hf:['[SCl₃]₂[HfCl₆]','[SCl₃][Hf₂Cl₉]']
};
const svg=document.getElementById('plot'),tip=document.getElementById('tip'),NS='http://www.w3.org/2000/svg';
const LI=156.5,NA=164.9;let selected='Fe';
function E(n,a={}){const e=document.createElementNS(NS,n);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e}
function zone(d){if(d.delta>=0)return 1;if(d.delta>=-LI)return 2;if(d.delta>=-NA)return 3;return 4}
function ztxt(d){const z=zone(d);return z===1?'Region I：M–S 优势':z===2?'Region II：Li/Na 描述符为正':z===3?'Region III：Na 正、Li 近边界':'Region IV：Li/Na 描述符为负'}
function mixed(d){return d.clSrc==='dft'||d.sSrc==='dft'}
function fmt(v){return (Math.round(v*10)/10).toFixed(1)}
function render(){
  svg.innerHTML='';const W=720,H=720,ml=70,mr=18,mt=18,mb=64,iw=W-ml-mr,ih=H-mt-mb,max=800;
  const X=v=>ml+v/max*iw,Y=v=>mt+ih-v/max*ih;
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(max)},${Y(max)} ${X(0)},${Y(max)}`,fill:'rgba(16,185,129,.14)'}));
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(LI)},${Y(0)} ${X(max)},${Y(max-LI)} ${X(max)},${Y(max)}`,fill:'rgba(59,130,246,.11)'}));
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(NA)},${Y(0)} ${X(max)},${Y(max-NA)} ${X(max)},${Y(max-LI)} ${X(LI)},${Y(0)}`,fill:'rgba(124,58,237,.10)'}));
  svg.appendChild(E('polygon',{points:`${X(0)},${Y(0)} ${X(max)},${Y(0)} ${X(max)},${Y(max-NA)} ${X(NA)},${Y(0)}`,fill:'rgba(148,163,184,.13)'}));
  for(let t=0;t<=800;t+=100){
    const x=X(t),y=Y(t);
    svg.appendChild(E('line',{x1:x,y1:mt,x2:x,y2:mt+ih,stroke:'#e5e7eb','stroke-width':1}));
    svg.appendChild(E('line',{x1:ml,y1:y,x2:ml+iw,y2:y,stroke:'#e5e7eb','stroke-width':1}));
    let tx=E('text',{x,y:H-36,'text-anchor':'middle','font-size':10,fill:'#6b7280'});tx.textContent=t;svg.appendChild(tx);
    let ty=E('text',{x:ml-10,y:y+3,'text-anchor':'end','font-size':10,fill:'#6b7280'});ty.textContent=t;svg.appendChild(ty);
  }
  svg.appendChild(E('line',{x1:ml,y1:Y(0),x2:X(max),y2:Y(max),stroke:'#15803d','stroke-dasharray':'6 5','stroke-width':1.6}));
  svg.appendChild(E('line',{x1:X(LI),y1:Y(0),x2:X(max),y2:Y(max-LI),stroke:'#2563eb','stroke-dasharray':'5 5','stroke-width':1.6}));
  svg.appendChild(E('line',{x1:X(NA),y1:Y(0),x2:X(max),y2:Y(max-NA),stroke:'#7c3aed','stroke-dasharray':'3 5','stroke-width':1.6}));
  svg.appendChild(E('line',{x1:ml,y1:mt+ih,x2:ml+iw,y2:mt+ih,stroke:'#111827','stroke-width':1.2}));
  svg.appendChild(E('line',{x1:ml,y1:mt,x2:ml,y2:mt+ih,stroke:'#111827','stroke-width':1.2}));
  let xt=E('text',{x:ml+iw/2,y:H-8,'text-anchor':'middle','font-size':12,fill:'#111827'});xt.textContent='M–Cl  (kJ mol⁻¹)';svg.appendChild(xt);
  let yt=E('text',{x:17,y:mt+ih/2,'text-anchor':'middle','font-size':12,fill:'#111827',transform:`rotate(-90 17 ${mt+ih/2})`});yt.textContent='M–S  (kJ mol⁻¹)';svg.appendChild(yt);
  [['I',120,715],['II',520,610],['III',675,550],['IV',700,135]].forEach(([t,x,y])=>{let s=E('text',{x:X(x),y:Y(y),'font-size':13,'font-weight':700,fill:'#475569'});s.textContent=t;svg.appendChild(s)});
  const legendRing=E('circle',{cx:505,cy:31,r:6.5,fill:'none',stroke:'#dc2626','stroke-width':2.2});
  const legendText=E('text',{x:518,y:35,'font-size':10.5,'font-weight':600,fill:'#991b1b'});
  legendText.textContent='已报道 SCl₃⁺ 络盐';svg.appendChild(legendRing);svg.appendChild(legendText);
  data.forEach((d,i)=>{
    const cx=X(d.cl),cy=Y(d.s),z=zone(d),c=z===1?'#117a65':z===2?'#2859d9':z===3?'#7c3aed':'#c56b18',reported=REPORTED_SCL3[d.m];let mark;
    if(reported){const ring=E('circle',{cx,cy,r:9.2,fill:'none',stroke:'#dc2626','stroke-width':2.2});ring.style.pointerEvents='none';svg.appendChild(ring)}
    if(mixed(d)) mark=E('rect',{x:cx-5,y:cy-5,width:10,height:10,fill:'#fff',stroke:c,'stroke-width':selected===d.m?2.8:1.7,transform:`rotate(45 ${cx} ${cy})`});
    else mark=E('circle',{cx,cy,r:selected===d.m?6.8:5,fill:c,stroke:selected===d.m?'#111827':'#fff','stroke-width':selected===d.m?2.4:1});
    mark.style.cursor='pointer';
    const show=()=>{selected=d.m;render();const reportedHtml=reported?`<br><span style="color:#b91c1c;font-weight:700">✓ 已报道 SCl₃⁺ 络盐</span><br>${reported.join('<br>')}`:'';tip.innerHTML=`<b>${d.m}</b><br>M–Cl: ${fmt(d.cl)}<br>M–S: ${fmt(d.s)}<br>Δ: ${d.delta>=0?'+':''}${fmt(d.delta)}<br>S<sub>Li</sub>: ${d.liScore>=0?'+':''}${fmt(d.liScore)}<br>S<sub>Na</sub>: ${d.naScore>=0?'+':''}${fmt(d.naScore)}<br>${ztxt(d)}${reportedHtml}`;tip.style.display='block'};
    mark.addEventListener('click',show);mark.addEventListener('pointerenter',show);svg.appendChild(mark);
    const lab=E('text',{x:cx+7,y:cy+(i%2?-7:11),'font-size':9.3,fill:'#111827','font-weight':selected===d.m?700:500});lab.textContent=d.m;lab.style.pointerEvents='none';svg.appendChild(lab);
  });
}
function init(){render();if(window.Office&&Office.context&&Office.context.document){try{Office.context.document.addHandlerAsync(Office.EventType.ActiveViewChanged,()=>setTimeout(render,80))}catch(e){}}}
if(window.Office&&Office.onReady){Office.onReady(()=>init());setTimeout(()=>{if(!svg.childNodes.length)render()},1200)}else init();