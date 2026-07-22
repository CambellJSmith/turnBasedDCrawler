import { Game } from "../core/game.js";
import { InteractionSystem } from "./interaction_system.js";
import { DungeonObjectSystem } from "./dungeon_object_system.js";

const original_generate_floor = Game.prototype.generate_floor;
Game.prototype.generate_floor = function generate_floor_with_dungeon_objects() {
  const result = original_generate_floor.call(this);
  this.dungeon_object_system = new DungeonObjectSystem(this);
  this.dungeon_object_system.spawn_floor_objects();
  return result;
};

Game.prototype.is_tile_blocked = function is_tile_blocked_with_object_properties(x, y, ignored_entity_id = "") {
  return this.entities.some((entity) =>
    entity.alive &&
    entity.entity_id !== ignored_entity_id &&
    entity.type !== "ground_item" &&
    entity.blocks_movement !== false &&
    entity.grid_x === x &&
    entity.grid_y === y
  );
};

const original_interact = InteractionSystem.prototype.interact;
InteractionSystem.prototype.interact = function interact_with_dungeon_objects() {
  if (has_primary_interaction(this.game)) {
    return original_interact.call(this);
  }

  const object = this.game.dungeon_object_system?.get_adjacent_interactable();
  if (object && this.game.dungeon_object_system.interact(object)) {
    return { consumes_turn: true, skip_non_player_turns: false };
  }
  return original_interact.call(this);
};

const original_get_prompt = InteractionSystem.prototype.get_prompt;
InteractionSystem.prototype.get_prompt = function get_prompt_with_dungeon_objects() {
  const original_prompt = original_get_prompt.call(this);
  if (original_prompt) {
    return original_prompt;
  }
  const object = this.game.dungeon_object_system?.get_adjacent_interactable();
  return this.game.dungeon_object_system?.get_prompt(object) ?? "";
};

function has_primary_interaction(game) {
  const player = game.player;
  const ground_item_here = game.entities.some((entity) =>
    entity.alive &&
    entity.type === "ground_item" &&
    entity.grid_x === player.grid_x &&
    entity.grid_y === player.grid_y
  );
  if (ground_item_here || game.recruitment_system?.get_nearby_recruitable()) {
    return true;
  }

  if (game.dungeon.grid.get_tile(player.grid_x, player.grid_y)?.terrain_id === "exit") {
    return true;
  }

  return Boolean(game.chest_system?.get_adjacent_chest(player));
}
