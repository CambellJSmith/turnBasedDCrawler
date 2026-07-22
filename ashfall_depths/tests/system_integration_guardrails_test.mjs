import assert from "node:assert/strict";
import { DungeonObjectSystem, dungeon_remains_connected_with_objects } from "../src/systems/dungeon_object_system.js";
import "../src/systems/dungeon_object_connectivity_patch.js";
import { TurnSystem } from "../src/systems/turn_system.js";
import "../src/systems/level_up_turn_patch.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";

const two_route_dungeon = create_two_route_dungeon();
const game = {
  dungeon: two_route_dungeon,
  entities: [
    {
      entity_id: "chest_upper_route",
      type: "chest",
      alive: true,
      carried_by_entity_id: null,
      grid_x: 4,
      grid_y: 2
    }
  ]
};
const object_system = new DungeonObjectSystem(game);
const existing_blockers = object_system.get_static_blockers();
assert.deepEqual(existing_blockers, [{ x: 4, y: 2 }], "ground chests must participate in object solvability checks");
assert.equal(
  dungeon_remains_connected_with_objects(two_route_dungeon, [...existing_blockers, { x: 4, y: 4 }]),
  false,
  "an object must not block the final alternate route after a chest blocks the first"
);
assert.equal(
  dungeon_remains_connected_with_objects(two_route_dungeon, [...existing_blockers, { x: 2, y: 2 }]),
  true,
  "non-critical room objects should remain valid"
);

let companion_actions = 0;
let monster_actions = 0;
const turn_game = {
  state: { pending_level_choices: 1 },
  player: { alive: true },
  entities: [],
  get_living_companions: () => [{ alive: true }],
  get_living_monsters: () => [{ alive: true }],
  companion_ai_system: { take_turn: () => { companion_actions += 1; } },
  enemy_ai_system: { take_turn: () => { monster_actions += 1; } }
};
const turn_system = new TurnSystem(turn_game);
turn_system.resolve_companion_phase(0);
turn_system.resolve_monster_phase(0);
assert.equal(companion_actions, 0);
assert.equal(monster_actions, 0);
assert.equal(turn_system.phase, "level_up");

turn_game.state.pending_level_choices = 0;
turn_system.resolve_companion_phase(0);
turn_system.resolve_monster_phase(0);
assert.equal(companion_actions, 1);
assert.equal(monster_actions, 1);

console.log("cross-system level-up pause and blocker solvability guardrails passed");

function create_two_route_dungeon() {
  const width = 9;
  const height = 7;
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain_id: "wall", ground_item_ids: [], explored: true }))
  );

  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
    }
    for (let x = 5; x <= 7; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
    }
  }
  for (const y of [2, 4]) {
    tiles[y][4].terrain_id = "stone_floor";
  }
  tiles[3][8].terrain_id = "exit";

  return {
    grid: new DungeonGrid(width, height, tiles),
    start: { x: 2, y: 3 },
    exit: { x: 8, y: 3 }
  };
}
