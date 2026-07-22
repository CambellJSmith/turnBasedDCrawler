import assert from "node:assert/strict";
import { calculate_monster_experience, experience_required_for_level } from "../src/config/player_progression.js";
import { create_default_player_upgrade_ranks } from "../src/data/player_upgrades.js";
import { GameState } from "../src/state/game_state.js";
import { PlayerProgressionSystem } from "../src/systems/player_progression_system.js";
import { InteractionSystem } from "../src/systems/interaction_system.js";

const weak_monster = {
  name: "weak slime",
  maximum_health: 10,
  attack: 2,
  defence: 0,
  magic_power: 2,
  difficulty_floor: 1,
  special_ability: null
};
const strong_monster = {
  name: "strong warden",
  maximum_health: 120,
  attack: 18,
  defence: 10,
  magic_power: 12,
  difficulty_floor: 12,
  special_ability: { power: 9, range: 4, use_chance: 0.8 }
};
assert.ok(calculate_monster_experience(strong_monster) > calculate_monster_experience(weak_monster));
assert.ok(experience_required_for_level(10) > experience_required_for_level(1));

const migrated_state = new GameState();
migrated_state.load({ player_level: 4, player_experience: 3 });
assert.equal(migrated_state.legacy_completed_levels, 3, "old saves should retain their automatic health and magic levels");
assert.equal(migrated_state.progression_mode_version, 2);

const logs = [];
const game = {
  state: {
    player_level: 1,
    player_experience: 0,
    legacy_completed_levels: 0,
    pending_level_choices: 0,
    player_upgrade_ranks: create_default_player_upgrade_ranks()
  },
  player: {
    maximum_health: 85,
    maximum_magic: 45,
    health: 60,
    magic: 20,
    attack: 14,
    defence: 7,
    magic_power: 12,
    grid_x: 2,
    grid_y: 3,
    alive: true
  },
  dungeon: { random: { integer: (minimum) => minimum } },
  paused: false,
  add_log: (message) => logs.push(message),
  add_effect: () => {},
  save_manager: { save: () => {} },
  level_up_controller: {
    shown: 0,
    hidden: 0,
    show_next_choice() { this.shown += 1; },
    hide() { this.hidden += 1; }
  }
};
const progression = new PlayerProgressionSystem(game);
progression.apply_to_player(game.player, { health: 60, magic: 20 });
const weak_reward = calculate_monster_experience(weak_monster);
game.state.player_experience = experience_required_for_level(1) - weak_reward;
const result = progression.award_for_monster(weak_monster);
assert.equal(result.levels_gained, 1);
assert.equal(game.state.player_level, 2);
assert.equal(game.state.pending_level_choices, 1);
assert.equal(game.player.maximum_health, 85, "leveling should wait for a chosen upgrade");
assert.equal(game.player.maximum_magic, 45);
assert.equal(game.level_up_controller.shown, 1);
assert.ok(logs.some((message) => message.includes("choose a permanent upgrade")));

assert.equal(progression.choose_upgrade("maximum_health"), true);
assert.equal(game.state.player_upgrade_ranks.maximum_health, 1);
assert.equal(game.player.maximum_health, 97);
assert.equal(game.player.health, 72);
assert.equal(game.state.pending_level_choices, 0);

const old_attack = game.player.attack;
game.state.pending_level_choices = 1;
assert.equal(progression.choose_upgrade("attack"), true);
assert.equal(game.player.attack, old_attack + 2);

game.state.player_upgrade_ranks.bonus_experience = 2;
game.state.player_level = 20;
game.state.player_experience = 0;
const boosted_reward = progression.award_for_monster(weak_monster).experience;
assert.equal(boosted_reward, Math.round(weak_reward * 1.3));

const choices = progression.get_upgrade_choices(3);
assert.equal(choices.length, 3);
assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);

let advanced_floor = false;
const door_game = {
  player: { grid_x: 4, grid_y: 5 },
  entities: [],
  loot_system: { collect_items_at_player: () => false },
  recruitment_system: { get_nearby_recruitable: () => null },
  dungeon: { grid: { get_tile: () => ({ terrain_id: "exit" }) } },
  get_living_monsters: () => [{ alive: true }],
  advance_floor: () => { advanced_floor = true; },
  add_log: () => {}
};
const interaction = new InteractionSystem(door_game);
assert.deepEqual(interaction.interact(), { consumes_turn: true, skip_non_player_turns: true });
assert.equal(advanced_floor, true, "the door should work while monsters remain alive");
assert.match(interaction.get_prompt(), /remaining enemies are optional/);

console.log("selectable player progression and optional exit tests passed");
