import { room_type_database } from "../data/room_types.js";
import { terrain_database } from "../data/terrain.js";
import { HudController } from "./hud_controller.js";
import { MenuController } from "./menu_controller.js";

const original_hud_update = HudController.prototype.update;
HudController.prototype.update = function update_with_room_type() {
  original_hud_update.call(this);
  this.room_text ??= document.querySelector("#room_text");
  const room_type = get_current_room_type(this.game);
  const room_name = room_type?.name ?? "connecting passage";
  if (this.room_text) {
    this.room_text.textContent = room_name;
  }
  if (room_type && this.last_announced_room_type_id !== room_type.id) {
    if (this.last_announced_room_type_id !== undefined) {
      this.game.add_log(`entered ${room_type.name}`);
    }
    this.last_announced_room_type_id = room_type.id;
  }
};

MenuController.prototype.render_ground_tile = function render_ground_tile_with_room_type() {
  const x = this.game.player.grid_x;
  const y = this.game.player.grid_y;
  const tile = this.game.dungeon.grid.get_tile(x, y);
  const terrain = terrain_database[tile.terrain_id];
  const room_type = get_current_room_type(this.game);
  const room_name = room_type?.name ?? "connecting passage";
  const room_description = room_type?.description ?? "A corridor connecting the dungeon's generated chambers.";
  const entities = this.game.entities.filter((entity) =>
    entity.alive && entity.grid_x === x && entity.grid_y === y && entity.entity_id !== this.game.player.entity_id
  );
  return `<h2>ground tile</h2><table class="stat_table"><tbody>
    <tr><td>coordinates</td><td>${x}, ${y}</td></tr>
    <tr><td>room type</td><td>${room_name}</td></tr>
    <tr><td>room description</td><td>${room_description}</td></tr>
    <tr><td>terrain</td><td>${terrain.name}</td></tr>
    <tr><td>walkable</td><td>${terrain.walkable ? "yes" : "no"}</td></tr>
    <tr><td>contents</td><td>${entities.length ? entities.map((entity) => entity.name).join(", ") : "nothing"}</td></tr>
    <tr><td>floor exit</td><td>${tile.terrain_id === "exit" ? "present" : "none"}</td></tr>
  </tbody></table>`;
};

function get_current_room_type(game) {
  const tile = game.dungeon.grid.get_tile(game.player.grid_x, game.player.grid_y);
  return room_type_database[tile?.room_type_id] ?? null;
}
