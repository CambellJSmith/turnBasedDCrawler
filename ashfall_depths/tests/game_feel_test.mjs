import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GameFeelSystem } from "../src/systems/game_feel_system.js";
import { CombatSystem } from "../src/systems/combat_system.js";
import { MovementSystem } from "../src/systems/movement_system.js";
import "../src/systems/game_feel_patch.js";

const feel_game = {
  state: { settings: { master_volume: 0, screen_shake: true } }
};
const feel = new GameFeelSystem(feel_game);
const source = create_actor("player", 1, 1, 40);
const target = create_actor("monster", 2, 1, 30);
target.health = 20;

feel.impact(target, source, 9, 100);
assert.ok(feel.hit_stop_until > 100, "impact should create hit-stop");
assert.ok(feel.shake_until > 100, "impact should create camera shake");
assert.ok(feel.get_flash(110)?.alpha > 0, "impact should create a screen flash");
assert.ok(feel.particles.length >= 8, "impact should create a particle burst");
assert.ok(target.juice_recoil_until > 100, "the target should recoil");
assert.ok(source.juice_lunge_until > 100, "the attacker should lunge");
assert.notDeepEqual(feel.get_shake(120), { x: 0, y: 0 });

feel_game.state.settings.screen_shake = false;
feel.shake_until = 0;
feel.shake(200, 8, 200);
assert.equal(feel.shake_until, 0, "screen shake setting must disable new shake events");
assert.doesNotThrow(() => feel.play_sound("hit"), "procedural sound must degrade safely when Web Audio is unavailable");

const feedback_calls = [];
const combat_game = {
  combat_texts: [],
  game_feel: {
    impact: (...args) => feedback_calls.push(["impact", ...args]),
    pulse_command: (id) => feedback_calls.push(["pulse", id]),
    whiff: () => feedback_calls.push(["whiff"])
  },
  spawn_combat_text(grid_x, grid_y, text) {
    this.combat_texts.push({ grid_x, grid_y, text, created_at: performance.now() });
  },
  get_living_monsters: () => [target],
  player: source,
  add_log: () => {},
  state: { inventory: { equipped_weapon_id: null } },
  entities: [source, target]
};
const combat = new CombatSystem(combat_game);
combat.apply_damage(target, 5, source, 300);
assert.equal(feedback_calls[0][0], "impact");
assert.equal(combat_game.combat_texts.at(-1).kind, "damage");
assert.equal(combat_game.combat_texts.at(-1).emphasis, false);

const movement_calls = [];
const movement_game = {
  game_feel: { step: (entity, now) => movement_calls.push([entity.entity_id, now]) }
};
const movement = new MovementSystem(movement_game);
const mover = create_actor("player", 0, 0, 40);
movement.begin_move(mover, 1, 0, 400);
assert.deepEqual(movement_calls, [[mover.entity_id, 400]]);
assert.equal(mover.moving, true);

const project_root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const render_source = readFileSync(resolve(project_root, "src/render/game_feel_render_patch.js"), "utf8");
const style_source = readFileSync(resolve(project_root, "styles/game_feel.css"), "utf8");
const main_source = readFileSync(resolve(project_root, "src/main.js"), "utf8");
assert.match(render_source, /draw_action_indicators/);
assert.match(render_source, /draw_game_feel_particles/);
assert.match(render_source, /draw_punchy_combat_text/);
assert.match(render_source, /draw_game_feel_flash/);
assert.match(style_source, /juice_command_press/);
assert.match(style_source, /prefers-reduced-motion/);
assert.match(main_source, /install_game_feel\(game\)/);

console.log("hit-stop, recoil, particles, movement feedback, sound fallback, and render hooks passed");

function create_actor(type, grid_x, grid_y, maximum_health) {
  return {
    entity_id: `${type}_${grid_x}_${grid_y}`,
    type,
    name: type,
    alive: true,
    moving: false,
    grid_x,
    grid_y,
    display_x: grid_x,
    display_y: grid_y,
    move_from_x: grid_x,
    move_from_y: grid_y,
    move_started_at: 0,
    facing: { x: 1, y: 0 },
    maximum_health,
    health: maximum_health,
    maximum_magic: 0,
    magic: 0,
    attack: 10,
    defence: 0,
    magic_power: 0,
    flash_until: 0
  };
}
