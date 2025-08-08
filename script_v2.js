(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = canvas.clientWidth, H = canvas.clientHeight;
  let dpr = window.devicePixelRatio || 1;

  function fixDPI(){
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    W = rect.width; H = rect.height;
  }
  window.addEventListener('resize', fixDPI);
  fixDPI();

  const gravity = 0.9;
  const keys = {};
  let scrollX = 0;
  const platforms = [];
  const orbs = [];
  const terminals = [];
  const checkpoints = [];
  let lastCheckpoint = null;
  let repoList = [];

  class Player {
    constructor(options) {
      this.position = options.position;
      this.velocity = { x: 0, y: 0 };
      this.width = 34;
      this.height = 44;
      this.onGround = false;
      this.jumpCount = 0;
      this.facing = 1; // 1 for right, -1 for left

      this.animations = options.animations;
      this.image = new Image();
      this.image.src = options.imgSrc;
      this.frameRate = options.frameRate;
      this.frameBuffer = options.frameBuffer;
      this.currentFrame = 0;
      this.elapsedFrames = 0;

      this.sprites = {};
      for (const key in this.animations) {
        const sprite = new Image();
        sprite.src = this.animations[key].imgSrc;
        this.sprites[key] = {
          image: sprite,
          frameRate: this.animations[key].frameRate,
          frameBuffer: this.animations[key].frameBuffer,
        };
      }
      this.switchSprite('Idle');
    }

    switchSprite(name) {
      if (this.image === this.sprites[name].image) return;
      this.image = this.sprites[name].image;
      this.frameRate = this.sprites[name].frameRate;
      this.frameBuffer = this.sprites[name].frameBuffer;
      this.currentFrame = 0;
    }

    draw() {
      const px = this.position.x - scrollX;
      const py = this.position.y;
      const sW = this.image.width / this.frameRate;
      const sH = this.image.height;
      const dw = this.width * 1.8;
      const dh = this.height * 1.8;
      ctx.drawImage(this.image, this.currentFrame * sW, 0, sW, sH, px - (dw - this.width) / 2, py - (dh - this.height), dw, dh);
    }

    update() {
      this.elapsedFrames++;
      if (this.elapsedFrames % this.frameBuffer === 0) {
        if (this.currentFrame < this.frameRate - 1) {
          this.currentFrame++;
        } else {
          this.currentFrame = 0;
        }
      }
      this.draw();
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
      this.velocity.y += gravity;
    }
  }

  const player = new Player({
    position: { x: 100, y: 300 },
    imgSrc: "./assets/warrior/Idle.png",
    frameRate: 8,
    animations: {
      Idle: { imgSrc: "./assets/warrior/Idle.png", frameRate: 8, frameBuffer: 7 },
      Run: { imgSrc: "./assets/warrior/Run.png", frameRate: 8, frameBuffer: 5 },
      Jump: { imgSrc: "./assets/warrior/Jump.png", frameRate: 2, frameBuffer: 10 },
      Fall: { imgSrc: "./assets/warrior/Fall.png", frameRate: 2, frameBuffer: 10 },
      FallLeft: { imgSrc: "./assets/warrior/FallLeft.png", frameRate: 2, frameBuffer: 10 },
      JumpLeft: { imgSrc: "./assets/warrior/JumpLeft.png", frameRate: 2, frameBuffer: 10 },
      IdleLeft: { imgSrc: "./assets/warrior/IdleLeft.png", frameRate: 8, frameBuffer: 7 },
      RunLeft: { imgSrc: "./assets/warrior/RunLeft.png", frameRate: 8, frameBuffer: 5 },
      Attack1: { imgSrc: "./assets/warrior/Attack1.png", frameRate: 4, frameBuffer: 5 },
    },
  });

  function makeLevel(){
    platforms.length = 0; orbs.length = 0; terminals.length = 0; checkpoints.length = 0;
    lastCheckpoint = {x:60, y:260};
    platforms.push({x:-1000,y:H-60,w:6000,h:60});
    const spacing = 160;
    for(let i=0;i<14;i++){
      const px = 140 + i*spacing;
      const py = H - 150 - ((i%4)*28);
      platforms.push({x:px,y:py,w:140,h:16});
      if(i%2===0) orbs.push({x:px+60,y:py-26,r:8,collected:false,skill:sampleSkill(i)});
      if(i%3===0) terminals.push({x:px+80,y:py-70,w:44,h:44,repoIndex: Math.floor(i/3)});
      if(i === 5 || i === 11) checkpoints.push({x:px, y:py-40, w:20, h:40, activated:false});
    }
    terminals.push({x:140+14*spacing+60,y:H-150-20,w:56,h:56,contact:true});
  }
  function sampleSkill(i){ const pool=['C++','Java','Python','JavaScript','Lua','Rust','React','Node.js']; return pool[i % pool.length]; }

  window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

  let lastJumpKey = false;
  window.addEventListener('keydown', (e)=>{
    const key = e.key.toLowerCase();
    if(key==='arrowup' || key==='w' || key===' '){
      if(!lastJumpKey){
        if(player.onGround){
          player.velocity.y = -13; player.onGround=false; player.jumpCount = 1;
        } else if(player.jumpCount < 2){
          player.velocity.y = -11; player.jumpCount++;
        }
      }
      lastJumpKey = true;
    }
    if(e.key===' '){ e.preventDefault(); }
    if(key === 'f') {
        player.switchSprite('Attack1');
    }
  });
  window.addEventListener('keyup', (e)=>{ const key = e.key.toLowerCase(); if(key==='arrowup' || key==='w' || key===' ') lastJumpKey = false; });

  function physicsUpdate(){
    if(keys['a'] || keys['arrowleft']){
      player.velocity.x = -4.2;
      player.facing = -1;
      player.switchSprite('RunLeft');
    } else if(keys['d'] || keys['arrowright']){
      player.velocity.x = 4.2;
      player.facing = 1;
      player.switchSprite('Run');
    } else {
      player.velocity.x = 0;
      if (player.facing === 1) player.switchSprite('Idle');
      else player.switchSprite('IdleLeft');
    }

    if (player.velocity.y < 0) {
        if (player.facing === 1) player.switchSprite('Jump');
        else player.switchSprite('JumpLeft');
    } else if (player.velocity.y > 0) {
        if (player.facing === 1) player.switchSprite('Fall');
        else player.switchSprite('FallLeft');
    }

    player.onGround = false;
    for(const p of platforms){
        // check for vertical collision (landing on top)
        if (player.position.x + player.width > p.x &&
            player.position.x < p.x + p.w &&
            player.position.y + player.height <= p.y &&
            player.position.y + player.height + player.velocity.y >= p.y) {
            player.velocity.y = 0;
            player.position.y = p.y - player.height;
            player.onGround = true;
            player.jumpCount = 0;
        }

        // check for horizontal collision (hitting the sides)
        if (player.position.y + player.height > p.y &&
            player.position.y < p.y + p.h) {
            if (player.position.x + player.width > p.x &&
                player.position.x < p.x + p.w) {
                // collision from the left
                if (player.velocity.x > 0) {
                    player.velocity.x = 0;
                    player.position.x = p.x - player.width;
                }
                // collision from the right
                else if (player.velocity.x < 0) {
                    player.velocity.x = 0;
                    player.position.x = p.x + p.w;
                }
            }
        }
    }

    for(const o of orbs){
      if(o.collected) continue;
      if(collideRect(player.position.x,player.position.y,player.width,player.height, o.x, o.y - o.r, o.r*2, o.r*2)){
        o.collected = true; showSkillPopup(o.skill);
      }
    }

    if(keys['e']){
      for(const t of terminals){
        if(collideRect(player.position.x,player.position.y,player.width,player.height, t.x, t.y, t.w, t.h)){
          if(t.contact) showContactModal();
          else showRepoTerminal(t.repoIndex);
        }
      }
    }

    for(const c of checkpoints){
      if(!c.activated && collideRect(player.position.x,player.position.y,player.width,player.height, c.x, c.y, c.w, c.h)){
        c.activated = true;
        lastCheckpoint = {x: c.x, y: c.y - player.height};
      }
    }

    if(player.position.y > H + 200){
      player.position.x = lastCheckpoint.x;
      player.position.y = lastCheckpoint.y;
      player.velocity.y = 0;
    }

    const leftMargin = W * 0.25;
    const rightMargin = W * 0.55;
    if(player.position.x - scrollX < leftMargin){
      scrollX = Math.max(0, player.position.x - leftMargin);
    } else if(player.position.x - scrollX > rightMargin){
      scrollX = player.position.x - rightMargin;
    }
  }

  function collideRect(x1,y1,w1,h1,x2,y2,w2,h2){ return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2; }

  function draw(now, dt){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#061230'); g.addColorStop(1,'#021025');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    ctx.save(); ctx.translate(- (scrollX * 0.22) % 40,0); ctx.strokeStyle = 'rgba(0,179,255,0.05)'; ctx.lineWidth = 1;
    for(let x=0;x<W+40;x+=40){ ctx.beginPath(); ctx.moveTo(x, H*0.65); ctx.lineTo(x, H); ctx.stroke(); } ctx.restore();

    for(const p of platforms){
      const px = p.x - scrollX, py = p.y;
      const topH = 6;
      ctx.fillStyle = '#0a3d5a';
      ctx.fillRect(px, py + topH, p.w, p.h - topH);
      ctx.fillStyle = '#1a5a7f';
      ctx.fillRect(px, py, p.w, topH);
    }

    for(const c of checkpoints){
        const cx = c.x - scrollX, cy = c.y;
        ctx.fillStyle = c.activated ? '#ffca28' : '#aaa';
        ctx.fillRect(cx, cy, 2, c.h);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + c.w, cy + c.h / 4);
        ctx.lineTo(cx, cy + c.h / 2);
        ctx.closePath();
        ctx.fill();
    }

    for(const o of orbs){
      if(o.collected) continue;
      const ox = o.x - scrollX, oy = o.y;
      const grad = ctx.createRadialGradient(ox,oy,1,ox,oy,20); grad.addColorStop(0,'#ffd6a8'); grad.addColorStop(1,'#ff6b6b22'); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ox,oy,o.r,0,Math.PI*2); ctx.fill(); ctx.shadowColor = '#ff9f6a44'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    }

    for(const t of terminals){
      const tx = t.x - scrollX, ty = t.y;
      ctx.fillStyle = t.contact ? '#ef6c00' : '#ffca28'; roundRect(ctx, tx, ty, t.w, t.h, 6); ctx.fillStyle='#021126'; ctx.font='14px sans-serif'; ctx.fillText(t.contact ? '✉' : '⌘', tx + t.w/2 - 6, ty + t.h/2 + 6);
    }

    player.update();

    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(12,12,260,52);
    ctx.fillStyle = '#fff0d6'; ctx.font = '13px monospace'; ctx.fillText('Skill Orbs: ' + orbs.filter(o=>o.collected).length + ' / ' + orbs.length, 22, 32);
    ctx.fillText('Double jumps used: ' + player.jumpCount + ' / 2', 22, 48);
  }

  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.closePath(); ctx.fill(); }

  let last = performance.now();
  function loop(now){
    const dt = (now - last)/1000; last = now;
    physicsUpdate();
    draw(now, dt);
    requestAnimationFrame(loop);
  }

  function startWhenVisible(){
    const hero = document.getElementById('hero');
    const obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting){
        makeLevel();
        fetchRepos();
        const modal = document.getElementById('modal'); if(modal) modal.classList.add('hidden');
        loop(performance.now());
        obs.disconnect();
      }
    }, {threshold:0.2});
    obs.observe(hero);
  }
  startWhenVisible();

  async function fetchRepos(){ try{ const res = await fetch('https://api.github.com/users/Dheeraj-Murthy/repos?per_page=100'); if(!res.ok) throw new Error('err'); repoList = await res.json(); populateProjectList(); }catch(e){ repoList=[{name:'ccl_project',description:'CPRMS portal',html_url:'https://github.com/Dheeraj-Murthy/ccl_project'}]; populateProjectList(); } }
  function populateProjectList(){ const list = document.getElementById('project-list'); list.innerHTML=''; for(const r of repoList){ const div=document.createElement('div'); div.className='card'; div.innerHTML=`<h3>${r.name}</h3><p class='muted'>${r.description||''}</p><p><a target='_blank' class='animated-link' href='${r.html_url}'>View on GitHub</a></p>`; list.appendChild(div); } document.querySelectorAll('.animated-link').forEach(a=>{ a.addEventListener('click',(ev)=>{ ev.preventDefault(); const href=a.href; a.style.transition='transform .18s ease, opacity .18s ease'; a.style.transform='scale(.96)'; a.style.opacity='0.6'; setTimeout(()=> window.open(href,'_blank'), 220); }); }); terminals.forEach((t,idx)=>{ if(!t.contact) t.repoData = repoList[idx % repoList.length]; }); }

  function showSkillPopup(skill){ const modal = document.getElementById('modal'); const content = document.getElementById('modalContent'); content.innerHTML = `<h3>Skill Unlocked</h3><p style='font-size:18px'>${skill}</p><p class='muted'>Collected inside the interactive portfolio.</p>`; modal.classList.remove('hidden'); }
  function showContactModal(){ const modal = document.getElementById('modal'), content = document.getElementById('modalContent'); content.innerHTML = `<h3>Contact</h3><p>Email: <a href='mailto:ms.dheerajmurthy@iiitb.ac.in'>ms.dheerajmurthy@iiitb.ac.in</a></p><p>GitHub: <a href='https://github.com/Dheeraj-Murthy' target='_blank'>Dheeraj-Murthy</a></p>`; modal.classList.remove('hidden'); }
  document.getElementById('modalClose').addEventListener('click', ()=> { document.getElementById('modal').classList.add('hidden'); });

  function showRepoTerminal(idx){ const t = terminals[idx]; const modal = document.getElementById('modal'), content = document.getElementById('modalContent'); const repo = (t && t.repoData) || repoList[idx] || {name:'Project',description:'(no data)',html_url:'#'}; content.innerHTML = `<h3>${repo.name}</h3><p>${repo.description||''}</p><p><a target='_blank' class='animated-link' href='${repo.html_url}'>Open on GitHub</a></p>`; modal.classList.remove('hidden'); }

  function initPlayerPos(){ player.position.x = 60; player.position.y = H - 220; player.velocity.x=0; player.velocity.y=0; player.jumpCount=0; scrollX=0; }

  makeLevel(); initPlayerPos();

  (function cursorSystem(){
    const c = document.getElementById('cursorCanvas');
    const ctxc = c.getContext('2d');
    let w = window.innerWidth, h = window.innerHeight;
    const DPR = window.devicePixelRatio || 1;
    c.width = w * DPR; c.height = h * DPR; c.style.width = w + 'px'; c.style.height = h + 'px'; ctxc.setTransform(DPR,0,0,DPR,0,0);
    const particles = [];
    window.addEventListener('resize', ()=>{ w = window.innerWidth; h = window.innerHeight; c.width = w * DPR; c.height = h * DPR; c.style.width = w + 'px'; c.style.height = h + 'px'; ctxc.setTransform(DPR,0,0,DPR,0,0); });
    let mx = w/2, my = h/2;
    window.addEventListener('mousemove', (e)=>{ mx = e.clientX; my = e.clientY; spawn(mx,my); });
    window.addEventListener('mousedown', (e)=>{ for(let i=0;i<6;i++) spawn(mx,my,true); });
    function spawn(x,y,burst=false){
      const count = burst ? 12 : 4;
      for(let i=0;i<count;i++){
        particles.push({ x: x + (Math.random()-0.5)*8, y: y + (Math.random()-0.5)*8, vx: (Math.random()-0.5)*2 * (burst?3:1), vy: (Math.random()-0.8)*2 * (burst?2:1), life: 1.0, size: 4 + Math.random()*8, hue: 20 + Math.random()*30 });
      }
    }
    function step(){
      ctxc.clearRect(0,0,c.width, c.height);
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.03;
        const alpha = Math.max(0, p.life);
        const grd = ctxc.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, `hsla(${p.hue},100%,60%,${alpha})`);
        grd.addColorStop(0.5, `hsla(${p.hue+30},90%,45%,${alpha*0.6})`);
        grd.addColorStop(1, `hsla(${p.hue+60},90%,35%,${alpha*0.1})`);
        ctxc.fillStyle = grd; ctxc.beginPath(); ctxc.arc(p.x, p.y, p.size, 0, Math.PI*2); ctxc.fill();
        if(p.life<=0) particles.splice(i,1);
      }
      requestAnimationFrame(step);
    }
    step();
  })();

})();