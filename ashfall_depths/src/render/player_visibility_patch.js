import { game_config } from "../config/game_config.js";
import { grid_to_screen } from "../world/isometric.js";
import { CanvasRenderer } from "./canvas_renderer.js";

const player_half_width = 18;
const player_top_offset = 40;
const player_bottom_offset = 12;
const obscuring_wall_opacity = 0.38;

export function wall_occludes_player(wall_screen, player_screen, wall_depth, player_depth) {
  if (wall_depth <= player_depth) {
    return false;
  }

  const wall_half_width = game_config.tile_width / 2;
  const wall_half_height = game_config.tile_height / 2;
  const horizontal_overlap =
    wall_screen.x - wall_half_width < player_screen.x + player_half_width &&
    wall_screen.x + wall_half_width > player_screen.x - player_half_width;
  const wall_top = wall_screen.y - game_config.wall_height - wall_half_height;
  const wall_bottom = wall_screen.y + wall_half_height;
  const player_top = player_screen.y - player_top_offset;
  const player_bottom = player_screen.y + player_bottom_offset;
  const vertical_overlap = wall_top < player_bottom && wall_bottom > player_top;

  return horizontal_overlap && vertical_overlap;
}

CanvasRenderer.prototype.draw_depth_sorted_world = function draw_depth_sorted_world(camera, now) {
  const player_screen = grid_to_screen(this.game.player.display_x, this.game.player.display_y, camera);
  const player_depth = this.game.player.display_x + this.game.player.display_y;

  for (const drawable of this.build_depth_sorted_drawables()) {
    const screen = grid_to_screen(drawable.display_x, drawable.display_y, camera);
    if (!this.is_visible_on_canvas(screen.x, screen.y)) {
      continue;
    }

    if (drawable.kind === "wall") {
      const obscures_player = wall_occludes_player(screen, player_screen, drawable.depth, player_depth);
      this.context.save();
      this.context.globalAlpha *= obscures_player ? obscuring_wall_opacity : 1;
      this.draw_wall(screen.x, screen.y);
      this.context.restore();
    } else if (drawable.kind === "door") {
      this.draw_door(screen.x, screen.y);
    } else if (drawable.entity.type === "ground_item") {
      this.draw_ground_item(drawable.entity, screen);
    } else {
      this.draw_actor(drawable.entity, screen, now);
    }
  }
};
