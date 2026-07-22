import assert from "node:assert/strict";
import { calculate_monster_experience, experience_required_for_level } from "../src/config/player_progression.js";
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

const logs = [];
const game = {
  state: { player_level: 1, player_experience: 0 },
  player: {
    maximum_health: 85,
    maximum_magic: 45,
    health: 60,
    magic: 20,
    grid_x: 2,
    grid_y: 3
  },
  add_log: (message) => logs.push(message),
  add_effect: () => {}
};
const progression = new PlayerProgressionSystem(game);
progression.apply_to_player(game.player, { health: 60, magic: 20 });
const weak_reward = calculate_monster_experience(weak_monster);
game.state.player_experience = experience_required_for_level(1) - weak_reward;
const result = progression.award_for_monster(weak_monster);
assert.equal(result.levels_gained, 1);
assert.equal(game.state.player_level, 2);
assert.equal(game.player.maximum_health, 93);
assert.equal(game.player.maximum_magic, 49);
assert.equal(game.player.health, 68);
assert.equal(game.player.magic, 24);
assert.ok(logs.some((message) => message.includes("level 2")));

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

console.log("player progression and optional exit tests passed");
