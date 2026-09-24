(function(){
  const root=document.documentElement;
  const saved=localStorage.getItem('kittel-theme');
  root.dataset.theme=saved==='light'||saved==='dark'?saved:'dark';
  const button=document.getElementById('theme-toggle');
  const icon=document.getElementById('theme-icon');
  const sun='<circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>';
  const moon='<path d="M20 15.6A8.5 8.5 0 0 1 8.4 4 8.5 8.5 0 1 0 20 15.6Z"></path>';
  function sync(){if(icon)icon.innerHTML=root.dataset.theme==='dark'?sun:moon}
  sync();
  if(button)button.addEventListener('click',()=>{
    root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
    localStorage.setItem('kittel-theme',root.dataset.theme);
    sync();
    window.dispatchEvent(new Event('research-theme-change'));
  });
})();