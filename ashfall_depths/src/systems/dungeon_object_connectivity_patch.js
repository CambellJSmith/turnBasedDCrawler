import { DungeonObjectSystem } from "./dungeon_object_system.js";

const directly_openable_types = new Set(["locked_door", "secret_wall"]);

DungeonObjectSystem.prototype.get_static_blockers = function get_combined_static_blockers() {
  return this.game.entities
    .filter((entity) => {
      if (!entity.alive) {
        return false;
      }
      if (entity.type === "chest") {
        return !entity.carried_by_entity_id;
      }
      if (entity.type !== "dungeon_object") {
        return false;
      }
      return entity.blocks_movement && !entity.open && !directly_openable_types.has(entity.object_type);
    })
    .map((entity) => ({ x: entity.grid_x, y: entity.grid_y }));
};
