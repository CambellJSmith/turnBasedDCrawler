import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChestSystem, create_treasure_chest } from "../src/systems/chest_system.js";
import "../src/systems/chest_privacy_patch.js";

const logs = [];
const random = {
  chance: () => false,
  integer: (minimum) => minimum,
  pick: (values) => values[0]
};
const game = {
  entities: [],
  dungeon: { random },
  add_log: (message) => logs.push(message)
};
const system = new ChestSystem(game);
const chest = create_treasure_chest(random, 4, 5, 5);
const monster = {
  entity_id: "monster_hidden_carrier",
  type: "monster",
  name: "silent thief",
  alive: true,
  grid_x: 4,
  grid_y: 5,
  carried_chest_id: null
};
game.entities.push(chest, monster);

assert.equal(system.pick_up_chest(monster, chest), true);
assert.equal(logs.length, 0, "picking up a chest must not create a player-visible message");
assert.equal(chest.alive, false, "a carried chest must disappear from the ground");

monster.grid_x = 7;
monster.grid_y = 6;
assert.equal(system.drop_carried_chest(monster), chest);
assert.equal(logs.length, 0, "dropping a carried chest must not reveal the hidden carrier state");
assert.equal(chest.alive, true);
assert.deepEqual([chest.grid_x, chest.grid_y], [7, 6]);

const renderer_source = readFileSync(new URL("../src/render/chest_render_patch.js", import.meta.url), "utf8");
assert.doesNotMatch(renderer_source, /entity\.type === "monster".*carried_chest_id/s, "monsters must not render a carried-chest marker");

const main_source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
assert.doesNotMatch(main_source, /stolen by monsters|fallen carriers|monster holds|monster carries/i);

console.log("monster chest carrying remains hidden from player feedback");
