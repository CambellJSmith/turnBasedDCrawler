import assert from "node:assert/strict";
import { MovementSystem } from "../src/systems/movement_system.js";
import { wall_occludes_player } from "../src/render/player_visibility_patch.js";

function create_actor(entity_id, type, grid_x, grid_y) {
  return {
    entity_id,
    type,
    alive: true,
    moving: false,
    grid_x,
    grid_y,
    display_x: grid_x,
    display_y: grid_y,
    move_from_x: grid_x,
    move_from_y: grid_y,
    move_started_at: 0
  };
}

const player = create_actor("player_1", "player", 2, 2);
const companion = create_actor("companion_1", "companion", 3, 2);
const monster = create_actor("monster_1", "monster", 4, 2);
const ground_item = create_actor("ground_item_1", "ground_item", 2, 3);
const game = {
  entities: [player, companion, monster, ground_item],
  dungeon: {
    grid: {
      is_walkable: () => true
    }
  }
};
const movement = new MovementSystem(game);

assert.equal(movement.try_move(player, { x: 1, y: 0 }, 100), true, "player should swap with a companion");
assert.deepEqual([player.grid_x, player.grid_y], [3, 2], "player should occupy the companion's previous tile");
assert.deepEqual([companion.grid_x, companion.grid_y], [2, 2], "companion should occupy the player's previous tile");
assert.equal(player.moving, true, "player should animate the swap");
assert.equal(companion.moving, true, "companion should animate the swap");
assert.equal(player.move_started_at, companion.move_started_at, "both swap animations should start together");

movement.update_entity(player, 1000);
movement.update_entity(companion, 1000);
assert.equal(player.moving, false, "player swap animation should finish");
assert.equal(companion.moving, false, "companion swap animation should finish");
assert.deepEqual([player.display_x, player.display_y], [3, 2]);
assert.deepEqual([companion.display_x, companion.display_y], [2, 2]);

assert.equal(movement.try_move(player, { x: 1, y: 0 }, 1100), false, "monsters must remain solid blockers");
assert.equal(movement.try_move(companion, { x: 1, y: 0 }, 1100), false, "companions must not initiate swaps through the player or monsters");
assert.equal(movement.try_move(player, { x: -1, y: 1 }, 1100), true, "ground items must not block movement");

const player_screen = { x: 480, y: 358 };
assert.equal(
  wall_occludes_player({ x: 480, y: 374 }, player_screen, 11, 10),
  true,
  "a foreground wall overlapping the player should fade"
);
assert.equal(
  wall_occludes_player({ x: 480, y: 342 }, player_screen, 9, 10),
  false,
  "a wall behind the player should remain opaque"
);
assert.equal(
  wall_occludes_player({ x: 620, y: 374 }, player_screen, 11, 10),
  false,
  "a foreground wall that does not overlap the player should remain opaque"
);

console.log("player movement and visibility tests passed");
