const actor_types = new Set(["player", "monster", "companion", "recruitable"]);

export class GameFeelSystem {
  constructor(game) {
    this.game = game;
    this.hit_stop_until = 0;
    this.shake_started_at = 0;
    this.shake_until = 0;
    this.shake_intensity = 0;
    this.flash_started_at = 0;
    this.flash_until = 0;
    this.flash_color = "255,255,255";
    this.flash_alpha = 0;
    this.turn_ready_until = 0;
    this.particles = [];
    this.audio_context = null;
    this.audio_unlocked = false;
    this.unlock_audio = this.unlock_audio.bind(this);

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.unlock_audio, { capture: true, passive: true });
      window.addEventListener("pointerdown", this.unlock_audio, { capture: true, passive: true });
    }
  }

  wrap_loop() {
    const original_loop = this.game.loop;
    this.game.loop = (now) => {
      this.update(now);
      if (this.is_hit_stopped(now)) {
        this.game.last_frame_time = now;
        this.game.input_system.update(now);
        this.game.hud_controller.update();
        this.game.renderer.render(now);
        requestAnimationFrame(this.game.loop);
        return;
      }
      original_loop(now);
    };
  }

  update(now) {
    this.particles = this.particles.filter((particle) => now - particle.created_at < particle.lifetime);
  }

  is_hit_stopped(now) {
    return now < this.hit_stop_until;
  }

  start_hit_stop(now, duration = 45) {
    this.hit_stop_until = Math.max(this.hit_stop_until, now + duration);
  }

  shake(now, intensity = 4, duration = 120) {
    if (this.game.state?.settings?.screen_shake === false) {
      return;
    }
    if (now >= this.shake_until) {
      this.shake_intensity = intensity;
      this.shake_until = now + duration;
    } else {
      this.shake_intensity = Math.max(this.shake_intensity, intensity);
      this.shake_until = Math.max(this.shake_until, now + duration);
    }
    this.shake_started_at = now;
  }

  flash(now, color = "255,255,255", alpha = 0.18, duration = 90) {
    if (now >= this.flash_until) {
      this.flash_alpha = alpha;
      this.flash_until = now + duration;
    } else {
      this.flash_alpha = Math.max(this.flash_alpha, alpha);
      this.flash_until = Math.max(this.flash_until, now + duration);
    }
    this.flash_started_at = now;
    this.flash_color = color;
  }

  get_shake(now) {
    if (now >= this.shake_until || this.shake_intensity <= 0) {
      return { x: 0, y: 0 };
    }
    const duration = Math.max(1, this.shake_until - this.shake_started_at);
    const remaining = Math.max(0, (this.shake_until - now) / duration);
    const magnitude = this.shake_intensity * remaining;
    return {
      x: Math.sin(now * 0.087) * magnitude,
      y: Math.cos(now * 0.113) * magnitude * 0.65
    };
  }

  get_flash(now) {
    if (now >= this.flash_until) {
      return null;
    }
    const duration = Math.max(1, this.flash_until - this.flash_started_at);
    const remaining = Math.max(0, (this.flash_until - now) / duration);
    return {
      color: this.flash_color,
      alpha: this.flash_alpha * remaining
    };
  }

  get_actor_offset(entity, now) {
    let x = 0;
    let y = 0;

    if (entity.moving && Number.isFinite(entity.move_started_at)) {
      const duration = 115;
      const progress = Math.max(0, Math.min(1, (now - entity.move_started_at) / duration));
      y -= Math.sin(progress * Math.PI) * (entity.type === "player" ? 7 : 4);
    }

    if (now < (entity.juice_recoil_until ?? 0)) {
      const remaining = Math.max(0, (entity.juice_recoil_until - now) / 120);
      x += (entity.juice_recoil_x ?? 0) * remaining;
      y += (entity.juice_recoil_y ?? 0) * remaining;
    }

    if (now < (entity.juice_lunge_until ?? 0)) {
      const remaining = Math.max(0, (entity.juice_lunge_until - now) / 100);
      x += (entity.juice_lunge_x ?? 0) * remaining;
      y += (entity.juice_lunge_y ?? 0) * remaining;
    }

    return { x, y };
  }

  impact(target, source, amount, now = performance.now(), options = {}) {
    const fatal = options.fatal === true || target.health <= 0;
    const heavy = fatal || amount >= Math.max(8, target.maximum_health * 0.2);
    const direction = this.get_screen_direction(source, target);

    target.juice_recoil_until = now + (heavy ? 150 : 110);
    target.juice_recoil_x = direction.x * (heavy ? 10 : 6);
    target.juice_recoil_y = direction.y * (heavy ? 6 : 4);

    if (source && actor_types.has(source.type)) {
      source.juice_lunge_until = now + 90;
      source.juice_lunge_x = direction.x * 4;
      source.juice_lunge_y = direction.y * 2;
    }

    const danger = target.type === "player" || target.type === "companion";
    const flash_color = danger ? (fatal ? "255,55,70" : "255,100,100") : fatal ? "255,226,170" : "255,255,255";
    this.start_hit_stop(now, heavy ? 72 : 42);
    this.shake(now, heavy ? 7 : 3.5, heavy ? 170 : 100);
    this.flash(now, flash_color, danger ? (heavy ? 0.24 : 0.14) : heavy ? 0.2 : 0.1, heavy ? 120 : 70);
    this.spawn_burst(target.grid_x, target.grid_y, heavy ? 14 : 8, fatal ? "gold" : "impact", now);
    this.play_sound(heavy ? "heavy_hit" : "hit");
    this.rumble(heavy ? 0.85 : 0.42, heavy ? 0.55 : 0.25, heavy ? 150 : 80);
    this.pulse_frame("juice-impact", heavy ? 180 : 110);
  }

  whiff(entity, now = performance.now()) {
    entity.juice_lunge_until = now + 100;
    const direction = this.facing_to_screen(entity.facing);
    entity.juice_lunge_x = direction.x * 8;
    entity.juice_lunge_y = direction.y * 4;
    this.play_sound("whiff");
    this.spawn_burst(entity.grid_x, entity.grid_y, 4, "dust", now, direction);
  }

  step(entity, now = performance.now(), grid_x = entity?.grid_x, grid_y = entity?.grid_y) {
    if (!entity || !actor_types.has(entity.type)) {
      return;
    }
    this.spawn_burst(grid_x, grid_y, entity.type === "player" ? 4 : 2, "dust", now);
    if (entity.type === "player") {
      this.play_sound("step");
    }
  }

  spell(spell_id, caster, now = performance.now()) {
    const visual = spell_id === "fire_bolt" ? "fire" : spell_id === "healing_light" ? "heal" : "frost";
    const color = visual === "fire" ? "255,120,55" : visual === "heal" ? "110,255,155" : "130,210,255";
    this.flash(now, color, visual === "heal" ? 0.12 : 0.16, 130);
    this.shake(now, visual === "heal" ? 1.5 : 3, 100);
    this.spawn_burst(caster.grid_x, caster.grid_y, 12, visual, now);
    this.play_sound(visual);
    this.pulse_command(`command_spell_${spell_id === "fire_bolt" ? "1" : spell_id === "healing_light" ? "2" : "3"}`);
  }

  interaction(object, now = performance.now()) {
    const type = object?.object_type ?? "interact";
    const sound = type === "locked_door" || type === "secret_wall"
      ? "door"
      : type === "explosive_barrel"
        ? "heavy_hit"
        : "interact";
    this.play_sound(sound);
    this.spawn_burst(object.grid_x, object.grid_y, type === "explosive_barrel" ? 16 : 7, type === "explosive_barrel" ? "fire" : "spark", now);
    this.shake(now, type === "explosive_barrel" ? 8 : 2, type === "explosive_barrel" ? 210 : 80);
    this.pulse_command("command_interact");
  }

  chest(chest, now = performance.now()) {
    this.spawn_burst(chest.grid_x, chest.grid_y, 22, "gold", now);
    this.flash(now, "255,220,110", 0.18, 180);
    this.shake(now, 2.5, 110);
    this.play_sound("chest");
    this.pulse_frame("juice-reward", 420);
  }

  heal(entity, amount, now = performance.now()) {
    if (amount <= 0) {
      return;
    }
    this.spawn_burst(entity.grid_x, entity.grid_y, 12, "heal", now);
    this.play_sound("heal");
  }

  floor_transition(now = performance.now()) {
    this.flash(now, "210,230,255", 0.35, 420);
    this.play_sound("floor");
    this.pulse_frame("juice-floor", 500);
  }

  turn_ready(now = performance.now()) {
    this.turn_ready_until = now + 500;
    this.pulse_frame("turn-ready", 500);
    this.play_sound("ready");
  }

  spawn_burst(grid_x, grid_y, count, palette, now, direction = null) {
    const colors = {
      impact: ["#fff4cf", "#ff9e64", "#dc554d"],
      fire: ["#fff0a3", "#ff9a42", "#e84d3f"],
      frost: ["#effcff", "#8fdcff", "#6a8cff"],
      heal: ["#eaffdb", "#7fe6a0", "#39b878"],
      gold: ["#fff6b8", "#efc967", "#d4872c"],
      dust: ["#9f917e", "#6d665f", "#49474a"],
      spark: ["#fff4cb", "#dbc789", "#8da8d8"]
    }[palette] ?? ["#ffffff"];

    for (let index = 0; index < count; index += 1) {
      const angle = direction
        ? Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * 1.2
        : Math.random() * Math.PI * 2;
      const speed = palette === "dust" ? 8 + Math.random() * 12 : 18 + Math.random() * 38;
      this.particles.push({
        grid_x,
        grid_y,
        offset_x: (Math.random() - 0.5) * 10,
        offset_y: -8 + (Math.random() - 0.5) * 8,
        velocity_x: Math.cos(angle) * speed,
        velocity_y: Math.sin(angle) * speed - (palette === "gold" || palette === "heal" ? 22 : 8),
        gravity: palette === "frost" ? 8 : 48,
        size: palette === "dust" ? 2 + Math.random() * 2 : 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        created_at: now,
        lifetime: palette === "gold" ? 720 : palette === "dust" ? 320 : 480 + Math.random() * 180
      });
    }
  }

  get_screen_direction(source, target) {
    if (!source || !Number.isFinite(source.grid_x) || !Number.isFinite(source.grid_y)) {
      return { x: 0, y: -1 };
    }
    const grid_dx = target.grid_x - source.grid_x;
    const grid_dy = target.grid_y - source.grid_y;
    const screen_x = grid_dx - grid_dy;
    const screen_y = (grid_dx + grid_dy) * 0.5;
    const length = Math.hypot(screen_x, screen_y) || 1;
    return { x: screen_x / length, y: screen_y / length };
  }

  facing_to_screen(facing) {
    if (!facing) {
      return { x: 1, y: 0 };
    }
    const screen_x = facing.x - facing.y;
    const screen_y = (facing.x + facing.y) * 0.5;
    const length = Math.hypot(screen_x, screen_y) || 1;
    return { x: screen_x / length, y: screen_y / length };
  }

  pulse_frame(class_name, duration) {
    if (typeof document === "undefined") {
      return;
    }
    const frame = document.querySelector("#game_frame");
    if (!frame) {
      return;
    }
    frame.classList.remove(class_name);
    void frame.offsetWidth;
    frame.classList.add(class_name);
    setTimeout(() => frame.classList.remove(class_name), duration);
  }

  pulse_command(button_id) {
    if (typeof document === "undefined") {
      return;
    }
    const button = document.querySelector(`#${button_id}`);
    if (!button) {
      return;
    }
    button.classList.remove("juice-active");
    void button.offsetWidth;
    button.classList.add("juice-active");
    setTimeout(() => button.classList.remove("juice-active"), 220);
  }

  unlock_audio() {
    const context = this.ensure_audio_context();
    if (!context) {
      return;
    }
    context.resume?.();
    this.audio_unlocked = true;
  }

  ensure_audio_context() {
    if (this.audio_context) {
      return this.audio_context;
    }
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    try {
      this.audio_context = new AudioContextClass();
      return this.audio_context;
    } catch {
      return null;
    }
  }

  play_sound(kind) {
    const context = this.ensure_audio_context();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      const resume_result = context.resume?.();
      resume_result?.then?.(() => this.play_sound(kind)).catch?.(() => {});
      return;
    }

    const volume = Math.max(0, Math.min(1, Number(this.game.state?.settings?.master_volume) || 0));
    if (volume <= 0) {
      return;
    }

    switch (kind) {
      case "step": this.play_tone(105, 68, 0.035, "triangle", volume * 0.035); break;
      case "whiff": this.play_noise(0.06, volume * 0.045, 1300); break;
      case "hit":
        this.play_tone(135, 58, 0.075, "square", volume * 0.075);
        this.play_noise(0.06, volume * 0.05, 900);
        break;
      case "heavy_hit":
        this.play_tone(92, 36, 0.13, "sawtooth", volume * 0.11);
        this.play_noise(0.11, volume * 0.08, 700);
        break;
      case "fire":
        this.play_tone(310, 95, 0.18, "sawtooth", volume * 0.075);
        this.play_noise(0.15, volume * 0.045, 1800);
        break;
      case "frost":
        this.play_tone(760, 260, 0.2, "triangle", volume * 0.06);
        this.play_tone(1040, 420, 0.13, "sine", volume * 0.035, 0.035);
        break;
      case "heal":
        this.play_tone(420, 620, 0.2, "sine", volume * 0.055);
        this.play_tone(620, 860, 0.24, "sine", volume * 0.04, 0.07);
        break;
      case "chest":
        this.play_tone(440, 620, 0.14, "triangle", volume * 0.055);
        this.play_tone(620, 820, 0.18, "triangle", volume * 0.05, 0.09);
        this.play_tone(820, 1080, 0.22, "triangle", volume * 0.045, 0.18);
        break;
      case "door":
        this.play_tone(100, 45, 0.18, "square", volume * 0.075);
        this.play_noise(0.14, volume * 0.05, 500);
        break;
      case "floor":
        this.play_tone(220, 440, 0.28, "sine", volume * 0.05);
        this.play_tone(330, 660, 0.32, "triangle", volume * 0.04, 0.08);
        break;
      case "ready": this.play_tone(520, 650, 0.07, "sine", volume * 0.025); break;
      default: this.play_tone(240, 330, 0.08, "triangle", volume * 0.035); break;
    }
  }

  play_tone(start_frequency, end_frequency, duration, type, volume, delay = 0) {
    const context = this.audio_context;
    if (!context) {
      return;
    }
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start_frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end_frequency), start + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  play_noise(duration, volume, cutoff) {
    const context = this.audio_context;
    if (!context) {
      return;
    }
    const sample_count = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sample_count, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sample_count; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / sample_count);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  rumble(strong, weak, duration) {
    if (typeof navigator === "undefined") {
      return;
    }
    const gamepads = navigator.getGamepads?.() ?? [];
    for (const gamepad of gamepads) {
      const actuator = gamepad?.vibrationActuator;
      actuator?.playEffect?.("dual-rumble", {
        duration,
        strongMagnitude: strong,
        weakMagnitude: weak
      }).catch?.(() => {});
    }
  }
}

export function install_game_feel(game) {
  const system = new GameFeelSystem(game);
  game.game_feel = system;
  system.wrap_loop();
  return system;
}
