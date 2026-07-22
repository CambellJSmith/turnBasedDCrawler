import { CanvasRenderer } from "./canvas_renderer.js";

const original_build_depth_sorted_drawables = CanvasRenderer.prototype.build_depth_sorted_drawables;

CanvasRenderer.prototype.build_depth_sorted_drawables = function build_shared_tile_drawables() {
  const drawables = original_build_depth_sorted_drawables.call(this);
  for (const drawable of drawables) {
    if (drawable.kind !== "entity") {
      continue;
    }
    drawable.sort_priority = ["ground_item", "chest", "dungeon_object"].includes(drawable.entity.type) ? 0 : 1;
  }
  drawables.sort((a, b) =>
    a.depth - b.depth ||
    a.sort_x - b.sort_x ||
    a.sort_priority - b.sort_priority
  );
  return drawables;
};
