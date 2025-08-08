// script_v2.js
// Improved platformer with double-jump, back-scrolling, platform spacing adjustments,
// attempts to load sprites from ./assets/warrior/ and falls back to shapes.
// Also includes a fire-flow cursor particle system and smooth link redirect animations.
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = canvas.width, H = canvas.height;
  let devicePixelRatio = window.devicePixelRatio || 1;

  // High-DPI scaling
  function fixDPI(){
    devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    W = rect.width; H = rect.height;
  }
  window.addEventListener('resize', fixDPI);
  fixDPI();

  // Game state
  const gravity = 0.9;
  const player = {x:60,y:260,w:34,h:44,vx:0,vy:0,onGround:false,jumpCount:0,facing:1,anim:'idle',frame:0,frameTimer:0};
  const keys = {};
  let scrollX = 0;
  const platforms = [];
  const orbs = [];
  const terminals = [];
  let repoList = [];

  // Platform spacing and layout tuned for smoother flow
  function makeLevel(){
    platforms.length = 0; orbs.length = 0; terminals.length = 0;
    platforms.push({x:-1000,y:H-60,w:5000,h:60});
    const spacing = 180; // reduced gap
    for(let i=0;i<12;i++){
      const px = 180 + i * spacing;
      const py = H - 140 - ((i%4) * 30);
      platforms.push({x:px,y:py,w:140,h:16});
      if(i%2===0) orbs.push({x:px+50,y:py-28,r:8,collected:false,skill:sampleSkill(i)});
      if(i%3===0) terminals.push({x:px+80,y:py-70,w:40,h:40,repoIndex: Math.floor(i/3)});
    }
    terminals.push({x:180+12*spacing+40,y:H-140-30,w:52,h:52,contact:true});
  }

  function sampleSkill(i){
    const pool = ['C++','Java','Python','JavaScript','Lua','Rust','React','Node.js'];
    return pool[i % pool.length];
  }

  // Input
  window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

  // Physics & controls
  function update(dt){
    // left/right
    if(keys['arrowleft']||keys['a']) { player.vx = -4.2; player.facing = -1; if(player.onGround) setAnim('run'); }
    else if(keys['arrowright']||keys['d']) { player.vx = 4.2; player.facing = 1; if(player.onGround) setAnim('run'); }
    else { player.vx = 0; if(player.onGround) setAnim('idle'); }

    // jump: allow up to 2 jumps
    if((keys['arrowup']||keys['w']||keys[' ']) && player.canJump){
      // prevent holding jump to spam: detect "pressed" via a flag
    }
    // manual jump handling: on keydown event
    // handled via keydown listener that checks lastPressedJump flag
    // Implement jump on keydown only
  }

  // We'll implement precise jump detection with event listeners to allow double-jump
  let lastJumpKey = false;
  window.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase()==='arrowup' || e.key.toLowerCase()==='w' || e.key===' '){
      if(!lastJumpKey){ // edge: key pressed now
        if(player.onGround){
          player.vy = -13.2; player.onGround = false; player.jumpCount = 1; setAnim('jump');
        } else if(player.jumpCount < 2){
          // double jump
          player.vy = -11.0; player.jumpCount++; setAnim('jump');
        }
      }
      lastJumpKey = true;
    }
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key.toLowerCase()==='arrowup' || e.key.toLowerCase()==='w' || e.key===' '){
      lastJumpKey = false;
    }
  });

  function setAnim(name){
    if(player.anim !== name){ player.anim = name; player.frame = 0; player.frameTimer = 0; }
  }

  // Collision helper
  function collideRect(x1,y1,w1,h1,x2,y2,w2,h2){
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // Update physics loop
  function physicsUpdate(){
    // apply gravity & velocity
    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;

    // platform collision
    player.onGround = false;
    for(const p of platforms){
      if(collideRect(player.x,player.y,player.w,player.h, p.x, p.y, p.w, p.h)){
        if(player.vy > 0 && (player.y + player.h) - p.y < 32){ // hit from top
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.jumpCount = 0;
        }
      }
    }

    // orb collect
    for(const o of orbs){
      if(o.collected) continue;
      if(collideRect(player.x,player.y,player.w,player.h, o.x, o.y - o.r, o.r*2, o.r*2)){
        o.collected = true;
        showSkillPopup(o.skill);
      }
    }

    // terminals interact via 'e'
    if(keys['e']){
      for(const t of terminals){
        if(collideRect(player.x,player.y,player.w,player.h, t.x, t.y, t.w, t.h)){
          if(t.contact) showContactModal();
          else showRepoTerminal(t.repoIndex);
        }
      }
    }

    // camera: allow back and forth scrolling
    const leftMargin = W * 0.25;
    const rightMargin = W * 0.55;
    if(player.x - scrollX < leftMargin){
      scrollX = Math.max(0, player.x - leftMargin);
    } else if(player.x - scrollX > rightMargin){
      scrollX = player.x - rightMargin;
    }
  }

  // Rendering --------------------------------
  const spriteStore = {
    warrior: {loaded:false, frames:{idle:[],run:[],jump:[]}, frameW:0, frameH:0},
    orbImg: null,
    terminalImg: null,
    platformImg: null
  };

  // Try to load sprites from assets/warrior folder (common names)
  // We will attempt a small set of possible filenames and gracefully continue if absent
  const possibleSprites = {
    run: ['run.png','run_anim.png','warrior_run.png','warrior_run_strip.png'],
    idle: ['idle.png','idle_anim.png','warrior_idle.png','warrior_idle_strip.png'],
    jump: ['jump.png','warrior_jump.png']
  };

  function loadSprites(callback){
    // helper to check image existence by attempting to load
    let toLoad = 0, loaded = 0;
    function attemptLoad(name, onload){
      toLoad++;
      const img = new Image();
      img.src = './assets/warrior/' + name;
      img.onload = ()=>{ loaded++; onload(img); checkDone(); };
      img.onerror = ()=>{ loaded++; checkDone(); };
    }
    function checkDone(){ if(loaded>=toLoad) callback(); }
    // try each possible file once (we don't know exact names)
    Object.keys(possibleSprites).forEach(k=>{
      possibleSprites[k].forEach(fn=>{
        attemptLoad(fn, (img)=>{
          // crude detection: if width > height it's probably a spritesheet
          // we push to frames as a single image and mark as loaded; later code handles strips
          if(img.width>10){
            spriteStore.warrior.loaded = true;
            spriteStore.warrior.frames[k].push(img);
            spriteStore.warrior.frameW = img.width;
            spriteStore.warrior.frameH = img.height;
          }
        });
      });
    });
    // also try orb/platform/terminal images
    toLoad++; loaded = loaded - 1; // fudge to wait for others
    const orb = new Image(); orb.src = './assets/orb.png'; orb.onload=()=>{spriteStore.orbImg=orb; loaded++; checkDone();}; orb.onerror=()=>{loaded++; checkDone();};
    const term = new Image(); term.src='./assets/terminal.png'; term.onload=()=>{spriteStore.terminalImg=term; loaded++; checkDone();}; term.onerror=()=>{loaded++; checkDone();};
    const plat = new Image(); plat.src='./assets/platform.png'; plat.onload=()=>{spriteStore.platformImg=plat; loaded++; checkDone();}; plat.onerror=()=>{loaded++; checkDone();};
  }

  // HUD / UI helpers
  function showSkillPopup(skill){
    const modal = document.getElementById('modal');
    const content = document.getElementById('modalContent');
    content.innerHTML = `<h3>Skill Unlocked</h3><p style="font-size:18px">${skill}</p><p class="muted">Collected inside the interactive portfolio.</p>`;
    modal.classList.remove('hidden');
  }
  function showContactModal(){
    const modal = document.getElementById('modal'), content = document.getElementById('modalContent');
    content.innerHTML = `<h3>Contact</h3><p>Email: <a href="mailto:ms.dheerajmurthy@iiitb.ac.in">ms.dheerajmurthy@iiitb.ac.in</a></p>
    <p>GitHub: <a href="https://github.com/Dheeraj-Murthy" target="_blank">Dheeraj-Murthy</a></p>`;
    modal.classList.remove('hidden');
  }
  document.getElementById('modalClose').addEventListener('click', ()=> { document.getElementById('modal').classList.add('hidden'); });

  // GitHub fetch + project list
  async function fetchRepos(){
    try {
      const res = await fetch('https://api.github.com/users/Dheeraj-Murthy/repos?per_page=100');
      if(!res.ok) throw new Error('github api error');
      repoList = await res.json();
      populateProjectList();
    } catch(e){
      repoList = [{name:'ccl_project',description:'CPRMS portal',html_url:'https://github.com/Dheeraj-Murthy/ccl_project'}];
      populateProjectList();
    }
  }
  function populateProjectList(){
    const list = document.getElementById('project-list'); list.innerHTML='';
    for(const r of repoList){ const div=document.createElement('div'); div.className='card'; div.innerHTML=`<h3>${r.name}</h3><p class="muted">${r.description||''}</p><p><a target="_blank" class="animated-link" href="${r.html_url}">View on GitHub</a></p>`; list.appendChild(div); }
    // attach animated link click handlers
    document.querySelectorAll('.animated-link').forEach(a=>{
      a.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const href = a.href;
        // animate then open
        a.style.transition='transform .18s ease, opacity .18s ease';
        a.style.transform='scale(.96)';
        a.style.opacity='0.6';
        setTimeout(()=> window.open(href,'_blank'), 220);
      });
    });
  }

  // rendering functions
  function draw(){
    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // background
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#04102a'); g.addColorStop(1,'#020317');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // parallax grid
    ctx.save();
    ctx.translate(- (scrollX * 0.2) % 40,0);
    ctx.strokeStyle = 'rgba(0,179,255,0.035)';
    ctx.lineWidth = 1;
    for(let x=0;x<W+40;x+=40){ ctx.beginPath(); ctx.moveTo(x, H*0.65); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.restore();

    // platforms
    for(const p of platforms){
      const px = p.x - scrollX, py = p.y;
      // draw platform image if available
      if(spriteStore.platformImg){ ctx.drawImage(spriteStore.platformImg, px, py, p.w, p.h); }
      else {
        ctx.fillStyle = '#07243d'; roundRect(ctx, px, py, p.w, p.h, 6);
        ctx.strokeStyle = 'rgba(0,179,255,0.12)'; ctx.lineWidth=2; ctx.stroke();
      }
    }

    // orbs
    for(const o of orbs){
      if(o.collected) continue;
      const ox = o.x - scrollX, oy = o.y;
      if(spriteStore.orbImg){ ctx.drawImage(spriteStore.orbImg, ox-12, oy-12, 24,24); }
      else {
        const grad = ctx.createRadialGradient(ox,oy,1,ox,oy,20); grad.addColorStop(0,'#baf2ff'); grad.addColorStop(1,'#00b3ff22');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ox,oy,o.r,0,Math.PI*2); ctx.fill();
        ctx.shadowColor = '#00b3ff55'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
      }
    }

    // terminals
    for(const t of terminals){
      const tx = t.x - scrollX, ty = t.y;
      if(spriteStore.terminalImg) ctx.drawImage(spriteStore.terminalImg, tx, ty, t.w, t.h);
      else {
        ctx.fillStyle = t.contact ? '#8b5cf6' : '#00d3ff'; roundRect(ctx, tx, ty, t.w, t.h, 6);
        ctx.fillStyle = '#021126'; ctx.font = '14px sans-serif'; ctx.fillText(t.contact ? '✉' : '⌘', tx + t.w/2 - 6, ty + t.h/2 + 6);
      }
    }

    // player: draw sprite if available with simple frame handling, else rectangle
    const px = player.x - scrollX, py = player.y;
    if(spriteStore.warrior.loaded){
      // for simplicity use first available image for current anim and draw scaled
      let img = null;
      if(player.anim==='run' && spriteStore.warrior.frames.run.length) img = spriteStore.warrior.frames.run[0];
      else if(player.anim==='jump' && spriteStore.warrior.frames.jump.length) img = spriteStore.warrior.frames.jump[0];
      else if(player.anim==='idle' && spriteStore.warrior.frames.idle.length) img = spriteStore.warrior.frames.idle[0];
      if(img){
        const sw = img.width, sh = img.height;
        const dw = player.w*1.8, dh = player.h*1.8;
        ctx.save();
        // flip if facing left
        if(player.facing<0){ ctx.translate(px+dw/2, 0); ctx.scale(-1,1); ctx.translate(-px-dw/2,0); }
        ctx.drawImage(img, px - (dw-player.w)/2, py - (dh-player.h), dw, dh);
        ctx.restore();
      } else {
        // fallback rect
        ctx.fillStyle = '#dbefff'; roundRect(ctx, px, py, player.w, player.h, 4);
      }
    } else {
      ctx.fillStyle = '#dbefff'; roundRect(ctx, px, py, player.w, player.h, 4);
      ctx.strokeStyle = '#00b3ffaa'; ctx.lineWidth = 2; ctx.strokeRect(px, py, player.w, player.h);
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(12,12,220,48);
    ctx.fillStyle = '#aee9ff'; ctx.font = '13px monospace'; ctx.fillText('Skill Orbs: ' + orbs.filter(o=>o.collected).length + ' / ' + orbs.length, 22, 32);
    ctx.fillText('Double jumps used: ' + player.jumpCount + ' / 2', 22, 46);
  }

  // round rect helper
  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.closePath(); ctx.fill(); }

  // main loop
  let last = performance.now();
  function loop(now){
    const dt = (now - last)/1000; last = now;
    physicsUpdate();
    draw();
    requestAnimationFrame(loop);
  }

  // lazy init only when visible
  function startWhenVisible(){
    const hero = document.getElementById('hero');
    const obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting){
        makeLevel();
        loadSprites(()=>{});
        fetchRepos();
        loop(performance.now());
        obs.disconnect();
      }
    }, {threshold:0.2});
    obs.observe(hero);
  }
  startWhenVisible();

  // GitHub functions (same as before)
  async function fetchRepos(){ try{ const res = await fetch('https://api.github.com/users/Dheeraj-Murthy/repos?per_page=100'); if(!res.ok) throw new Error('err'); repoList = await res.json(); populateProjectList(); }catch(e){ repoList=[{name:'ccl_project',description:'CPRMS portal',html_url:'https://github.com/Dheeraj-Murthy/ccl_project'}]; populateProjectList(); } }

  // modal helpers
  function showRepoTerminal(idx){ const t = terminals[idx]; const modal = document.getElementById('modal'), content = document.getElementById('modalContent'); const repo = (t && t.repoData) || repoList[idx] || {name:'Project',description:'(no data)',html_url:'#'}; content.innerHTML = `<h3>${repo.name}</h3><p>${repo.description||''}</p><p><a target='_blank' class='animated-link' href='${repo.html_url}'>Open on GitHub</a></p>`; modal.classList.remove('hidden'); }

  // attach project data to terminals after repo fetch completes
  function populateProjectList(){ const list = document.getElementById('project-list'); list.innerHTML=''; for(const r of repoList){ const div=document.createElement('div'); div.className='card'; div.innerHTML=`<h3>${r.name}</h3><p class='muted'>${r.description||''}</p><p><a target='_blank' class='animated-link' href='${r.html_url}'>View on GitHub</a></p>`; list.appendChild(div);} document.querySelectorAll('.animated-link').forEach(a=>{ a.addEventListener('click',(ev)=>{ ev.preventDefault(); const href=a.href; a.style.transition='transform .18s ease, opacity .18s ease'; a.style.transform='scale(.96)'; a.style.opacity='0.6'; setTimeout(()=> window.open(href,'_blank'), 220); }); }); // map repos to in-game terminals
    terminals.forEach((t,idx)=>{ if(!t.contact) t.repoData = repoList[idx % repoList.length]; });
  }

  // initial platform/player placement after level creation
  // create platforms and place player on first main platform
  // makeLevel handles platforms; set player near start
  function initPlayerPos(){ player.x = 60; player.y = H-200; player.vx=0; player.vy=0; player.jumpCount=0; scrollX=0; }

  // start positions after makeLevel()
  // set initial player after makeLevel is called in startWhenVisible()

  // Fire-flow cursor particle system
  (function cursorSystem(){
    const c = document.getElementById('cursorCanvas');
    const ctxc = c.getContext('2d');
    let w = window.innerWidth, h = window.innerHeight;
    c.width = w * devicePixelRatio; c.height = h * devicePixelRatio; c.style.width = w + 'px'; c.style.height = h + 'px'; ctxc.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    const particles = [];
    window.addEventListener('resize', ()=>{ w = window.innerWidth; h = window.innerHeight; c.width = w * devicePixelRatio; c.height = h * devicePixelRatio; c.style.width = w + 'px'; c.style.height = h + 'px'; ctxc.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); });
    let mx = w/2, my = h/2;
    window.addEventListener('mousemove', (e)=>{ mx = e.clientX; my = e.clientY; spawn(mx,my); });
    window.addEventListener('mousedown', (e)=>{ for(let i=0;i<6;i++) spawn(mx,my,true); });

    function spawn(x,y,burst=false){
      const count = burst ? 12 : 3;
      for(let i=0;i<count;i++){
        particles.push({
          x: x + (Math.random()-0.5)*6,
          y: y + (Math.random()-0.5)*6,
          vx: (Math.random()-0.5)*2 * (burst?3:1),
          vy: (Math.random()-0.8)*2 * (burst?2:1),
          life: 1.0,
          size: 6 + Math.random()*6,
          hue: 200 + Math.random()*60
        });
      }
    }

    function step(){
      ctxc.clearRect(0,0,c.width, c.height);
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.02;
        // draw fire-like glow (blue -> purple -> orange)
        const alpha = Math.max(0, p.life);
        const grd = ctxc.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, `hsla(${p.hue},100%,70%,${alpha})`);
        grd.addColorStop(0.5, `hsla(${p.hue+40},90%,50%,${alpha*0.6})`);
        grd.addColorStop(1, `hsla(${p.hue+120},90%,40%,${alpha*0.12})`);
        ctxc.fillStyle = grd; ctxc.beginPath(); ctxc.arc(p.x, p.y, p.size, 0, Math.PI*2); ctxc.fill();
        if(p.life<=0) particles.splice(i,1);
      }
      requestAnimationFrame(step);
    }
    step();
  })();

  // Start: minor init
  makeLevel();
  initPlayerPos();
})();