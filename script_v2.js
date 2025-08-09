// script_v3 (updated fixes):
// - Proper left/right movement handling
// - Double-jump implementation maintained
// - Sprite animation: uses assets/warrior/*.png (Idle, Run, Jump, Fall, and left variants) as strips
// - Animation timing and frame slicing per-animation with reasonable default frame counts
// - Fire-flow cursor uses warm hues (orange/red) instead of cold blue
// - Ensures modal is hidden on start to avoid accidental grey overlay
// - Fixed contact terminal sprite implementation
(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  let W = canvas.clientWidth,
    H = canvas.clientHeight;
  let dpr = window.devicePixelRatio || 1;

  function fixDPI() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = rect.width;
    H = rect.height;
  }
  window.addEventListener("resize", fixDPI);
  fixDPI();

  // Game state
  const gravity = 0.9;
  const player = {
    x: 60,
    y: 260,
    w: 40,
    h: 60,
    vx: 0,
    vy: 0,
    onGround: false,
    jumpCount: 0,
    facing: 1,
    anim: "idle",
    frameTimer: 0,
  };
  const keys = {};
  let scrollX = 0;
  const platforms = [];
  const orbs = [];
  const terminals = [];
  let repoList = [];
  const notifications = [];

  // animation config: estimated frame counts & fps for each anim.
  const animConfig = {
    idle: { file: "Idle.png", leftFile: "IdleLeft.png", frames: 8, fps: 10 },
    run: { file: "Run.png", leftFile: "RunLeft.png", frames: 8, fps: 14 },
    jump: { file: "Jump.png", leftFile: "JumpLeft.png", frames: 2, fps: 1 },
    fall: { file: "Fall.png", leftFile: "FallLeft.png", frames: 2, fps: 1 },
  };

  const spriteStore = {
    warrior: {},
    orbImg: null,
    terminalImg: null,
    contactTerminalImg: null,
    platformImg: null,
  };

  // Load sprites from assets/warrior
  function loadSprites(callback) {
    let toLoad = 0,
      done = 0;
    function check() {
      if (done >= toLoad) callback && callback();
    }
    // load warrior animations
    Object.keys(animConfig).forEach((k) => {
      const cfg = animConfig[k];
      // main image
      toLoad++;
      (function (key, cfg) {
        const img = new Image();
        img.src = "./assets/warrior/" + cfg.file;
        img.onload = () => {
          spriteStore.warrior[key] = {
            img: img,
            frames: cfg.frames,
            fps: cfg.fps,
          };
          done++;
          check();
        };
        img.onerror = () => {
          console.warn(`Failed to load warrior sprite: ${cfg.file}`);
          done++;
          check();
        };
      })(k, cfg);
      // left-facing image (prefer explicit left image if provided)
      toLoad++;
      (function (key, cfg) {
        const limg = new Image();
        limg.src = "./assets/warrior/" + (cfg.leftFile || cfg.file);
        limg.onload = () => {
          spriteStore.warrior[key + "_left"] = {
            img: limg,
            frames: cfg.frames,
            fps: cfg.fps,
          };
          done++;
          check();
        };
        limg.onerror = () => {
          console.warn(
            `Failed to load warrior left sprite: ${cfg.leftFile || cfg.file}`,
          );
          done++;
          check();
        };
      })(k, cfg);
    });
    // orb image
    toLoad++;
    const orb = new Image();
    orb.src = "./assets/orb.png";
    orb.onload = () => {
      spriteStore.orbImg = orb;
      console.log("Orb sprite loaded successfully");
      done++;
      check();
    };
    orb.onerror = () => {
      console.warn("Failed to load orb sprite");
      done++;
      check();
    };
    // regular terminal image
    toLoad++;
    const term = new Image();
    term.src = "./assets/terminal.png";
    term.onload = () => {
      spriteStore.terminalImg = term;
      console.log("Terminal sprite loaded successfully");
      done++;
      check();
    };
    term.onerror = () => {
      console.warn("Failed to load terminal sprite");
      done++;
      check();
    };
    // contact terminal image (different sprite)
    toLoad++;
    const contactTerm = new Image();
    contactTerm.src = "./assets/contact_terminal.png";
    contactTerm.onload = () => {
      spriteStore.contactTerminalImg = contactTerm;
      console.log("Contact terminal sprite loaded successfully");
      done++;
      check();
    };
    contactTerm.onerror = () => {
      console.warn(
        "Failed to load contact terminal sprite - check if ./assets/contact_terminal.png exists",
      );
      done++;
      check();
    };
    // platform image
    toLoad++;
    const plat = new Image();
    plat.src = "./assets/platform.png";
    plat.onload = () => {
      spriteStore.platformImg = plat;
      console.log("Platform sprite loaded successfully");
      done++;
      check();
    };
    plat.onerror = () => {
      console.warn("Failed to load platform sprite");
      done++;
      check();
    };
    // if zero toLoad (unlikely) call check
    if (toLoad === 0) check();
  }

  // Level generation (tuned spacing)
  function makeLevel() {
    platforms.length = 0;
    orbs.length = 0;
    terminals.length = 0;
    platforms.push({
      x: -1000,
      y: H - 60,
      w: 6000,
      h: 60,
      collisionOffset: 27,
    });
    const spacing = 160;
    for (let i = 0; i < 14; i++) {
      const px = 140 + i * spacing;
      const py = H - 150 - (i % 4) * 28;
      platforms.push({ x: px, y: py, w: 140, h: 40, collisionOffset: 20 }); // Add a collision offset for floating platforms
      if (i % 2 === 0)
        orbs.push({
          x: px + 60,
          y: py - 26,
          r: 8,
          collected: false,
          skill: sampleSkill(i),
        });
      if (i % 3 === 0)
        terminals.push({
          x: px + 80,
          y: py - 70,
          w: 44,
          h: 44,
          repoIndex: Math.floor(i / 3),
          contact: false,
        });
    }
    // Contact terminal (larger and different)
    terminals.push({
      x: 140 + 14 * spacing + 60,
      y: H - 150 - 10,
      w: 150,
      h: 150,
      contact: true,
    });
    console.log(
      "Level created with",
      terminals.filter((t) => t.contact).length,
      "contact terminals",
    );
  }
  function sampleSkill(i) {
    const pool = [
      "C++",
      "Java",
      "Python",
      "JavaScript",
      "Lua",
      "Rust",
      "React",
      "Node.js",
    ];
    return pool[i % pool.length];
  }

  let lastEKey = false;
  // input handlers
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key.toLowerCase() === "e") lastEKey = false; // Reset E key state
  });

  // Jump handling (edge detection)
  let lastJumpKey = false;
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "arrowup" || key === "w" || key === " ") {
      if (!lastJumpKey) {
        if (player.onGround) {
          player.vy = -14;
          player.onGround = false;
          player.jumpCount = 1;
          setAnim("jump");
        } else if (player.jumpCount < 2) {
          player.vy = -15;
          player.jumpCount++;
          setAnim("jump");
        }
      }
      lastJumpKey = true;
    }
    // prevent default page scrolling when pressing space
    if (e.key === " ") {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (key === "arrowup" || key === "w" || key === " ") lastJumpKey = false;
  });

  function setAnim(name) {
    if (player.anim !== name) {
      player.anim = name;
      player.frameTimer = 0;
      player.currentFrame = 0; // also reset frame so animations start from the beginning
    }
  }

  // physics update: includes movement controls (fixes missing vx logic)
  function physicsUpdate() {
    // movement input
    if (keys["a"] || keys["arrowleft"]) {
      player.vx = -4.2;
      player.facing = -1;
      if (player.onGround) setAnim("run");
    } else if (keys["d"] || keys["arrowright"]) {
      player.vx = 4.2;
      player.facing = 1;
      if (player.onGround) setAnim("run");
    } else {
      player.vx = 0;
      if (player.onGround) setAnim("idle");
    }

    // apply gravity & velocity
    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;

    // Air-time animation logic
    if (!player.onGround) {
      if (player.vy > gravity * 0.1) {
        // Small threshold to be in 'fall' state
        setAnim("fall");
      } else if (player.vy < 0) {
        // The 'jump' animation is already set on keypress, but this can be a fallback
        setAnim("jump");
      }
    }

    // collisions
    player.onGround = false;
    player.currentPlatform = null;
    for (const p of platforms) {
      // AABB collision check
      if (
        collideRect(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)
      ) {
        // Check if player is landing on top of the platform
        // Condition: player is moving down & their bottom edge is now inside the platform
        if (
          player.vy >= 0 &&
          player.y + player.h > p.y + p.collisionOffset &&
          player.y + player.h - player.vy <= p.y + p.collisionOffset
        ) {
          player.y = p.y + p.collisionOffset - player.h; // Snap to effective top, with a small upward nudge
          player.vy = 0;
          player.onGround = true;
          player.jumpCount = 0;
          player.currentPlatform = p; // Track the current platform
          if (player.vx === 0) setAnim("idle"); // Landed, switch to idle
        }
      }
    }

    // orbs
    for (const o of orbs) {
      if (o.collected) continue;
      if (
        collideRect(
          player.x,
          player.y,
          player.w,
          player.h,
          o.x,
          o.y - o.r,
          o.r * 2,
          o.r * 2,
        )
      ) {
        o.collected = true;
        showNotification(`Skill Unlocked: ${o.skill}`);
      }
    }

    // terminals interact
    if (keys["e"]) {
      if (!lastEKey) {
        for (const t of terminals) {
          if (
            collideRect(
              player.x,
              player.y,
              player.w,
              player.h,
              t.x,
              t.y,
              t.w,
              t.h,
            )
          ) {
            if (t.contact) showContactModal();
            else showRepoTerminal(t.repoIndex);
            break;
          }
        }
      }
      lastEKey = true;
    }

    // camera: allow both directions
    const leftMargin = W * 0.25;
    const rightMargin = W * 0.55;
    if (player.x - scrollX < leftMargin) {
      scrollX = Math.max(0, player.x - leftMargin);
    } else if (player.x - scrollX > rightMargin) {
      scrollX = player.x - rightMargin;
    }
  }

  function collideRect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // drawing
  function draw(now, dt) {
    // clear and background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a2a4f");
    g.addColorStop(1, "#102038");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // parallax grid
    ctx.save();
    ctx.translate(-(scrollX * 0.22) % 40, 0);
    ctx.strokeStyle = "rgba(0,179,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.65);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.restore();

    // platforms
    for (const p of platforms) {
      const px = p.x - scrollX,
        py = p.y;
      if (spriteStore.platformImg) {
        ctx.drawImage(spriteStore.platformImg, px, py, p.w, p.h);
      } else {
        ctx.fillStyle = "#08283f";
        roundRect(ctx, px, py, p.w, p.h, 8);
        ctx.strokeStyle = "rgba(139,92,246,0.14)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // orbs
    for (const o of orbs) {
      if (o.collected) continue;
      const ox = o.x - scrollX,
        oy = o.y;
      if (spriteStore.orbImg) {
        ctx.drawImage(spriteStore.orbImg, ox - 12, oy - 12, 24, 24);
      } else {
        const grad = ctx.createRadialGradient(ox, oy, 1, ox, oy, 20);
        grad.addColorStop(0, "#ffd6a8");
        grad.addColorStop(1, "#ff6b6b22");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "#ff9f6a44";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // terminals - improved sprite handling
    for (const t of terminals) {
      const tx = t.x - scrollX,
        ty = t.y;

      let spriteDrawn = false;

      // Use different sprite for contact terminal
      if (t.contact) {
        if (
          spriteStore.contactTerminalImg &&
          spriteStore.contactTerminalImg.complete &&
          spriteStore.contactTerminalImg.naturalWidth > 0
        ) {
          ctx.drawImage(spriteStore.contactTerminalImg, tx, ty, t.w, t.h);
          spriteDrawn = true;
        } else {
          // Enhanced fallback for contact terminal
          ctx.fillStyle = "#ff6b35"; // Orange color for contact
          roundRect(ctx, tx, ty, t.w, t.h, 8);
          ctx.fillStyle = "#ffffff";
          ctx.font = "20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("✉", tx + t.w / 2, ty + t.h / 2 + 7);
          ctx.textAlign = "left"; // Reset text alignment
          spriteDrawn = true;
        }
      } else {
        // Regular terminal
        if (
          spriteStore.terminalImg &&
          spriteStore.terminalImg.complete &&
          spriteStore.terminalImg.naturalWidth > 0
        ) {
          ctx.drawImage(spriteStore.terminalImg, tx, ty, t.w, t.h);
          spriteDrawn = true;
        } else {
          // Fallback for regular terminal
          ctx.fillStyle = "#ffca28";
          roundRect(ctx, tx, ty, t.w, t.h, 6);
          ctx.fillStyle = "#021126";
          ctx.font = "16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("⌘", tx + t.w / 2, ty + t.h / 2 + 5);
          ctx.textAlign = "left"; // Reset text alignment
          spriteDrawn = true;
        }
      }
    }

    // player sprite animation
    const px = player.x - scrollX,
      py = player.y;
    const anim = player.anim;
    const leftAnim = player.facing < 0;
    // choose sprite image: prefer explicit left image if available
    const key = anim;
    const keyLeft = anim + "_left";
    let imgObj = null,
      frames = 1,
      fps = 8;
    if (
      leftAnim &&
      spriteStore.warrior[keyLeft] &&
      spriteStore.warrior[keyLeft].img
    ) {
      imgObj = spriteStore.warrior[keyLeft].img;
      frames = spriteStore.warrior[keyLeft].frames;
      fps = spriteStore.warrior[keyLeft].fps;
    } else if (spriteStore.warrior[key] && spriteStore.warrior[key].img) {
      imgObj = spriteStore.warrior[key].img;
      frames = spriteStore.warrior[key].frames;
      fps = spriteStore.warrior[key].fps;
    }

    if (imgObj && imgObj.complete && imgObj.naturalWidth !== 0) {
      // advance animation based on FPS and frame count
      const frameDuration = 1 / fps; // seconds per frame
      if (typeof player.currentFrame === "undefined") player.currentFrame = 0;
      player.frameTimer += dt; // use delta time from loop

      if (player.frameTimer >= frameDuration) {
        player.frameTimer -= frameDuration;
        player.currentFrame = (player.currentFrame + 1) % Math.max(1, frames);
      }

      const sW = Math.floor(imgObj.width / frames);
      const sH = imgObj.height;
      const srcX = player.currentFrame * sW;

      // Corrected aspect ratio calculation
      const aspectRatio = sW / sH;
      const dh = player.h * 1.8; // Keep height scaling
      const dw = dh * aspectRatio; // Calculate width based on aspect ratio

      ctx.drawImage(
        imgObj,
        srcX,
        0,
        sW,
        sH,
        px - (dw - player.w) / 2,
        py - (dh - player.h),
        dw,
        dh,
      );
    } else {
      // fallback rectangle
      ctx.fillStyle = "#f8f9fb";
      roundRect(ctx, px, py, player.w, player.h, 6);
      ctx.strokeStyle = "#ff9f6a88";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, player.w, player.h);
    }

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(12, 12, 260, 52);
    ctx.fillStyle = "#fff0d6";
    ctx.font = "13px monospace";
    ctx.fillText(
      "Skill Orbs: " +
        orbs.filter((o) => o.collected).length +
        " / " +
        orbs.length,
      22,
      32,
    );
    ctx.fillText("Double jumps used: " + player.jumpCount + " / 2", 22, 48);

    // Notifications display
    const currentTime = performance.now();
    for (let i = notifications.length - 1; i >= 0; i--) {
      const notif = notifications[i];
      const age = (currentTime - notif.time) / 1000; // age in seconds

      if (age > 3) {
        // Remove notifications after 3 seconds
        notifications.splice(i, 1);
        continue;
      }

      // Calculate fade-out effect
      const alpha = age > 2 ? Math.max(0, 1 - (age - 2)) : 1;

      // Position notifications (stack them vertically)
      const notifY = 80 + (notifications.length - 1 - i) * 40;

      // Draw notification background
      ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
      ctx.fillRect(12, notifY, 400, 32);

      // Draw notification text
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = "14px monospace";
      ctx.fillText(notif.message, 20, notifY + 20);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.closePath();
    ctx.fill();
  }

  // main loop
  let last = performance.now();
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    physicsUpdate();
    draw(now, dt);
    requestAnimationFrame(loop);
  }

  // lazy init when visible
  function startWhenVisible() {
    const hero = document.getElementById("hero");
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          makeLevel();
          loadSprites(() => {});
          fetchRepos();
          // ensure modal hidden on start
          const modal = document.getElementById("modal");
          if (modal) modal.classList.add("hidden");
          loop(performance.now());
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(hero);
  }
  startWhenVisible();

  // GitHub & UI helpers (unchanged)
  async function fetchRepos() {
    try {
      const res = await fetch(
        "https://api.github.com/users/Dheeraj-Murthy/repos?per_page=100",
      );
      if (!res.ok) throw new Error("err");
      repoList = await res.json();
      populateProjectList();
    } catch (e) {
      repoList = [
        {
          name: "ccl_project",
          description: "CPRMS portal",
          html_url: "https://github.com/Dheeraj-Murthy/ccl_project",
        },
      ];
      populateProjectList();
    }
  }
  function populateProjectList() {
    const list = document.getElementById("project-list");
    list.innerHTML = "";
    for (const r of repoList) {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<h3>${r.name}</h3><p class='muted'>${r.description || ""}</p><p><a target='_blank' class='animated-link' href='${r.html_url}'>View on GitHub</a></p>`;
      list.appendChild(div);
    }
    document.querySelectorAll(".animated-link").forEach((a) => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const href = a.href;
        a.style.transition = "transform .18s ease, opacity .18s ease";
        a.style.transform = "scale(.96)";
        a.style.opacity = "0.6";
        setTimeout(() => window.open(href, "_blank"), 220);
      });
    });
    terminals.forEach((t, idx) => {
      if (!t.contact) t.repoData = repoList[idx % repoList.length];
    });
  }

  function showNotification(message) {
    notifications.push({ message, time: performance.now() });
  }

  function showSkillPopup(skill) {
    const modal = document.getElementById("modal");
    const content = document.getElementById("modalContent");
    content.innerHTML = `<h3>Skill Unlocked</h3><p style='font-size:18px'>${skill}</p><p class='muted'>Collected inside the interactive portfolio.</p>`;
    modal.classList.remove("hidden");
  }

  function showContactModal() {
    showNotification("Contact: ms.dheerajmurthy@iiitb.ac.in");
  }

  // attach project modal
  function showRepoTerminal(idx) {
    const t = terminals[idx];
    const repo = (t && t.repoData) || repoList[idx];
    if (repo) {
      showNotification(`Project: ${repo.name}`);
    }
  }

  document.getElementById("modalClose").addEventListener("click", () => {
    document.getElementById("modal").classList.add("hidden");
  });

  // initial player placement helper
  function initPlayerPos() {
    player.x = 60;
    player.y = H - 220;
    player.vx = 0;
    player.vy = 0;
    player.jumpCount = 0;
    scrollX = 0;
  }

  // Ensure player is placed after level creation
  makeLevel();
  initPlayerPos();

  // Fire-flow cursor: switched to warm hues (orange/red) for a "fire" effect
  (function cursorSystem() {
    const c = document.getElementById("cursorCanvas");
    const ctxc = c.getContext("2d");
    let w = window.innerWidth,
      h = window.innerHeight;
    const DPR = window.devicePixelRatio || 1;
    c.width = w * DPR;
    c.height = h * DPR;
    c.style.width = w + "px";
    c.style.height = h + "px";
    ctxc.setTransform(DPR, 0, 0, DPR, 0, 0);
    const particles = [];
    window.addEventListener("resize", () => {
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = w * DPR;
      c.height = h * DPR;
      c.style.width = w + "px";
      c.style.height = h + "px";
      ctxc.setTransform(DPR, 0, 0, DPR, 0, 0);
    });
    let mx = w / 2,
      my = h / 2;
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      spawn(mx, my);
    });
    window.addEventListener("mousedown", (e) => {
      for (let i = 0; i < 6; i++) spawn(mx, my, true);
    });
    function spawn(x, y, burst = false) {
      const count = burst ? 12 : 4;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 2 * (burst ? 3 : 1),
          vy: (Math.random() - 0.8) * 2 * (burst ? 2 : 1),
          life: 1.0,
          size: 4 + Math.random() * 8,
          hue: 200 + Math.random() * 60, // Blue to purple range (200-260)
        });
      }
    }
    function step() {
      ctxc.clearRect(0, 0, c.width, c.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= 0.03;
        const alpha = Math.max(0, p.life);
        const grd = ctxc.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, `hsla(${p.hue},100%,60%,${alpha})`);
        grd.addColorStop(0.5, `hsla(${p.hue + 30},90%,45%,${alpha * 0.6})`);
        grd.addColorStop(1, `hsla(${p.hue + 60},90%,35%,${alpha * 0.1})`);
        ctxc.fillStyle = grd;
        ctxc.beginPath();
        ctxc.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctxc.fill();
        if (p.life <= 0) particles.splice(i, 1);
      }
      requestAnimationFrame(step);
    }
    step();
  })();
})();
