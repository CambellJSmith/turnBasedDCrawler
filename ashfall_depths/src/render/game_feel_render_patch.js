import { game_config } from "../config/game_config.js";
import { calculate_camera, grid_to_screen } from "../world/isometric.js";
import { CanvasRenderer } from "./canvas_renderer.js";

const actor_types = new Set(["player", "monster", "companion", "recruitable"]);

CanvasRenderer.prototype.render = function render_with_game_feel(now) {
  const context = this.context;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.clearRect(0, 0, this.canvas.width, this.canvas.height);

  const gradient = context.createLinearGradient(0, 0, 0, this.canvas.height);
  gradient.addColorStop(0, "#151925");
  gradient.addColorStop(1, "#080a0f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, this.canvas.width, this.canvas.height);

  const camera = calculate_camera(this.game.player);
  const shake = this.game.game_feel?.get_shake(now) ?? { x: 0, y: 0 };
  camera.offset_x += shake.x;
  camera.offset_y += shake.y;

  this.draw_floor_tiles(camera);
  this.draw_action_indicators(camera, now);
  this.draw_depth_sorted_world(camera, now);
  this.draw_game_feel_particles(camera, now);
  this.draw_effects(camera, now);
  this.draw_combat_text(camera, now);
  this.draw_vignette();
  this.draw_game_feel_flash(now);
};

const previous_draw_actor = CanvasRenderer.prototype.draw_actor;
CanvasRenderer.prototype.draw_actor = function draw_actor_with_motion_feedback(entity, screen, now) {
  if (!actor_types.has(entity.type)) {
    return previous_draw_actor.call(this, entity, screen, now);
  }

  const offset = this.game.game_feel?.get_actor_offset(entity, now) ?? { x: 0, y: 0 };
  const adjusted_screen = { x: screen.x + offset.x, y: screen.y + offset.y };
  return previous_draw_actor.call(this, entity, adjusted_screen, now);
};

CanvasRenderer.prototype.draw_action_indicators = function draw_action_indicators(camera, now) {
  if (!this.game.player?.alive || this.game.paused) {
    return;
  }

  const context = this.context;
  const pulse = 0.5 + Math.sin(now / 130) * 0.5;
  const can_act = Boolean(this.game.turn_system?.can_player_act?.());

  if (can_act) {
    const prompt = this.game.interaction_system?.get_prompt?.() ?? "";
    if (prompt) {
      const player_screen = grid_to_screen(this.game.player.grid_x, this.game.player.grid_y, camera);
      draw_tile_diamond(context, player_screen.x, player_screen.y, `rgba(255,225,125,${0.36 + pulse * 0.28})`, 3);
    }

    for (const monster of this.game.get_living_monsters()) {
      const distance = Math.hypot(monster.grid_x - this.game.player.grid_x, monster.grid_y - this.game.player.grid_y);
      const tile = this.game.dungeon.grid.get_tile(monster.grid_x, monster.grid_y);
      if (distance > 1.25 || tile?.visible === false) {
        continue;
      }
      const screen = grid_to_screen(monster.grid_x, monster.grid_y, camera);
      draw_tile_diamond(context, screen.x, screen.y, `rgba(255,103,91,${0.46 + pulse * 0.34})`, 3.5);
      context.beginPath();
      context.arc(screen.x, screen.y - 20, 17 + pulse * 3, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255,190,125,${0.35 + pulse * 0.35})`;
      context.lineWidth = 2;
      context.stroke();
    }
  }

  if (now < (this.game.game_feel?.turn_ready_until ?? 0)) {
    const progress = 1 - Math.max(0, (this.game.game_feel.turn_ready_until - now) / 500);
    const player_screen = grid_to_screen(this.game.player.grid_x, this.game.player.grid_y, camera);
    context.beginPath();
    context.arc(player_screen.x, player_screen.y - 11, 20 + progress * 18, 0, Math.PI * 2);
    context.strokeStyle = `rgba(150,225,255,${1 - progress})`;
    context.lineWidth = 3;
    context.stroke();
  }
};

CanvasRenderer.prototype.draw_game_feel_particles = function draw_game_feel_particles(camera, now) {
  const particles = this.game.game_feel?.particles ?? [];
  const context = this.context;

  for (const particle of particles) {
    const age_ms = now - particle.created_at;
    const progress = Math.max(0, Math.min(1, age_ms / particle.lifetime));
    const age_seconds = age_ms / 1000;
    const origin = grid_to_screen(particle.grid_x, particle.grid_y, camera);
    const x = origin.x + particle.offset_x + particle.velocity_x * age_seconds;
    const y = origin.y + particle.offset_y + particle.velocity_y * age_seconds + 0.5 * particle.gravity * age_seconds * age_seconds;
    const size = particle.size * (1 - progress * 0.45);

    context.save();
    context.globalAlpha = 1 - progress;
    context.translate(x, y);
    context.rotate(age_seconds * 8);
    context.fillStyle = particle.color;
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
  }
};

CanvasRenderer.prototype.draw_combat_text = function draw_punchy_combat_text(camera, now) {
  this.game.combat_texts = this.game.combat_texts.filter((entry) => now - entry.created_at < 850);
  for (const entry of this.game.combat_texts) {
    const progress = Math.max(0, Math.min(1, (now - entry.created_at) / 850));
    const screen = grid_to_screen(entry.grid_x, entry.grid_y, camera);
    const emphasis = entry.emphasis === true;
    const pop_progress = Math.min(1, progress * 5);
    const scale = 1 + Math.sin(pop_progress * Math.PI) * (emphasis ? 0.55 : 0.3);
    const rise = progress * (emphasis ? 38 : 30);
    const fill = entry.kind === "heal" ? "#a9ffc0" : entry.kind === "danger" ? "#ff9a9a" : "#fff0a8";

    this.context.save();
    this.context.globalAlpha = Math.min(1, (1 - progress) * 1.35);
    this.context.translate(screen.x, screen.y - 36 - rise);
    this.context.scale(scale, scale);
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.font = `900 ${emphasis ? 22 : 17}px "Trebuchet MS", sans-serif`;
    this.context.lineJoin = "round";
    this.context.strokeStyle = "#080b14";
    this.context.lineWidth = emphasis ? 6 : 5;
    this.context.strokeText(entry.text, 0, 0);
    this.context.fillStyle = fill;
    this.context.fillText(entry.text, 0, 0);
    this.context.restore();
  }
};

CanvasRenderer.prototype.draw_game_feel_flash = function draw_game_feel_flash(now) {
  const flash = this.game.game_feel?.get_flash(now);
  if (!flash) {
    return;
  }
  this.context.save();
  this.context.globalCompositeOperation = "screen";
  this.context.fillStyle = `rgba(${flash.color},${flash.alpha})`;
  this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  this.context.restore();
};

function draw_tile_diamond(context, x, y, stroke_style, line_width) {
  const half_width = game_config.tile_width / 2 - 3;
  const half_height = game_config.tile_height / 2 - 2;
  context.beginPath();
  context.moveTo(x, y - half_height);
  context.lineTo(x + half_width, y);
  context.lineTo(x, y + half_height);
  context.lineTo(x - half_width, y);
  context.closePath();
  context.strokeStyle = stroke_style;
  context.lineWidth = line_width;
  context.stroke();
}
