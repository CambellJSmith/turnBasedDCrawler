import { game_config } from "../config/game_config.js";
import { terrain_database } from "../data/terrain.js";
import { grid_to_screen } from "../world/isometric.js";
import { CanvasRenderer } from "./canvas_renderer.js";

CanvasRenderer.prototype.draw_floor_tiles = function draw_explored_floor_tiles(camera) {
  const grid = this.game.dungeon.grid;
  const draw_order = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (grid.get_tile(x, y)?.explored) {
        draw_order.push({ x, y, depth: x + y });
      }
    }
  }
  draw_order.sort((a, b) => a.depth - b.depth || a.x - b.x);

  for (const position of draw_order) {
    const tile = grid.get_tile(position.x, position.y);
    if (tile.terrain_id === "wall") {
      continue;
    }
    const screen = grid_to_screen(position.x, position.y, camera);
    if (!this.is_visible_on_canvas(screen.x, screen.y)) {
      continue;
    }

    this.context.save();
    this.context.globalAlpha = tile.visible ? 1 : 0.43;
    this.draw_floor(
      screen.x,
      screen.y,
      terrain_database[tile.terrain_id]?.floor_color ?? "#252a35",
      tile.terrain_id === "exit"
    );
    if (tile.terrain_id === "lava_floor") {
      draw_lava_surface(this.context, screen.x, screen.y, this.game.last_frame_time ?? 0, tile.visible);
    }
    if (this.game.state.settings.show_grid_coordinates && tile.visible) {
      this.context.fillStyle = "#ffffff66";
      this.context.font = "9px monospace";
      this.context.textAlign = "center";
      this.context.fillText(`${position.x},${position.y}`, screen.x, screen.y + 4);
    }
    this.context.restore();
  }
};

const original_build_drawables = CanvasRenderer.prototype.build_depth_sorted_drawables;
CanvasRenderer.prototype.build_depth_sorted_drawables = function build_explored_drawables() {
  return original_build_drawables.call(this).filter((drawable) => {
    const x = Math.round(drawable.display_x);
    const y = Math.round(drawable.display_y);
    const tile = this.game.dungeon.grid.get_tile(x, y);
    if (!tile) {
      return false;
    }
    if (drawable.kind === "wall" || drawable.kind === "door") {
      return tile.explored;
    }
    if (drawable.entity?.type === "player") {
      return true;
    }
    return tile.visible;
  });
};

function draw_lava_surface(context, x, y, now, visible) {
  const pulse = 0.5 + Math.sin(now / 260) * 0.5;
  const half_width = game_config.tile_width / 2;
  const half_height = game_config.tile_height / 2;
  context.beginPath();
  context.moveTo(x, y - half_height * 0.58);
  context.lineTo(x + half_width * 0.58, y);
  context.lineTo(x, y + half_height * 0.58);
  context.lineTo(x - half_width * 0.58, y);
  context.closePath();
  context.fillStyle = visible
    ? `rgba(255, ${145 + Math.round(pulse * 55)}, 46, ${0.32 + pulse * 0.2})`
    : "rgba(111, 43, 20, 0.45)";
  context.fill();
  if (!visible) {
    return;
  }
  context.beginPath();
  context.moveTo(x - 15, y + 2);
  context.quadraticCurveTo(x - 5, y - 7 - pulse * 3, x + 4, y - 1);
  context.quadraticCurveTo(x + 12, y + 5 + pulse * 2, x + 18, y - 3);
  context.strokeStyle = `rgba(255, 220, 118, ${0.55 + pulse * 0.3})`;
  context.lineWidth = 2;
  context.stroke();
}
