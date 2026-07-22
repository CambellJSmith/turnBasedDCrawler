import { Game } from "../core/game.js";
import { apply_lava_patches } from "./lava_generation.js";

const original_generate_floor = Game.prototype.generate_floor;

Game.prototype.generate_floor = function generate_floor_with_lava() {
  const result = original_generate_floor.call(this);
  const protected_positions = this.entities
    .filter((entity) => entity.alive)
    .map((entity) => ({ x: entity.grid_x, y: entity.grid_y }));

  apply_lava_patches(this.dungeon, this.floor_progression, protected_positions);
  return result;
};
