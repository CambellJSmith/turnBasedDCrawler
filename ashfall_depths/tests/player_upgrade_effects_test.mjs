import assert from "node:assert/strict";
import { create_default_player_upgrade_ranks } from "../src/data/player_upgrades.js";
import { monster_database } from "../src/data/monsters.js";
import { CombatSystem } from "../src/systems/combat_system.js";
import { ChestSystem } from "../src/systems/chest_system.js";
import { MagicSystem } from "../src/systems/magic_system.js";
import { MovementSystem } from "../src/systems/movement_system.js";
import "../src/systems/environment_movement_patch.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";

const ranks = create_default_player_upgrade_ranks();
ranks.stronger_spells = 1;
ranks.cheaper_spells = 2;
const player = {
  entity_id: "player_upgrade_test",
  type: "player",
  name: "hero",
  alive: true,
  moving: false,
  grid_x: 1,
  grid_y: 1,
  display_x: 1,
  display_y: 1,
  magic: 20,
  maximum_magic: 45,
  magic_power: 12,
  health: 80,
  maximum_health: 85,
  flash_until: 0
};
const target = {
  entity_id: "monster_spell_target",
  type: "monster",
  name: "target",
  alive: true,
  grid_x: 2,
  grid_y: 1,
  health: 100,
  maximum_health: 100,
  defence: 0
};
let spell_damage = 0;
const spell_game = {
  state: { player_upgrade_ranks: ranks },
  player,
  get_living_monsters: () => [target],
  combat_system: { apply_damage: (_target, damage) => { spell_damage = damage; } },
  add_effect: () => {},
  add_log: () => {}
};
const magic_system = new MagicSystem(spell_game);
assert.equal(magic_system.cast("fire_bolt", player, 0), true);
assert.equal(player.magic, 14, "two efficiency ranks should reduce fire bolt from 8 to 6 magic");
assert.equal(spell_damage, 28, "one arcane force rank should increase spell output by 12%");

const chest_ranks = create_default_player_upgrade_ranks();
chest_ranks.chest_rewards = 4;
const chest_game = {
  state: { floor: 10, player_upgrade_ranks: chest_ranks },
  dungeon: {
    random: {
      chance: () => false,
      pick: (values) => values[0]
    }
  },
  entities: []
};
const chest_system = new ChestSystem(chest_game);
const chest = { reward_gold: 100, reward_item_ids: ["mana_potion"] };
chest_system.apply_reward_upgrades(chest);
assert.equal(chest.reward_gold, 180);
assert.equal(chest.reward_item_ids.length, 2, "four treasure sense ranks guarantee one extra item");

const recruitment_ranks = create_default_player_upgrade_ranks();
recruitment_ranks.recruitment_chance = 3;
let observed_recruitment_chance = null;
const combat_game = {
  state: {
    gold: 0,
    defeated_monsters: 0,
    player_upgrade_ranks: recruitment_ranks
  },
  dungeon: {
    random: {
      integer: (minimum) => minimum,
      chance: (chance) => {
        observed_recruitment_chance = chance;
        return false;
      }
    }
  },
  player_progression_system: { award_for_monster: () => {} },
  loot_system: { roll_monster_drop: () => {} },
  add_log: () => {},
  add_effect: () => {}
};
const combat_system = new CombatSystem(combat_game);
const slime_data = monster_database.ember_slime;
combat_system.defeat_entity({
  entity_id: "monster_recruitment_test",
  type: "monster",
  monster_id: slime_data.id,
  name: slime_data.name,
  alive: true,
  health: 0,
  maximum_health: slime_data.maximum_health,
  maximum_magic: slime_data.maximum_magic,
  magic: 0,
  grid_x: 2,
  grid_y: 2
}, { type: "player" });
assert.equal(observed_recruitment_chance, 0.07);

const lava_ranks = create_default_player_upgrade_ranks();
lava_ranks.lava_resistance = 2;
const lava_tiles = [[
  { terrain_id: "stone_floor" },
  { terrain_id: "lava_floor" },
  { terrain_id: "stone_floor" }
]];
const lava_player = {
  entity_id: "player_lava_test",
  type: "player",
  name: "hero",
  alive: true,
  moving: false,
  grid_x: 0,
  grid_y: 0,
  display_x: 0,
  display_y: 0,
  health: 30,
  maximum_health: 30,
  flash_until: 0
};
const lava_game = {
  state: { player_upgrade_ranks: lava_ranks },
  player: lava_player,
  dungeon: { grid: new DungeonGrid(3, 1, lava_tiles) },
  entities: [lava_player],
  is_tile_blocked: () => false,
  spawn_combat_text: () => {},
  add_effect: () => {},
  add_log: () => {},
  handle_player_defeat: () => {}
};
const movement = new MovementSystem(lava_game);
assert.equal(movement.try_move(lava_player, { x: 1, y: 0 }, 0), true);
assert.equal(lava_player.grid_x, 1);
assert.equal(lava_player.health, 23, "two ashwalker ranks should reduce lava damage to 7");

console.log("spell, chest, recruitment, and lava upgrade effects passed");
