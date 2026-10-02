/* Shared canvas-sampled refraction, inspired by Liquid Glass Studio (MIT).
   CSS backdrop-filter blurs arbitrary DOM behind a panel; WebGL bends the
   animated lattice texture at its rounded edge. No raster screenshots or
   fake static highlights are used. */
(function () {
  if (window.__siteGlassStarted) return;
  window.__siteGlassStarted = true;
  const start = () => {
    if (!document.querySelector('link[data-site-glass-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet'; style.href = '/css/site-glass.css';
      style.dataset.siteGlassStyle = '';
      document.head.appendChild(style);
    }
    const background = document.createElement('canvas');
    const optics = document.createElement('canvas');
    background.id = 'site-lattice-background';
    optics.id = 'site-glass-optics';
    background.setAttribute('aria-hidden', 'true');
    optics.setAttribute('aria-hidden', 'true');
    document.body.prepend(optics);
    document.body.prepend(background);
    const ctx = background.getContext('2d', { alpha: true });
    if (!ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const gl = optics.getContext('webgl2', { alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' });
    const max = 32;
    const selector = '.site-header,.liquid-panel,.project-card,.tool-strip a,.card,.phase-panel,.reported-strip,.stats > div,.note-grid article,.header-wrapper,.home-post-item,.post-content-container,.post-content,.page-content,.archive-list,.category-list,.tag-list,.page-main-content-middle .main-content,.liquid-button,.top-action';
    let program, vao, texture, countLocation, rectanglesLocation, radiiLocation, priorityLocation, viewportLocation, textureLocation, lightLocation;
    if (gl) {
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };
      try {
        program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
#define N ${max}
uniform vec2 viewport;uniform int count;uniform vec4 rects[N];uniform float radii[N];uniform float priority[N];uniform sampler2D image;uniform float light;
out vec4 color;
float sdf(vec2 p,vec4 r,float rad){vec2 q=abs(p-r.xy-r.zw*.5)-(r.zw*.5-rad);return length(max(q,0.))+min(max(q.x,q.y),0.)-rad;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,viewport.y-gl_FragCoord.y);
 int hit=-1;float depth=-1.e5;float front=-1.;
 for(int i=0;i<N;i++){if(i>=count)break;float d=sdf(p,rects[i],radii[i]);if(d<.5&&(priority[i]>front||(priority[i]==front&&d>depth))){hit=i;depth=d;front=priority[i];}}
 if(hit<0){color=vec4(0.);return;}
 vec4 r=rects[hit];float rad=radii[hit];
 vec2 n=normalize(vec2(sdf(p+vec2(.7,0.),r,rad)-sdf(p-vec2(.7,0.),r,rad),sdf(p+vec2(0.,.7),r,rad)-sdf(p-vec2(0.,.7),r,rad)));
 float edge=1.-smoothstep(0.,16.,-depth);
 vec2 uv=vec2(gl_FragCoord.x/viewport.x,gl_FragCoord.y/viewport.y);
 vec2 shift=n*edge*11./viewport;
 vec4 a=texture(image,clamp(uv+shift*1.18,0.001,0.999));
 vec4 b=texture(image,clamp(uv+shift,0.001,0.999));
 vec4 c=texture(image,clamp(uv+shift*.82,0.001,0.999));
 vec2 aperture=vec2(-n.y,n.x)*edge*2.8/viewport;
 vec4 sideA=texture(image,clamp(uv+shift+aperture,0.001,0.999));
 vec4 sideB=texture(image,clamp(uv+shift-aperture,0.001,0.999));
 float alpha=max(max(a.a,b.a),max(c.a,max(sideA.a,sideB.a)))*edge*.57;
 vec3 rgb=mix(vec3(a.r,b.g,c.b),(sideA.rgb+sideB.rgb)*.5,.24*edge);
 float fresnel=pow(1.-smoothstep(0.,2.2,-depth),2.);
 float facing=max(dot(n,normalize(vec2(-.65,-.76))),0.);
 float spec=pow(facing,5.)*fresnel;
 vec3 gleam=vec3(1.)*(light>.5?.065:.11)*fresnel+vec3(1.)*spec*(light>.5?.08:.14);
 color=vec4(rgb*alpha+gleam,clamp(alpha+fresnel*.065+spec*.05,0.,.62));
}`));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'p');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        countLocation = gl.getUniformLocation(program, 'count');
        rectanglesLocation = gl.getUniformLocation(program, 'rects[0]');
        radiiLocation = gl.getUniformLocation(program, 'radii[0]');
        priorityLocation = gl.getUniformLocation(program, 'priority[0]');
        viewportLocation = gl.getUniformLocation(program, 'viewport');
        textureLocation = gl.getUniformLocation(program, 'image');
        lightLocation = gl.getUniformLocation(program, 'light');
      } catch (error) {
        console.warn('Site glass WebGL fallback:', error);
        optics.style.display = 'none';
        program = null;
      }
    } else optics.style.display = 'none';

    const isLight = () => document.documentElement.dataset.theme === 'light' ||
      (!document.documentElement.dataset.theme && !document.body.classList.contains('dark-mode'));
    let width = 0, height = 0, dpr = 1, frame = 0, last = -Infinity, scrollTimer = 0;
    const resize = () => {
      width = innerWidth; height = innerHeight;
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      background.width = Math.round(width*dpr); background.height = Math.round(height*dpr);
      background.style.width = width+'px'; background.style.height = height+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if (program) { optics.width = width; optics.height = height; optics.style.width = width+'px'; optics.style.height = height+'px'; }
    };
    const paint = time => {
      if (!reduce.matches && time-last<35) { frame=requestAnimationFrame(paint); return; }
      last=time;
      ctx.clearRect(0,0,width,height);
      const light=isLight(), ink=light?'38,49,65':'225,231,239';
      const step=Math.max(52,Math.min(76,width/8));
      const cols=Math.ceil(width/step)+2, rows=Math.ceil(height/step)+2;
      const cells=[];
      for(let j=0;j<rows;j++){
        const row=[];
        for(let i=0;i<cols;i++){
          const x=(i-1)*step, baseY=(j-1)*step;
          const y=baseY+7*Math.sin(x*.01-(reduce.matches?0:time*.00035)+j*.15);
          row.push({x:x+baseY*.1,y,a:Math.min(1,.28+.65*Math.abs(x-width/2)/Math.max(width/2,1)),ion:(i+j)%2});
        }
        cells.push(row);
      }
      ctx.lineWidth=.8;
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
        const p=cells[j][i];ctx.strokeStyle=`rgba(${ink},${.088*p.a})`;
        for(const next of [cells[j][i+1],cells[j+1]&&cells[j+1][i]])if(next){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(next.x,next.y);ctx.stroke();}
        const r=p.ion?2.1:3.1;
        ctx.fillStyle=`rgba(${ink},${(p.ion?.31:.47)*p.a})`;
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
      }
      if(program){
        const rects=new Float32Array(max*4), radii=new Float32Array(max), priorities=new Float32Array(max);
        const candidates=[...document.querySelectorAll(selector)];
        candidates.forEach(el=>{el.dataset.siteGlassLayer=el.parentElement?.closest(selector)?'embedded':'surface';});
        const visible=candidates.filter(el=>el.dataset.siteGlassLayer==='surface').filter(el=>{
          const r=el.getBoundingClientRect();return r.width>5&&r.height>5&&r.bottom>0&&r.top<height&&r.right>0&&r.left<width;
        }).slice(0,max);
        visible.forEach((el,i)=>{
          const r=el.getBoundingClientRect();rects.set([r.left,r.top,r.width,r.height],i*4);
          radii[i]=Math.min(parseFloat(getComputedStyle(el).borderRadius)||20,r.width/2,r.height/2);
          priorities[i]=el.matches('.site-header,.header-wrapper')?1:0;
        });
        gl.viewport(0,0,optics.width,optics.height);
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,background);
        gl.uniform1i(textureLocation,0);gl.uniform1i(countLocation,visible.length);
        gl.uniform4fv(rectanglesLocation,rects);gl.uniform1fv(radiiLocation,radii);
        gl.uniform1fv(priorityLocation,priorities);
        gl.uniform2f(viewportLocation,optics.width,optics.height);
        gl.uniform1f(lightLocation,light?1:0);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      }
      if(!reduce.matches)frame=requestAnimationFrame(paint);
    };
    const refresh=()=>{cancelAnimationFrame(frame);resize();frame=requestAnimationFrame(paint);};
    addEventListener('resize',refresh,{passive:true});
    addEventListener('scroll',()=>{
      optics.style.visibility='hidden';
      clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=>{
        cancelAnimationFrame(frame);last=-Infinity;paint(performance.now());
        optics.style.visibility='visible';
      },140);
    },{passive:true,capture:true});
    reduce.addEventListener('change',refresh);
    const observer=new MutationObserver(()=>{if(reduce.matches)refresh();});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    refresh();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
