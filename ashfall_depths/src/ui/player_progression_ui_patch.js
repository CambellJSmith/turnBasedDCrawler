import { item_database } from "../data/items.js";
import { get_player_upgrade_rank, player_upgrade_definitions } from "../data/player_upgrades.js";
import { MenuController } from "./menu_controller.js";

MenuController.prototype.render_stats = function render_stats() {
  const player = this.game.player;
  const weapon = item_database[this.game.state.inventory.equipped_weapon_id];
  const accessory = item_database[this.game.state.inventory.equipped_accessory_id];
  const required_experience = this.game.player_progression_system?.get_experience_requirement() ?? 0;
  const upgrade_rows = player_upgrade_definitions
    .filter((definition) => get_player_upgrade_rank(this.game.state, definition.id) > 0)
    .map((definition) => `<tr><td>${definition.name}</td><td>rank ${get_player_upgrade_rank(this.game.state, definition.id)}</td></tr>`)
    .join("");

  return `<h2>stats</h2><table class="stat_table"><tbody>
    <tr><td>name</td><td>${player.name}</td></tr>
    <tr><td>level</td><td>${this.game.state.player_level}</td></tr>
    <tr><td>experience</td><td>${this.game.state.player_experience} / ${required_experience}</td></tr>
    <tr><td>unspent upgrades</td><td>${this.game.state.pending_level_choices}</td></tr>
    <tr><td>health</td><td>${player.health} / ${player.maximum_health}</td></tr>
    <tr><td>magic</td><td>${player.magic} / ${player.maximum_magic}</td></tr>
    <tr><td>attack</td><td>${player.attack + (weapon?.attack_bonus ?? 0)}</td></tr>
    <tr><td>defence</td><td>${player.defence + (accessory?.defence_bonus ?? 0)}</td></tr>
    <tr><td>magic power</td><td>${player.magic_power + (weapon?.magic_bonus ?? 0)}</td></tr>
    <tr><td>turns taken</td><td>${this.game.state.turn_count}</td></tr>
    <tr><td>defeated monsters</td><td>${this.game.state.defeated_monsters}</td></tr>
    <tr><td>current seed</td><td>${this.game.dungeon.seed}</td></tr>
  </tbody></table>
  <h2>permanent upgrades</h2><table class="stat_table"><tbody>
    ${upgrade_rows || "<tr><td>none chosen yet</td><td>—</td></tr>"}
  </tbody></table>`;
};
