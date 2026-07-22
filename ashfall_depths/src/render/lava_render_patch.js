import { game_config } from "../config/game_config.js";
import { grid_to_screen } from "../world/isometric.js";
import { CanvasRenderer } from "./canvas_renderer.js";

const original_draw_floor_tiles = CanvasRenderer.prototype.draw_floor_tiles;

CanvasRenderer.prototype.draw_floor_tiles = function draw_floor_tiles_with_lava(camera) {
  original_draw_floor_tiles.call(this, camera);

  const context = this.context;
  const pulse = 0.5 + Math.sin((this.game.last_frame_time ?? 0) / 260) * 0.5;
  const half_width = game_config.tile_width / 2;
  const half_height = game_config.tile_height / 2;

  context.save();
  for (let y = 0; y < this.game.dungeon.grid.height; y += 1) {
    for (let x = 0; x < this.game.dungeon.grid.width; x += 1) {
      if (this.game.dungeon.grid.get_tile(x, y)?.terrain_id !== "lava_floor") {
        continue;
      }

      const screen = grid_to_screen(x, y, camera);
      if (!this.is_visible_on_canvas(screen.x, screen.y)) {
        continue;
      }

      context.beginPath();
      context.moveTo(screen.x, screen.y - half_height * 0.58);
      context.lineTo(screen.x + half_width * 0.58, screen.y);
      context.lineTo(screen.x, screen.y + half_height * 0.58);
      context.lineTo(screen.x - half_width * 0.58, screen.y);
      context.closePath();
      context.fillStyle = `rgba(255, ${145 + Math.round(pulse * 55)}, 46, ${0.32 + pulse * 0.2})`;
      context.fill();

      context.beginPath();
      context.moveTo(screen.x - 15, screen.y + 2);
      context.quadraticCurveTo(screen.x - 5, screen.y - 7 - pulse * 3, screen.x + 4, screen.y - 1);
      context.quadraticCurveTo(screen.x + 12, screen.y + 5 + pulse * 2, screen.x + 18, screen.y - 3);
      context.strokeStyle = `rgba(255, 220, 118, ${0.55 + pulse * 0.3})`;
      context.lineWidth = 2;
      context.stroke();
    }
  }
  context.restore();
};
