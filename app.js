import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';

const QUOTES = [
  'Dneska se jede na rekord.',
  'Pedro má rozběh. Město nestíhá.',
  'Když to nejde rovně, vezmi to přes překážku.',
  'Neon svítí, skóre roste.',
  'Ještě jeden pokus. Tenhle už určitě vyjde.'
];

const GAME_OVER_QUOTES = [
  'Narazil jsi, ale Pedro se nevzdává.',
  'Město vyhrálo jenom na chvilku.',
  'Konec jízdy. Další pokus bude ostřejší.',
  'Solidní chaos. Příště víc rytmu a míň paniky.'
];

const STORAGE_KEY = 'pedrova-jizda-best-score';

class PedroRunner {
  constructor() {
    this.elements = {};
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.player = null;
    this.ground = null;
    this.objects = [];
    this.particles = [];
    this.lanes = [-4, 0, 4];
    this.touchStart = null;
    this.audioContext = null;

    this.state = this.createInitialState();
    this.bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);

    this.init();
  }

  createInitialState() {
    return {
      screen: 'loading',
      running: false,
      paused: false,
      muted: false,
      score: 0,
      speed: 18,
      distance: 0,
      startedAt: 0,
      elapsed: 0,
      laneIndex: 1,
      targetX: 0,
      playerY: 0,
      velocityY: 0,
      jumpCount: 0,
      sliding: false,
      slideTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      doubleJumpUnlocked: false,
      dashUnlocked: false,
      combo: 0,
      comboTimer: 0,
      spawnTimer: 0,
      quoteTimer: 0,
      lastFrame: 0
    };
  }

  async init() {
    this.cacheElements();
    this.registerServiceWorker();

    try {
      this.updateLoadingText('Nahazuju WebGL...');
      this.setupRenderer();
      this.setupWorld();
      this.setupEvents();
      this.updateBestScore();
      this.showScreen('main-menu');
      this.loop();
    } catch (error) {
      console.error(error);
      this.showFallback();
    }
  }

  cacheElements() {
    [
      'loading-screen', 'main-menu', 'game-screen', 'game-over', 'webgl-fallback',
      'loading-text', 'play-btn', 'restart-btn', 'menu-btn', 'pause-btn', 'mute-btn',
      'game-canvas', 'current-score', 'final-score', 'best-score', 'game-time',
      'quote-display', 'quote-text', 'game-over-quote', 'combo-display',
      'skill-doubleJump', 'skill-dash', 'analyze-run-btn', 'ai-summary-container',
      'ai-summary-spinner', 'ai-summary-text'
    ].forEach((id) => {
      this.elements[id] = document.getElementById(id);
    });
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
      });
    }
  }

  updateLoadingText(text) {
    if (this.elements['loading-text']) this.elements['loading-text'].textContent = text;
  }

  setupRenderer() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050505, 16, 95);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 180);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 1, -8);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.elements['game-canvas'],
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x050505, 1);
  }

  setupWorld() {
    const ambient = new THREE.AmbientLight(0x88ccff, 0.4);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(3, 8, 5);
    this.scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x00bfff, 2, 35);
    cyanLight.position.set(-5, 6, 4);
    this.scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff007f, 2, 35);
    magentaLight.position.set(5, 4, -8);
    this.scene.add(magentaLight);

    this.createRoad();
    this.createPlayer();
    this.createCityDecor();
  }

  createRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
      metalness: 0.2
    });

    this.ground = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 260), roadMaterial);
    this.ground.position.set(0, -0.28, -60);
    this.scene.add(this.ground);

    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x00bfff });
    for (let z = 8; z > -130; z -= 10) {
      [-2, 2].forEach((x) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 4), lineMaterial);
        line.position.set(x, 0.01, z);
        line.userData.isRoadLine = true;
        this.scene.add(line);
        this.objects.push({ mesh: line, kind: 'roadLine' });
      });
    }
  }

  createPlayer() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x00bfff,
      emissive: 0x004466,
      metalness: 0.25,
      roughness: 0.35
    });

    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x553300,
      metalness: 0.2,
      roughness: 0.45
    });

    this.player = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.55, 0.85), bodyMaterial);
    body.position.y = 0.9;
    this.player.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), headMaterial);
    head.position.y = 1.95;
    this.player.add(head);

    const footMaterial = new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0x441122 });
    [-0.35, 0.35].forEach((x) => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.8), footMaterial);
      foot.position.set(x, 0.08, 0.05);
      this.player.add(foot);
    });

    this.player.position.set(0, 0, 2);
    this.scene.add(this.player);
  }

  createCityDecor() {
    const materialA = new THREE.MeshStandardMaterial({ color: 0x181818, emissive: 0x080011 });
    const materialB = new THREE.MeshStandardMaterial({ color: 0x101820, emissive: 0x001122 });

    for (let i = 0; i < 34; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const width = 1.2 + Math.random() * 2.2;
      const height = 3 + Math.random() * 7;
      const depth = 3 + Math.random() * 5;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        i % 3 === 0 ? materialA : materialB
      );
      building.position.set(side * (8 + Math.random() * 5), height / 2 - 0.1, -i * 8);
      this.scene.add(building);
      this.objects.push({ mesh: building, kind: 'decor' });
    }
  }

  setupEvents() {
    this.elements['play-btn'].addEventListener('click', () => this.startGame());
    this.elements['restart-btn'].addEventListener('click', () => this.startGame());
    this.elements['menu-btn'].addEventListener('click', () => this.showScreen('main-menu'));
    this.elements['pause-btn'].addEventListener('click', () => this.togglePause());
    this.elements['mute-btn'].addEventListener('click', () => this.toggleMute());
    this.elements['analyze-run-btn'].addEventListener('click', () => this.showRunSummary());

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (event) => this.onKey(event));

    window.addEventListener('pointerdown', (event) => {
      this.touchStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    });

    window.addEventListener('pointerup', (event) => {
      if (!this.touchStart || !this.state.running || this.state.paused) return;
      const dx = event.clientX - this.touchStart.x;
      const dy = event.clientY - this.touchStart.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) < 24) {
        this.jump();
      } else if (absX > absY) {
        dx > 0 ? this.moveLane(1) : this.moveLane(-1);
      } else {
        dy > 0 ? this.slide() : this.jump();
      }

      this.touchStart = null;
    });
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  onKey(event) {
    const key = event.key.toLowerCase();

    if (key === 'p' || key === 'escape') {
      this.togglePause();
      return;
    }

    if (!this.state.running || this.state.paused) return;

    if (key === 'arrowleft' || key === 'a') this.moveLane(-1);
    if (key === 'arrowright' || key === 'd') this.moveLane(1);
    if (key === 'arrowup' || key === 'w' || key === ' ') this.jump();
    if (key === 'arrowdown' || key === 's') this.slide();
    if (key === 'shift') this.dash();
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    if (this.elements[id]) this.elements[id].classList.add('active');
    this.state.screen = id;
  }

  showFallback() {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    this.elements['webgl-fallback'].hidden = false;
  }

  startGame() {
    this.clearDynamicObjects();
    const muted = this.state.muted;
    this.state = this.createInitialState();
    this.state.muted = muted;
    this.state.running = true;
    this.state.startedAt = performance.now();
    this.state.spawnTimer = 0.6;
    this.state.quoteTimer = 1.2;

    this.player.position.set(0, 0, 2);
    this.player.rotation.set(0, 0, 0);
    this.updateScore(0);
    this.updateSkillHud();
    this.showScreen('game-screen');
    this.playBeep(220, 0.08, 'sine');
  }

  clearDynamicObjects() {
    [...this.objects, ...this.particles].forEach((item) => {
      if (!item.mesh) return;
      if (item.kind === 'roadLine' || item.kind === 'decor') return;
      this.scene.remove(item.mesh);
      item.mesh.geometry?.dispose?.();
      item.mesh.material?.dispose?.();
    });

    this.objects = this.objects.filter((item) => item.kind === 'roadLine' || item.kind === 'decor');
    this.particles = [];
  }

  togglePause() {
    if (!this.state.running) return;
    this.state.paused = !this.state.paused;
    this.elements['pause-btn'].textContent = this.state.paused ? '▶' : 'Ⅱ';
  }

  toggleMute() {
    this.state.muted = !this.state.muted;
    this.elements['mute-btn'].textContent = this.state.muted ? '🔇' : '🔊';
  }

  moveLane(direction) {
    this.state.laneIndex = Math.max(0, Math.min(this.lanes.length - 1, this.state.laneIndex + direction));
    this.state.targetX = this.lanes[this.state.laneIndex];
    this.playBeep(320, 0.04, 'square');
  }

  jump() {
    const maxJumps = this.state.doubleJumpUnlocked ? 2 : 1;
    if (this.state.jumpCount >= maxJumps || this.state.sliding) return;
    this.state.velocityY = 17;
    this.state.jumpCount += 1;
    this.playBeep(520, 0.06, 'triangle');
  }

  slide() {
    if (this.state.playerY > 0.12) return;
    this.state.sliding = true;
    this.state.slideTimer = 0.55;
    this.playBeep(180, 0.05, 'sawtooth');
  }

  dash() {
    if (!this.state.dashUnlocked || this.state.dashCooldown > 0) return;
    this.state.dashTimer = 0.42;
    this.state.dashCooldown = 5;
    this.spawnParticles(this.player.position.x, 1.1, this.player.position.z, 0xff007f, 16);
    this.playBeep(760, 0.07, 'square');
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.state.running && !this.state.paused) {
      this.update(delta);
    } else {
      this.idleAnimation(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  idleAnimation(delta) {
    if (this.player) {
      this.player.rotation.y += delta * 0.5;
      this.player.position.y = Math.sin(performance.now() * 0.002) * 0.06;
    }
  }

  update(delta) {
    const s = this.state;
    const effectiveSpeed = s.speed + (s.dashTimer > 0 ? 18 : 0);
    s.elapsed = (performance.now() - s.startedAt) / 1000;
    s.distance += effectiveSpeed * delta;
    s.speed += delta * 0.5;

    if (s.dashTimer > 0) s.dashTimer -= delta;
    if (s.dashCooldown > 0) s.dashCooldown -= delta;

    s.doubleJumpUnlocked = s.score >= 450;
    s.dashUnlocked = s.score >= 900;
    this.updateSkillHud();

    s.score += Math.floor(effectiveSpeed * delta * 7);
    this.updateScore(s.score);

    this.updatePlayer(delta);
    this.updateObjects(delta, effectiveSpeed);
    this.updateParticles(delta);
    this.updateSpawner(delta);
    this.updateQuote(delta);
    this.checkCollisions();
    this.updateCamera(delta);
  }

  updatePlayer(delta) {
    const s = this.state;
    s.velocityY -= 44 * delta;
    s.playerY += s.velocityY * delta;

    if (s.playerY <= 0) {
      s.playerY = 0;
      s.velocityY = 0;
      s.jumpCount = 0;
    }

    if (s.slideTimer > 0) {
      s.slideTimer -= delta;
      if (s.slideTimer <= 0) s.sliding = false;
    }

    this.player.position.x += (s.targetX - this.player.position.x) * Math.min(1, delta * 12);
    this.player.position.y = s.playerY + (s.sliding ? -0.38 : 0);
    this.player.rotation.z = (s.targetX - this.player.position.x) * -0.08;
    this.player.scale.y += ((s.sliding ? 0.55 : 1) - this.player.scale.y) * Math.min(1, delta * 16);
  }

  updateObjects(delta, speed) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      obj.mesh.position.z += speed * delta;

      if (obj.kind === 'pickup') obj.mesh.rotation.y += delta * 5;
      if (obj.kind === 'decor' && obj.mesh.position.z > 18) obj.mesh.position.z -= 260;
      if (obj.kind === 'roadLine' && obj.mesh.position.z > 14) obj.mesh.position.z -= 140;

      if (['obstacle', 'lowObstacle', 'pickup'].includes(obj.kind) && obj.mesh.position.z > 12) {
        this.scene.remove(obj.mesh);
        obj.mesh.geometry?.dispose?.();
        obj.mesh.material?.dispose?.();
        this.objects.splice(i, 1);
        this.addCombo(1);
      }
    }
  }

  updateSpawner(delta) {
    this.state.spawnTimer -= delta;
    if (this.state.spawnTimer > 0) return;

    this.state.spawnTimer = Math.max(0.55, 1.2 - this.state.score / 2500);
    const roll = Math.random();

    if (roll < 0.18) {
      this.spawnPickup();
    } else if (roll < 0.45) {
      this.spawnLowObstacle();
    } else {
      this.spawnObstacle();
    }
  }

  spawnObstacle() {
    const lane = this.randomLane();
    const material = new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0x660022 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.5), material);
    mesh.position.set(lane, 0.75, -85);
    this.scene.add(mesh);
    this.objects.push({ mesh, kind: 'obstacle', lane });
  }

  spawnLowObstacle() {
    const lane = this.randomLane();
    const material = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x443300 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.82, 1.4), material);
    mesh.position.set(lane, 0.32, -85);
    this.scene.add(mesh);
    this.objects.push({ mesh, kind: 'lowObstacle', lane });
  }

  spawnPickup() {
    const lane = this.randomLane();
    const material = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x009977, metalness: 0.4, roughness: 0.18 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.62), material);
    mesh.position.set(lane, 1.25, -85);
    this.scene.add(mesh);
    this.objects.push({ mesh, kind: 'pickup', lane });
  }

  randomLane() {
    return this.lanes[Math.floor(Math.random() * this.lanes.length)];
  }

  checkCollisions() {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (!['obstacle', 'lowObstacle', 'pickup'].includes(obj.kind)) continue;

      const dz = Math.abs(obj.mesh.position.z - this.player.position.z);
      const dx = Math.abs(obj.mesh.position.x - this.player.position.x);
      if (dz > 1.35 || dx > 1.05) continue;

      if (obj.kind === 'pickup') {
        this.collectPickup(i);
        continue;
      }

      const safeJump = obj.kind === 'obstacle' && this.state.playerY > 1.05;
      const safeSlide = obj.kind === 'lowObstacle' && this.state.sliding;
      const safeDash = this.state.dashTimer > 0;

      if (safeJump || safeSlide || safeDash) {
        this.destroyObstacle(i);
        this.addCombo(2);
      } else {
        this.gameOver();
      }
    }
  }

  collectPickup(index) {
    const obj = this.objects[index];
    this.spawnParticles(obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z, 0x00ffcc, 18);
    this.scene.remove(obj.mesh);
    obj.mesh.geometry?.dispose?.();
    obj.mesh.material?.dispose?.();
    this.objects.splice(index, 1);
    this.state.score += 120;
    this.addCombo(3);
    this.showQuote('Bonus +120');
    this.playBeep(900, 0.08, 'triangle');
  }

  destroyObstacle(index) {
    const obj = this.objects[index];
    this.spawnParticles(obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z, 0xffd700, 12);
    this.scene.remove(obj.mesh);
    obj.mesh.geometry?.dispose?.();
    obj.mesh.material?.dispose?.();
    this.objects.splice(index, 1);
    this.playBeep(420, 0.05, 'square');
  }

  addCombo(amount) {
    const s = this.state;
    s.combo = Math.min(99, s.combo + amount);
    s.comboTimer = 2.2;
    if (s.combo >= 3) this.showCombo(`×${s.combo} combo`);
  }

  showCombo(text) {
    const el = this.elements['combo-display'];
    el.textContent = text;
    el.classList.add('active');
    window.clearTimeout(this.comboTimeout);
    this.comboTimeout = window.setTimeout(() => el.classList.remove('active'), 650);
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.y -= 9 * delta;
      particle.life -= delta;
      particle.mesh.material.opacity = Math.max(0, particle.life);

      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        particle.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    if (this.state.comboTimer > 0) {
      this.state.comboTimer -= delta;
      if (this.state.comboTimer <= 0) this.state.combo = 0;
    }
  }

  spawnParticles(x, y, z, color = 0x00bfff, count = 10) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.set(x, y, z);
      const particle = {
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5),
        life: 0.55 + Math.random() * 0.45
      };
      this.scene.add(mesh);
      this.particles.push(particle);
    }
  }

  updateQuote(delta) {
    this.state.quoteTimer -= delta;
    if (this.state.quoteTimer > 0) return;
    this.state.quoteTimer = 6 + Math.random() * 5;
    this.showQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }

  showQuote(text) {
    const box = this.elements['quote-display'];
    this.elements['quote-text'].textContent = text;
    box.classList.add('active');
    window.clearTimeout(this.quoteTimeout);
    this.quoteTimeout = window.setTimeout(() => box.classList.remove('active'), 1800);
  }

  updateCamera(delta) {
    this.camera.position.x += (this.player.position.x * 0.35 - this.camera.position.x) * delta * 4;
    this.camera.position.y += (4.6 + this.state.playerY * 0.28 - this.camera.position.y) * delta * 4;
    this.camera.lookAt(this.player.position.x * 0.35, 1.15, -13);
  }

  updateSkillHud() {
    this.elements['skill-doubleJump'].classList.toggle('unlocked', this.state.doubleJumpUnlocked);
    this.elements['skill-dash'].classList.toggle('unlocked', this.state.dashUnlocked);
    this.elements['skill-dash'].classList.toggle('cooldown', this.state.dashCooldown > 0);
  }

  updateScore(value) {
    this.elements['current-score'].textContent = Math.floor(value).toLocaleString('cs-CZ');
  }

  updateBestScore() {
    this.elements['best-score'].textContent = Math.floor(this.bestScore).toLocaleString('cs-CZ');
  }

  gameOver() {
    if (!this.state.running) return;
    this.state.running = false;
    this.state.paused = false;
    const finalScore = Math.floor(this.state.score);

    if (finalScore > this.bestScore) {
      this.bestScore = finalScore;
      localStorage.setItem(STORAGE_KEY, String(finalScore));
    }

    this.elements['final-score'].textContent = finalScore.toLocaleString('cs-CZ');
    this.elements['game-time'].textContent = `${Math.floor(this.state.elapsed)}s`;
    this.elements['game-over-quote'].textContent = GAME_OVER_QUOTES[Math.floor(Math.random() * GAME_OVER_QUOTES.length)];
    this.updateBestScore();
    this.elements['ai-summary-container'].hidden = true;
    this.showScreen('game-over');
    this.spawnParticles(this.player.position.x, 1, this.player.position.z, 0xff007f, 26);
    this.playBeep(90, 0.16, 'sawtooth');
  }

  showRunSummary() {
    const container = this.elements['ai-summary-container'];
    const spinner = this.elements['ai-summary-spinner'];
    const text = this.elements['ai-summary-text'];

    container.hidden = false;
    spinner.hidden = false;
    text.textContent = '';

    window.setTimeout(() => {
      spinner.hidden = true;
      const finalScore = Math.floor(this.state.score);
      const time = Math.floor(this.state.elapsed);
      text.textContent = `Výsledek ${finalScore.toLocaleString('cs-CZ')} bodů za ${time}s. Pedro jel slušně, ale město mu zase hodilo bednu pod nohy. Příště drž rytmus: pruh, skok, skluz, žádný panický klikání.`;
    }, 500);
  }

  playBeep(frequency, duration, type = 'sine') {
    if (this.state.muted) return;

    try {
      this.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.04, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }
}

new PedroRunner();
