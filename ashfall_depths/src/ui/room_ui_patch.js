import { room_type_database } from "../data/room_types.js";
import { terrain_database } from "../data/terrain.js";
import { HudController } from "./hud_controller.js";
import { MenuController } from "./menu_controller.js";

const original_hud_update = HudController.prototype.update;
HudController.prototype.update = function update_with_room_type() {
  original_hud_update.call(this);
  this.room_text ??= document.querySelector("#room_text");
  this.room_description_text ??= document.querySelector("#room_description_text");
  this.game_frame ??= document.querySelector("#game_frame");
  const room_type = get_current_room_type(this.game);
  const room_name = room_type?.name ?? "connecting passage";
  const room_description = room_type?.description ?? "A narrow route linking the dungeon's generated chambers.";

  if (this.room_text) {
    this.room_text.textContent = title_case(room_name);
  }
  if (this.room_description_text) {
    this.room_description_text.textContent = room_description;
  }
  if (this.game_frame) {
    this.game_frame.dataset.roomType = room_type?.id ?? "corridor";
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
  const traversable = !["wall", "void"].includes(tile.terrain_id);
  const entities = this.game.entities.filter((entity) =>
    entity.alive && entity.grid_x === x && entity.grid_y === y && entity.entity_id !== this.game.player.entity_id
  );
  return `<h2>Ground Tile</h2><table class="stat_table"><tbody>
    <tr><td>coordinates</td><td>${x}, ${y}</td></tr>
    <tr><td>room type</td><td>${room_name}</td></tr>
    <tr><td>room description</td><td>${room_description}</td></tr>
    <tr><td>terrain</td><td>${terrain.name}</td></tr>
    <tr><td>traversable</td><td>${traversable ? "yes" : "no"}</td></tr>
    <tr><td>contents</td><td>${entities.length ? entities.map((entity) => entity.name).join(", ") : "nothing"}</td></tr>
    <tr><td>floor exit</td><td>${tile.terrain_id === "exit" ? "present" : "none"}</td></tr>
  </tbody></table>`;
};

function get_current_room_type(game) {
  const tile = game.dungeon.grid.get_tile(game.player.grid_x, game.player.grid_y);
  return room_type_database[tile?.room_type_id] ?? null;
}

function title_case(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
