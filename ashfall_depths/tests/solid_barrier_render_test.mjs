import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dungeon_object_definitions } from "../src/data/dungeon_objects.js";
import { create_dungeon_object, DungeonObjectSystem } from "../src/systems/dungeon_object_system.js";
import { EnemyAiSystem } from "../src/systems/enemy_ai_system.js";
import { InteractionSystem } from "../src/systems/interaction_system.js";
import { MovementSystem } from "../src/systems/movement_system.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";
import "../src/systems/environment_movement_patch.js";
import "../src/systems/shared_tile_gameplay_patch.js";
import "../src/systems/solid_barrier_gameplay_patch.js";

assert.equal(dungeon_object_definitions.locked_door.blocks_movement, true);
assert.equal(dungeon_object_definitions.secret_wall.name, "cracked wall");

const grid = create_grid(8, 6);
const player = create_actor("player", "hero", 2, 2);
const door = create_dungeon_object(dungeon_object_definitions.locked_door, 3, 2, 8);
const game = create_game(grid, player, [player, door]);
game.dungeon_object_system = new DungeonObjectSystem(game);
game.movement_system = new MovementSystem(game);
game.interaction_system = new InteractionSystem(game);

assert.equal(
  game.movement_system.try_move(player, { x: 1, y: 0 }, 0),
  false,
  "the player must not stand on a closed locked door"
);
assert.deepEqual([player.grid_x, player.grid_y], [2, 2]);
assert.match(game.interaction_system.get_prompt(), /force open the locked door/);
assert.deepEqual(
  game.interaction_system.interact(),
  { consumes_turn: true, skip_non_player_turns: false },
  "locked doors must be opened from an adjacent tile"
);
assert.equal(door.open, true);
assert.equal(door.blocks_movement, false);
assert.equal(game.movement_system.try_move(player, { x: 1, y: 0 }, 100), true);
finish_move(player);
assert.deepEqual([player.grid_x, player.grid_y], [3, 2]);

const ai_grid = create_grid(7, 5);
const ai_monster = create_actor("monster", "door avoiding monster", 1, 2);
const ai_player = create_actor("player", "target", 4, 2);
const ai_door = create_dungeon_object(dungeon_object_definitions.locked_door, 2, 2, 8);
const ai_game = create_game(ai_grid, ai_player, [ai_player, ai_monster, ai_door]);
ai_game.dungeon_object_system = new DungeonObjectSystem(ai_game);
ai_game.movement_system = new MovementSystem(ai_game);
const enemy_ai = new EnemyAiSystem(ai_game);

assert.equal(enemy_ai.move_toward(ai_monster, ai_player, 200), true);
assert.notDeepEqual(
  [ai_monster.grid_x, ai_monster.grid_y],
  [2, 2],
  "monster pathfinding must not enter a closed locked door"
);

const project_root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const render_source = readFileSync(resolve(project_root, "src/render/dungeon_object_render_patch.js"), "utf8");
const depth_source = readFileSync(resolve(project_root, "src/render/shared_tile_render_patch.js"), "utf8");
assert.match(render_source, /renderer\.draw_wall\(x, y\)/, "cracked walls must reuse the normal wall renderer");
assert.match(render_source, /draw_secret_wall/);
assert.doesNotMatch(render_source, /fillRect\(-24, -48, 48, 51\)/, "cracked walls must not use a separate wall block");
assert.match(depth_source, /closed_barrier/, "closed doors and cracked walls should sort like walls");

console.log("solid locked doors and normal-wall crack rendering passed");

function create_game(grid, player, entities) {
  const logs = [];
  return {
    state: {
      floor: 8,
      gold: 0,
      player_upgrade_ranks: { lava_resistance: 0 },
      inventory: { add_item: () => {} }
    },
    dungeon: {
      grid,
      start: { x: player.grid_x, y: player.grid_y },
      exit: { x: grid.width - 2, y: grid.height - 2 },
      rooms: [],
      random: {
        next: () => 0.5,
        chance: () => false,
        integer: (minimum) => minimum,
        pick: (values) => values[0]
      }
    },
    player,
    entities,
    add_log: (message) => logs.push(message),
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
    combat_system: {
      apply_damage(target, amount) {
        target.health = Math.max(0, target.health - amount);
        if (target.health <= 0) {
          target.alive = false;
        }
      },
      companion_attack: () => false,
      monster_attack: () => false
    },
    get_living_monsters() {
      return this.entities.filter((entity) => entity.alive && entity.type === "monster");
    },
    get_living_companions() {
      return this.entities.filter((entity) => entity.alive && entity.type === "companion");
    }
  };
}

function create_actor(type, name, grid_x, grid_y) {
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
    health: 40,
    maximum_health: 40,
    magic: 0,
    maximum_magic: 0,
    attack: 5,
    defence: 0
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
