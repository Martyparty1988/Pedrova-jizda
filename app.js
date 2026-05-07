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

class PedroRunner2D {
  constructor() {
    this.elements = {};
    this.canvas = null;
    this.ctx = null;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.lastTime = performance.now();
    this.touchStart = null;
    this.audioContext = null;
    this.quoteTimeout = null;
    this.comboTimeout = null;

    this.bestScore = this.safeReadBestScore();
    this.state = this.createState();
    this.cacheElements();
    this.init();
  }

  createState() {
    return {
      running: false,
      paused: false,
      muted: false,
      score: 0,
      speed: 360,
      elapsed: 0,
      startedAt: 0,
      lane: 1,
      playerY: 0,
      velocityY: 0,
      jumpCount: 0,
      sliding: false,
      slideTimer: 0,
      dashUnlocked: false,
      doubleJumpUnlocked: false,
      dashTimer: 0,
      dashCooldown: 0,
      spawnTimer: 0,
      quoteTimer: 2,
      combo: 0,
      comboTimer: 0,
      obstacles: [],
      particles: [],
      roadOffset: 0,
      flash: 0
    };
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

  init() {
    this.canvas = this.elements['game-canvas'];
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    if (!this.ctx) {
      this.showFallback();
      return;
    }

    this.registerServiceWorker();
    this.setupEvents();
    this.resize();
    this.updateBestScore();
    this.updateLoadingText('Hotovo. Pedro je připraven.');

    window.setTimeout(() => this.showScreen('main-menu'), 250);
    requestAnimationFrame((time) => this.loop(time));
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
      });
    }
  }

  setupEvents() {
    this.elements['play-btn']?.addEventListener('click', () => this.startGame());
    this.elements['restart-btn']?.addEventListener('click', () => this.startGame());
    this.elements['menu-btn']?.addEventListener('click', () => this.showScreen('main-menu'));
    this.elements['pause-btn']?.addEventListener('click', () => this.togglePause());
    this.elements['mute-btn']?.addEventListener('click', () => this.toggleMute());
    this.elements['analyze-run-btn']?.addEventListener('click', () => this.showRunSummary());

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => this.onKey(event));

    window.addEventListener('pointerdown', (event) => {
      this.touchStart = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener('pointerup', (event) => {
      if (!this.touchStart || !this.state.running || this.state.paused) return;

      const dx = event.clientX - this.touchStart.x;
      const dy = event.clientY - this.touchStart.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) < 24) this.jump();
      else if (absX > absY) this.moveLane(dx > 0 ? 1 : -1);
      else if (dy > 0) this.slide();
      else this.jump();

      this.touchStart = null;
    });
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.pixelRatio);
    this.canvas.height = Math.floor(this.height * this.pixelRatio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
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

  startGame() {
    const muted = this.state.muted;
    this.state = this.createState();
    this.state.muted = muted;
    this.state.running = true;
    this.state.startedAt = performance.now();
    this.state.spawnTimer = 0.65;
    this.lastTime = performance.now();
    this.updateScore(0);
    this.updateSkillHud();
    this.showScreen('game-screen');
    this.playBeep(220, 0.06, 'sine');
  }

  loop(time) {
    const delta = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (this.state.running && !this.state.paused) this.update(delta);
    this.draw();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(delta) {
    const s = this.state;
    const dashBonus = s.dashTimer > 0 ? 320 : 0;
    const speed = s.speed + dashBonus;

    s.elapsed = (performance.now() - s.startedAt) / 1000;
    s.score += Math.floor((speed * delta) / 5);
    s.speed += delta * 10;
    s.roadOffset = (s.roadOffset + speed * delta) % 80;
    s.flash = Math.max(0, s.flash - delta * 3);

    if (s.dashTimer > 0) s.dashTimer -= delta;
    if (s.dashCooldown > 0) s.dashCooldown -= delta;

    s.doubleJumpUnlocked = s.score >= 450;
    s.dashUnlocked = s.score >= 900;

    this.updatePlayer(delta);
    this.updateObjects(delta, speed);
    this.updateParticles(delta);
    this.updateSpawner(delta);
    this.updateQuote(delta);
    this.checkCollisions();
    this.updateScore(s.score);
    this.updateSkillHud();
  }

  updatePlayer(delta) {
    const s = this.state;
    s.velocityY -= 1650 * delta;
    s.playerY += s.velocityY * delta;

    if (s.playerY < 0) {
      s.playerY = 0;
      s.velocityY = 0;
      s.jumpCount = 0;
    }

    if (s.slideTimer > 0) {
      s.slideTimer -= delta;
      if (s.slideTimer <= 0) s.sliding = false;
    }

    if (s.comboTimer > 0) {
      s.comboTimer -= delta;
      if (s.comboTimer <= 0) s.combo = 0;
    }
  }

  updateObjects(delta, speed) {
    for (let i = this.state.obstacles.length - 1; i >= 0; i--) {
      const item = this.state.obstacles[i];
      item.y += speed * delta;
      item.rotation += delta * 4;

      if (item.y > this.height + 120) {
        this.state.obstacles.splice(i, 1);
        this.addCombo(1);
      }
    }
  }

  updateParticles(delta) {
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const particle = this.state.particles[i];
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 900 * delta;
      particle.life -= delta;

      if (particle.life <= 0) this.state.particles.splice(i, 1);
    }
  }

  updateSpawner(delta) {
    const s = this.state;
    s.spawnTimer -= delta;
    if (s.spawnTimer > 0) return;

    s.spawnTimer = Math.max(0.45, 1.05 - s.score / 4200);
    const roll = Math.random();

    if (roll < 0.18) this.spawnItem('pickup');
    else if (roll < 0.45) this.spawnItem('low');
    else this.spawnItem('block');
  }

  updateQuote(delta) {
    const s = this.state;
    s.quoteTimer -= delta;
    if (s.quoteTimer > 0) return;
    s.quoteTimer = 6 + Math.random() * 5;
    this.showQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }

  spawnItem(type) {
    const lane = Math.floor(Math.random() * 3);
    this.state.obstacles.push({
      type,
      lane,
      y: -100,
      size: type === 'pickup' ? 34 : type === 'low' ? 58 : 66,
      rotation: 0
    });
  }

  getLaneX(lane) {
    const roadWidth = Math.min(this.width * 0.78, 520);
    const left = this.width / 2 - roadWidth / 2;
    return left + roadWidth * (lane + 0.5) / 3;
  }

  getPlayerRect() {
    const x = this.getLaneX(this.state.lane);
    const baseY = this.height - 132 - this.state.playerY;
    const width = this.state.sliding ? 72 : 52;
    const height = this.state.sliding ? 38 : 74;
    return { x: x - width / 2, y: baseY - height, width, height };
  }

  getItemRect(item) {
    const x = this.getLaneX(item.lane);
    const width = item.type === 'pickup' ? 42 : item.type === 'low' ? 78 : 64;
    const height = item.type === 'pickup' ? 42 : item.type === 'low' ? 38 : 78;
    return { x: x - width / 2, y: item.y - height / 2, width, height };
  }

  checkCollisions() {
    const player = this.getPlayerRect();

    for (let i = this.state.obstacles.length - 1; i >= 0; i--) {
      const item = this.state.obstacles[i];
      const rect = this.getItemRect(item);
      if (!this.intersects(player, rect)) continue;

      if (item.type === 'pickup') {
        this.collectItem(i, item);
        continue;
      }

      const safeJump = item.type === 'block' && this.state.playerY > 72;
      const safeSlide = item.type === 'low' && this.state.sliding;
      const safeDash = this.state.dashTimer > 0;

      if (safeJump || safeSlide || safeDash) {
        this.destroyItem(i, item);
        this.addCombo(2);
      } else {
        this.gameOver();
      }
    }
  }

  intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  collectItem(index, item) {
    this.state.obstacles.splice(index, 1);
    this.state.score += 120;
    this.state.flash = 1;
    this.spawnParticles(this.getLaneX(item.lane), item.y, '#00ffcc', 16);
    this.addCombo(3);
    this.showQuote('Bonus +120');
    this.playBeep(880, 0.07, 'triangle');
  }

  destroyItem(index, item) {
    this.state.obstacles.splice(index, 1);
    this.spawnParticles(this.getLaneX(item.lane), item.y, '#ffd700', 12);
    this.playBeep(420, 0.05, 'square');
  }

  addCombo(amount) {
    const s = this.state;
    s.combo = Math.min(99, s.combo + amount);
    s.comboTimer = 2.2;
    if (s.combo >= 3) this.showCombo(`×${s.combo} combo`);
  }

  moveLane(direction) {
    this.state.lane = Math.max(0, Math.min(2, this.state.lane + direction));
    this.playBeep(320, 0.035, 'square');
  }

  jump() {
    const maxJumps = this.state.doubleJumpUnlocked ? 2 : 1;
    if (this.state.jumpCount >= maxJumps || this.state.sliding) return;
    this.state.velocityY = 690;
    this.state.jumpCount += 1;
    this.playBeep(520, 0.055, 'triangle');
  }

  slide() {
    if (this.state.playerY > 10) return;
    this.state.sliding = true;
    this.state.slideTimer = 0.55;
    this.playBeep(180, 0.045, 'sawtooth');
  }

  dash() {
    if (!this.state.dashUnlocked || this.state.dashCooldown > 0) return;
    this.state.dashTimer = 0.42;
    this.state.dashCooldown = 4.8;
    const rect = this.getPlayerRect();
    this.spawnParticles(rect.x + rect.width / 2, rect.y + rect.height / 2, '#ff007f', 20);
    this.playBeep(760, 0.065, 'square');
  }

  draw() {
    this.drawBackground();
    this.drawRoad();
    this.drawItems();
    this.drawParticles();
    this.drawPlayer();

    if (this.state.paused) this.drawPauseOverlay();
    if (this.state.flash > 0) this.drawFlash();
  }

  drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#070914');
    gradient.addColorStop(0.55, '#101018');
    gradient.addColorStop(1, '#050505');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    this.ctx.globalAlpha = 0.45;
    for (let i = 0; i < 22; i++) {
      const x = (i * 97 + this.state.roadOffset * 0.18) % (this.width + 120) - 60;
      const h = 80 + (i % 7) * 28;
      this.ctx.fillStyle = i % 2 ? '#101820' : '#17111f';
      this.ctx.fillRect(x, this.height - 260 - h, 44, h);
      this.ctx.fillStyle = i % 3 ? '#00bfff' : '#ff007f';
      this.ctx.fillRect(x + 12, this.height - 250 - h, 8, 12);
    }
    this.ctx.restore();
  }

  drawRoad() {
    const roadWidth = Math.min(this.width * 0.78, 520);
    const left = this.width / 2 - roadWidth / 2;
    const top = 0;

    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(left, top, roadWidth, this.height);

    this.ctx.strokeStyle = 'rgba(0,191,255,0.7)';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(left, 0, roadWidth, this.height);

    this.ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    this.ctx.lineWidth = 2;
    for (let lane = 1; lane < 3; lane++) {
      const x = left + roadWidth * lane / 3;
      for (let y = -80 + this.state.roadOffset; y < this.height + 80; y += 80) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y + 42);
        this.ctx.stroke();
      }
    }
  }

  drawPlayer() {
    const rect = this.getPlayerRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;

    this.ctx.save();
    this.ctx.shadowBlur = 22;
    this.ctx.shadowColor = this.state.dashTimer > 0 ? '#ff007f' : '#00bfff';
    this.roundRect(rect.x, rect.y, rect.width, rect.height, 14, this.state.dashTimer > 0 ? '#ff007f' : '#00bfff');
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#ffd700';
    this.ctx.beginPath();
    this.ctx.arc(x, rect.y - 12, 16, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x - 15, y + rect.height / 2 - 5, 30, 8);
    this.ctx.restore();
  }

  drawItems() {
    for (const item of this.state.obstacles) {
      const rect = this.getItemRect(item);
      const color = item.type === 'pickup' ? '#00ffcc' : item.type === 'low' ? '#ffd700' : '#ff007f';

      this.ctx.save();
      this.ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
      this.ctx.rotate(item.type === 'pickup' ? item.rotation : 0);
      this.ctx.shadowBlur = 18;
      this.ctx.shadowColor = color;

      if (item.type === 'pickup') {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -24);
        this.ctx.lineTo(24, 0);
        this.ctx.lineTo(0, 24);
        this.ctx.lineTo(-24, 0);
        this.ctx.closePath();
        this.ctx.fill();
      } else {
        this.roundRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, 12, color);
      }
      this.ctx.restore();
    }
  }

  drawParticles() {
    for (const particle of this.state.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, particle.life);
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  drawPauseOverlay() {
    this.ctx.fillStyle = 'rgba(0,0,0,0.52)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = '#00bfff';
    this.ctx.font = '700 56px Teko, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUZA', this.width / 2, this.height / 2);
  }

  drawFlash() {
    this.ctx.save();
    this.ctx.globalAlpha = this.state.flash * 0.16;
    this.ctx.fillStyle = '#00ffcc';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  roundRect(x, y, width, height, radius, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.arcTo(x + width, y, x + width, y + height, radius);
    this.ctx.arcTo(x + width, y + height, x, y + height, radius);
    this.ctx.arcTo(x, y + height, x, y, radius);
    this.ctx.arcTo(x, y, x + width, y, radius);
    this.ctx.closePath();
    this.ctx.fill();
  }

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.state.particles.push({
        x,
        y,
        color,
        size: 3 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 420,
        vy: -120 - Math.random() * 260,
        life: 0.45 + Math.random() * 0.45
      });
    }
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

  gameOver() {
    if (!this.state.running) return;
    this.state.running = false;
    const finalScore = Math.floor(this.state.score);

    if (finalScore > this.bestScore) {
      this.bestScore = finalScore;
      this.safeSaveBestScore(finalScore);
    }

    this.elements['final-score'].textContent = finalScore.toLocaleString('cs-CZ');
    this.elements['game-time'].textContent = `${Math.floor(this.state.elapsed)}s`;
    this.elements['game-over-quote'].textContent = GAME_OVER_QUOTES[Math.floor(Math.random() * GAME_OVER_QUOTES.length)];
    this.elements['ai-summary-container'].hidden = true;
    this.updateBestScore();
    this.showScreen('game-over');
    this.playBeep(90, 0.14, 'sawtooth');
  }

  showRunSummary() {
    const container = this.elements['ai-summary-container'];
    const spinner = this.elements['ai-summary-spinner'];
    const text = this.elements['ai-summary-text'];
    const finalScore = Math.floor(this.state.score);
    const time = Math.floor(this.state.elapsed);

    container.hidden = false;
    spinner.hidden = false;
    text.textContent = '';

    window.setTimeout(() => {
      spinner.hidden = true;
      text.textContent = `Výsledek ${finalScore.toLocaleString('cs-CZ')} bodů za ${time}s. Příště drž rytmus: pruh, skok, skluz — a žádný panický klikání.`;
    }, 350);
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    this.elements[id]?.classList.add('active');
  }

  showFallback() {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    if (this.elements['webgl-fallback']) this.elements['webgl-fallback'].hidden = false;
  }

  updateScore(value) {
    this.elements['current-score'].textContent = Math.floor(value).toLocaleString('cs-CZ');
  }

  updateBestScore() {
    this.elements['best-score'].textContent = Math.floor(this.bestScore).toLocaleString('cs-CZ');
  }

  updateSkillHud() {
    this.elements['skill-doubleJump'].classList.toggle('unlocked', this.state.doubleJumpUnlocked);
    this.elements['skill-dash'].classList.toggle('unlocked', this.state.dashUnlocked);
    this.elements['skill-dash'].classList.toggle('cooldown', this.state.dashCooldown > 0);
  }

  showQuote(text) {
    const box = this.elements['quote-display'];
    this.elements['quote-text'].textContent = text;
    box.classList.add('active');
    window.clearTimeout(this.quoteTimeout);
    this.quoteTimeout = window.setTimeout(() => box.classList.remove('active'), 1800);
  }

  showCombo(text) {
    const combo = this.elements['combo-display'];
    combo.textContent = text;
    combo.classList.add('active');
    window.clearTimeout(this.comboTimeout);
    this.comboTimeout = window.setTimeout(() => combo.classList.remove('active'), 650);
  }

  updateLoadingText(text) {
    if (this.elements['loading-text']) this.elements['loading-text'].textContent = text;
  }

  playBeep(frequency, duration, type = 'sine') {
    if (this.state.muted) return;

    try {
      this.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.035, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }

  safeReadBestScore() {
    try {
      return Number(localStorage.getItem(STORAGE_KEY) || 0);
    } catch {
      return 0;
    }
  }

  safeSaveBestScore(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Private mode or blocked storage. Game still works.
    }
  }
}

new PedroRunner2D();
