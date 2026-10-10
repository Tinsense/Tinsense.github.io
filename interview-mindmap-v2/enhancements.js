(function(){
  "use strict";
  const expansions=window.INTERVIEW_V2_DETAILS||{};
  QUESTIONS.forEach(function(q){
    const arr=expansions[q.id]||[];
    q.branches=q.branches.map(function(b,i){
      const orig=b.points.join("。");
      return Object.assign({},b,{
        detail:arr[i]||("这一分支要抓住的要点是："+orig+"。回答时应先解释为什么关注这些指标，再说明会采取的具体动作，最后用对应业务结果判断效果。")
      });
    });
    q.fullAnswer=arr.length?arr.join("\n\n"):q.branches.map(function(b,i){return (i+1)+"、"+b.name+"\n"+b.detail}).join("\n\n")+"\n\n总结口述：\n"+q.oral;
  });
  const verbatim=window.INTERVIEW_V2_VERBATIM||{};
  QUESTIONS.forEach(function(q){if(verbatim[q.id])q.fullAnswer=verbatim[q.id]});
  const extras=window.INTERVIEW_V2_EXTRA||[];
  extras.forEach(function(item){
    const id="q"+String(QUESTIONS.length+1).padStart(2,"0");
    const branches=item.parts.map(function(part){
      return {name:part[0],points:[part[1].slice(0,42)+"…"],detail:part[1]};
    });
    QUESTIONS.push({
      id:id,section:item.section,title:item.title,tag:item.tag,
      branches:branches,oral:item.parts.map(function(p){return p[1]}).join(" "),
      fullAnswer:item.parts.map(function(p,i){return (i+1)+"、"+p[0]+"\n"+p[1]}).join("\n\n"),
      follow:"结合真实业务数据，面试官还可能追问你为什么这样判断、有没有更好的替代方案。",
      verify:item.verify||""
    });
  });
  Object.assign(META,{
    all:{title:"全部题目",kicker:"ALL CARDS",desc:"V2.0 · 完整参考回答与分支小卡片"},
    scenario:{title:"业务场景",kicker:"CASE STUDIES",desc:"GMV、流量、转化、广告、库存与竞争"},
    jd:{title:"京东深挖",kicker:"JD EXPERIENCE",desc:"完整简历回答，重点数字附真实性核实提示"},
    metrics:{title:"指标速记",kicker:"METRICS",desc:"核心指标口径及易错问题"},
    new:{title:"新品运营",kicker:"NEW PRODUCTS",desc:"一个月新品运营方案和难点"},
    follow:{title:"连续追问",kicker:"FOLLOW UPS",desc:"考察业务分析的第二层、第三层"},
    verify:{title:"数据核实",kicker:"VERIFICATION",desc:"10 张核实清单，避免背成虚构经历"},
    projects:{title:"项目讲述",kicker:"PROJECT STORIES",desc:"618、广告优化与 AI 监控三个重点 STAR 故事"},
    mock:{title:"模拟面试",kicker:"MOCK INTERVIEW",desc:"六道京东关键深挖题"}
  });
  NAV.push(["verify","✓"],["projects","▤"],["mock","◎"]);
  const root=el("dialog");
  const previousDraw=drawDialog;
  function detailState(){
    if(state._v2Active!==state.active){
      state._v2Active=state.active;
      state._v2Expanded=new Set([0]);
      state._v2Full=false;
    }
  }
  function buttons(id){
    return '<button class="softbtn '+(state.fav.has(id)?"active":"")+'" data-action="fav" data-id="'+id+'">'+(state.fav.has(id)?"★ 已收藏":"☆ 收藏")+'</button>'+
      '<button class="softbtn '+(state.mastered.has(id)?"active":"")+'" data-action="master" data-id="'+id+'">'+(state.mastered.has(id)?"✓ 已掌握":"✓ 标记掌握")+'</button>';
  }
  drawDialog=function(){
    const x=QUESTIONS.find(function(q){return q.id===state.active});
    if(!x){previousDraw();return}
    detailState();
    const branches=x.branches;
    const map='<div class="map2" aria-label="可交互思维导图">'+
      '<svg viewBox="0 0 1000 430" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="9 7">'+
      '<path d="M500 215 C345 215 375 95 200 95"/><path d="M500 215 C655 215 625 95 800 95"/>'+
      '<path d="M500 215 C345 215 375 337 200 337"/><path d="M500 215 C655 215 625 337 800 337"/></g></svg>'+
      '<div class="map2-center"><span>四步框架</span><b>核心问题<br>→ 具体行动</b></div>'+
      branches.map(function(b,i){return '<button data-action="v2branch" data-index="'+i+'" class="map2-leaf p'+i+" "+(state._v2Expanded.has(i)?"chosen":"")+'"><i>'+(i+1)+'</i><span>'+esc(b.name)+'</span></button>'}).join("")+'</div>';
    const cards='<div class="v2-subhead"><div><strong>细分参考回答小卡片</strong><small>点击导图节点或小卡片，展开该分支的完整解答</small></div><div class="v2-subtools"><button class="softbtn" data-action="v2expand">全部展开</button><button class="softbtn" data-action="v2collapse">收起</button></div></div>'+
      '<div class="v2-subgrid">'+branches.map(function(b,i){
        const isOpen=state._v2Expanded.has(i);
        return '<section class="v2-subcard '+(isOpen?"expanded":"")+'" id="v2branch-'+i+'"><button class="v2-subtrigger" data-action="v2branch" data-index="'+i+'" aria-expanded="'+isOpen+'"><b><span class="v2-step">'+(i+1)+'</span>'+esc(b.name)+'</b><span class="v2-arrow">'+(isOpen?"−":"+")+'</span></button>'+
          (isOpen?'<div class="v2-detail">'+esc(b.detail)+'</div>':'<div class="v2-preview">'+esc(b.points[0])+'</div>')+'</section>';
      }).join("")+'</div>';
    const full=state._v2Full?'<div class="v2-full">'+esc(x.fullAnswer)+'</div>':'<div class="oral">'+esc(x.oral)+'</div>';
    root.innerHTML='<div class="dialog-header"><div class="dialog-utilities"><span class="card-number">'+esc(x.id.toUpperCase())+' / '+esc(META[x.section].title)+' <span class="v2-label">V2.0</span></span><button class="close" data-action="close" aria-label="关闭">×</button></div>'+
      '<h2>'+esc(x.title)+'</h2><div class="dialog-desc">先按思维导图记住四步逻辑，再点开每个节点的具体参考回答。</div></div>'+
      '<div class="dialog-body">'+map+cards+
      '<div class="section-label"><span>🎙 完整参考回答</span><button class="softbtn" data-action="v2full">'+(state._v2Full?"收起全文":"展开完整版")+'</button></div>'+full+
      (x.follow?'<div class="followup"><strong style="color:var(--ink)">↳ 面试官进一步追问：</strong> '+esc(x.follow)+'</div>':"")+
      (x.verify?'<div class="verify"><strong>⚠ 需根据真实经历核实：</strong> '+esc(x.verify)+'</div>':"")+
      '</div><div class="dialog-footer"><div class="groupbtn">'+buttons(x.id)+'</div><div class="groupbtn"><button class="softbtn" data-action="v2copy">复制完整回答</button><button class="softbtn dark" data-action="next">下一题 →</button></div></div>';
  };
  function redraw(){const y=root.scrollTop;drawDialog();root.scrollTop=y}
  document.addEventListener("click",async function(e){
    const btn=e.target.closest("[data-action]");
    if(!btn)return;
    const a=btn.dataset.action;
    if(a==="v2branch"){
      const i=Number(btn.dataset.index);
      if(state._v2Expanded.has(i))state._v2Expanded.delete(i);
      else state._v2Expanded.add(i);
      redraw();
      if(btn.classList.contains("map2-leaf")){
        const target=el("v2branch-"+i);
        if(target)target.scrollIntoView({behavior:"smooth",block:"nearest"});
      }
    }else if(a==="v2expand"){state._v2Expanded=new Set([0,1,2,3]);redraw()}
    else if(a==="v2collapse"){state._v2Expanded=new Set();redraw()}
    else if(a==="v2full"){state._v2Full=!state._v2Full;redraw()}
    else if(a==="v2copy"){
      const x=QUESTIONS.find(function(q){return q.id===state.active});
      const answer=[x.title,"【分点参考回答】",...x.branches.map(function(b,i){return (i+1)+"、"+b.name+"\n"+b.detail}),"【完整版】",x.fullAnswer,x.verify?"【需要核实】"+x.verify:""].join("\n\n");
      try{await navigator.clipboard.writeText(answer);btn.textContent="已复制 ✓"}catch(err){btn.textContent="复制失败，请手动选择"}
    }
  });
  const oldRender=render;
  render=function(){
    oldRender();
    const kicker=el("kicker");if(kicker)kicker.textContent=(kicker.textContent||"INTERVIEW")+' · V2.0';
    if(state.section==="all"){
      el("heroTitle").innerHTML="把每一道题，<br>展开成完整答案。";
      el("heroDesc").textContent="每题都有四分支交互式思维导图、可点击的详细参考回答小卡片，以及完整版口述稿。";
    }
  };
  render();
})();