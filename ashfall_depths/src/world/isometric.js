import { game_config } from "../config/game_config.js";

export function grid_to_screen(grid_x, grid_y, camera) {
  return {
    x: (grid_x - grid_y) * (game_config.tile_width / 2) + camera.offset_x,
    y: (grid_x + grid_y) * (game_config.tile_height / 2) + camera.offset_y
  };
}

export function calculate_camera(entity) {
  const projected_x = (entity.display_x - entity.display_y) * (game_config.tile_width / 2);
  const projected_y = (entity.display_x + entity.display_y) * (game_config.tile_height / 2);
  return {
    offset_x: game_config.canvas_width / 2 - projected_x,
    offset_y: game_config.canvas_height / 2 - projected_y + 58
  };
}
