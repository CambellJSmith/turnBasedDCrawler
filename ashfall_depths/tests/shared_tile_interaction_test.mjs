import assert from "node:assert/strict";
import { Game } from "../src/core/game.js";
import { dungeon_object_definitions } from "../src/data/dungeon_objects.js";
import { create_treasure_chest, ChestSystem } from "../src/systems/chest_system.js";
import { create_dungeon_object, DungeonObjectSystem } from "../src/systems/dungeon_object_system.js";
import { EnemyAiSystem } from "../src/systems/enemy_ai_system.js";
import { InteractionSystem } from "../src/systems/interaction_system.js";
import { MovementSystem } from "../src/systems/movement_system.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";
import "../src/systems/environment_movement_patch.js";
import "../src/systems/shared_tile_gameplay_patch.js";

const logs = [];
const inventory = [];
const grid = create_grid(8, 6);
grid.tiles[2][3].terrain_id = "lava_floor";
grid.tiles[3][3].terrain_id = "wall";

const player = create_actor("player", "hero", 1, 2, 40);
const monster = create_actor("monster", "blocking monster", 4, 2, 35);
const barrel = create_dungeon_object(dungeon_object_definitions.explosive_barrel, 2, 2, 8);
const game = create_game(grid, player, [player, monster, barrel], logs, inventory);
const object_system = new DungeonObjectSystem(game);
game.dungeon_object_system = object_system;
const chest_system = new ChestSystem(game);
game.chest_system = chest_system;
const movement = new MovementSystem(game);
game.movement_system = movement;

assert.equal(barrel.blocks_movement, false, "ordinary dungeon objects must be shareable floor tiles");
assert.equal(movement.try_move(player, { x: 1, y: 0 }, 0), true, "the player should step onto a barrel");
finish_move(player);
assert.deepEqual([player.grid_x, player.grid_y], [2, 2]);
assert.equal(barrel.alive, true);

assert.equal(movement.try_move(player, { x: 1, y: 0 }, 100), true, "lava should be traversable");
finish_move(player);
assert.deepEqual([player.grid_x, player.grid_y], [3, 2]);
assert.equal(player.health, 29, "lava remains hazardous without Ashwalker ranks");
assert.equal(movement.try_move(player, { x: 1, y: 0 }, 200), false, "actors must still block each other");
assert.equal(movement.try_move(player, { x: 0, y: 1 }, 200), false, "walls must remain impassable");

const secret_wall = create_dungeon_object(dungeon_object_definitions.secret_wall, 3, 1, 8);
game.entities.push(secret_wall);
assert.equal(movement.try_move(player, { x: 0, y: -1 }, 300), true, "bumping a secret wall should reveal it");
assert.deepEqual([player.grid_x, player.grid_y], [3, 2], "a secret wall remains a wall until opened");
assert.equal(secret_wall.revealed, true);

const chest = create_treasure_chest(game.dungeon.random, 8, player.grid_x, player.grid_y);
chest.reward_gold = 17;
chest.reward_item_ids = ["healing_potion"];
game.entities.push(chest);
const interaction = new InteractionSystem(game);
game.interaction_system = interaction;
assert.match(interaction.get_prompt(), /open treasure chest/);
assert.deepEqual(interaction.interact(), { consumes_turn: true, skip_non_player_turns: false });
assert.equal(chest.alive, false);
assert.equal(game.state.gold, 17);
assert.deepEqual(inventory, ["healing_potion"]);

const lever = create_dungeon_object(dungeon_object_definitions.lever, player.grid_x, player.grid_y, 8);
game.entities.push(lever);
assert.match(interaction.get_prompt(), /pull the lever/);
assert.deepEqual(interaction.interact(), { consumes_turn: true, skip_non_player_turns: false });
assert.equal(lever.used, true, "the object underneath the player should receive interaction");

secret_wall.open = true;
secret_wall.blocks_movement = false;
secret_wall.blocks_vision = false;
const adjacent_urn = create_dungeon_object(dungeon_object_definitions.breakable_urn, player.grid_x - 1, player.grid_y, 8);
game.entities.push(adjacent_urn);
assert.equal(interaction.get_prompt(), "", "ordinary adjacent objects should not show an interaction prompt");
assert.deepEqual(interaction.interact(), { consumes_turn: false });
assert.equal(adjacent_urn.alive, true, "ordinary objects must require standing on their tile");

const locked_door = create_dungeon_object(dungeon_object_definitions.locked_door, 2, 4, 8);
game.entities.push(locked_door);
player.grid_x = 1;
player.grid_y = 4;
player.display_x = 1;
player.display_y = 4;
assert.equal(movement.try_move(player, { x: 1, y: 0 }, 400), true, "a locked door is an interactable floor object");
finish_move(player);
assert.match(interaction.get_prompt(), /force open the locked door/);
assert.deepEqual(interaction.interact(), { consumes_turn: true, skip_non_player_turns: false });
assert.equal(locked_door.open, true);

const ai_grid = create_grid(6, 4);
ai_grid.tiles[1][2].terrain_id = "lava_floor";
const ai_monster = create_actor("monster", "lava walker", 1, 1, 30);
const ai_player = create_actor("player", "target", 3, 1, 40);
const ai_barrel = create_dungeon_object(dungeon_object_definitions.explosive_barrel, 2, 1, 8);
const ai_game = create_game(ai_grid, ai_player, [ai_player, ai_monster, ai_barrel], [], []);
ai_game.dungeon_object_system = new DungeonObjectSystem(ai_game);
ai_game.chest_system = new ChestSystem(ai_game);
ai_game.movement_system = new MovementSystem(ai_game);
ai_game.monster_ability_system = { can_use_special: () => false };
ai_game.combat_system.monster_attack = () => false;
const enemy_ai = new EnemyAiSystem(ai_game);
ai_game.enemy_ai_system = enemy_ai;
assert.equal(enemy_ai.move_toward(ai_monster, ai_player, 500), true, "monster pathfinding should cross lava and object tiles");
assert.deepEqual([ai_monster.grid_x, ai_monster.grid_y], [2, 1]);
assert.equal(ai_monster.health, 19, "monsters should take lava damage while crossing");

console.log("shared object tiles, underfoot interaction, actor collision, and lava traversal passed");

function create_game(grid, player_entity, entities, log_entries, inventory_entries) {
  const random = {
    next: () => 0.25,
    chance: () => false,
    integer: (minimum) => minimum,
    pick: (values) => values[0]
  };
  const game = {
    state: {
      floor: 8,
      gold: 0,
      player_upgrade_ranks: { lava_resistance: 0 },
      inventory: { add_item: (item_id) => inventory_entries.push(item_id) }
    },
    dungeon: {
      grid,
      start: { x: player_entity.grid_x, y: player_entity.grid_y },
      exit: { x: grid.width - 2, y: grid.height - 2 },
      rooms: [],
      random
    },
    player: player_entity,
    entities,
    add_log: (message) => log_entries.push(message),
    add_effect: () => {},
    spawn_combat_text: () => {},
    handle_player_defeat: () => {},
    exploration_system: { update_visibility: () => {} },
    loot_system: { collect_items_at_player: () => false },
    recruitment_system: { get_nearby_recruitable: () => null },
    dialogue_controller: { show_sequence: () => {} },
    turn_system: { commit_player_action: () => {} },
    save_manager: { save: () => {} },
    advance_floor: () => {},
    get_living_monsters() {
      return this.entities.filter((entity) => entity.alive && entity.type === "monster");
    }
  };
  game.is_tile_blocked = Game.prototype.is_tile_blocked.bind(game);
  game.can_actor_traverse = Game.prototype.can_actor_traverse.bind(game);
  game.combat_system = {
    apply_damage(target, amount) {
      target.health = Math.max(0, target.health - amount);
      target.flash_until = 0;
      if (target.health <= 0) {
        target.alive = false;
      }
    },
    companion_attack: () => false,
    monster_attack: () => false
  };
  return game;
}

function create_actor(type, name, grid_x, grid_y, health) {
  return {
    entity_id: `${type}_${name.replaceAll(" ", "_")}`,
    type,
    name,
    alive: true,
    moving: false,
    grid_x,
    grid_y,
    display_x: grid_x,
    display_y: grid_y,
    move_from_x: grid_x,
    move_from_y: grid_y,
    move_started_at: 0,
    health,
    maximum_health: health,
    magic: 0,
    maximum_magic: 0,
    attack: 5,
    defence: 0,
    flash_until: 0
  };
}

function finish_move(actor) {
  actor.moving = false;
  actor.display_x = actor.grid_x;
  actor.display_y = actor.grid_y;
}

function create_grid(width, height) {
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      terrain_id: x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "wall" : "stone_floor",
      ground_item_ids: [],
      explored: true,
      visible: true,
      room_index: 0,
      room_type_id: "entry_hall"
    }))
  );
  return new DungeonGrid(width, height, tiles);
}
