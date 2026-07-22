import assert from "node:assert/strict";
import { CombatSystem } from "../src/systems/combat_system.js";
import { PartyState } from "../src/state/party_state.js";

const party = new PartyState();
assert.equal(party.add_member("mira_ashwalker"), true);
assert.equal(party.add_monster_member({
  member_id: "reformed_ember_slime_7",
  monster_id: "ember_slime",
  name: "Ember Slime",
  archetype: "bruiser",
  ai_profile: "bruiser",
  maximum_health: 20,
  maximum_magic: 0,
  attack: 5,
  defence: 1,
  magic_power: 0,
  color: "#d66b42"
}), true);

const saved_snapshots = [];
const logs = [];
const game = {
  state: { party },
  save_manager: {
    save(current_game) {
      saved_snapshots.push(current_game.state.party.to_json());
    }
  },
  add_log(message) {
    logs.push(message);
  }
};
const combat = new CombatSystem(game);

const named_companion = {
  entity_id: "companion_1",
  type: "companion",
  character_id: "mira_ashwalker",
  name: "Mira Ashwalker",
  alive: true,
  health: 0
};
combat.defeat_entity(named_companion);

assert.equal(named_companion.alive, false);
assert.equal(named_companion.permanently_dead, true);
assert.deepEqual(party.member_ids, ["hero", "reformed_ember_slime_7"]);
assert.equal(saved_snapshots.length, 1, "companion death must save immediately");
assert.doesNotMatch(logs.at(-1), /for this floor/i);
assert.match(logs.at(-1), /permanently lost/i);

const monster_companion = {
  entity_id: "companion_2",
  type: "companion",
  character_id: "reformed_ember_slime_7",
  monster_id: "ember_slime",
  recruited_monster: true,
  name: "Ember Slime",
  alive: true,
  health: 0
};
combat.defeat_entity(monster_companion);

assert.equal(monster_companion.permanently_dead, true);
assert.deepEqual(party.member_ids, ["hero"]);
assert.equal(party.get_monster_member("reformed_ember_slime_7"), null, "dead recruited monsters must be removed from persistent metadata");
assert.equal(saved_snapshots.length, 2);
assert.deepEqual(saved_snapshots.at(-1).member_ids, ["hero"]);
assert.deepEqual(saved_snapshots.at(-1).monster_members, {});

assert.equal(party.remove_member("hero"), false, "the leader cannot be removed through companion-death handling");

const reloaded_party = new PartyState();
reloaded_party.load(saved_snapshots.at(-1));
assert.deepEqual(reloaded_party.member_ids, ["hero"], "dead companions must remain absent after loading the save");
assert.deepEqual(reloaded_party.monster_members, {});

console.log("named and recruited companion deaths are permanent and saved immediately");
