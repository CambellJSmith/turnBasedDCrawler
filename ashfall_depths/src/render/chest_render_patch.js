import { CanvasRenderer } from "./canvas_renderer.js";

const original_build_drawables = CanvasRenderer.prototype.build_depth_sorted_drawables;
CanvasRenderer.prototype.build_depth_sorted_drawables = function build_drawables_without_carried_chests() {
  return original_build_drawables.call(this).filter((drawable) =>
    !(drawable.entity?.type === "chest" && drawable.entity.carried_by_entity_id)
  );
};

const original_draw_actor = CanvasRenderer.prototype.draw_actor;
CanvasRenderer.prototype.draw_actor = function draw_actor_with_chests(entity, screen, now) {
  if (entity.type === "chest") {
    draw_chest(this.context, screen.x, screen.y, 1);
    return;
  }

  original_draw_actor.call(this, entity, screen, now);
  if (entity.type === "monster" && entity.carried_chest_id) {
    draw_chest(this.context, screen.x, screen.y - 42, 0.56);
  }
};

function draw_chest(context, x, y, scale) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  context.beginPath();
  context.ellipse(0, 9, 19, 6, 0, 0, Math.PI * 2);
  context.fillStyle = "#00000066";
  context.fill();

  context.fillStyle = "#6f3f20";
  context.fillRect(-17, -11, 34, 22);
  context.strokeStyle = "#2a170d";
  context.lineWidth = 2;
  context.strokeRect(-17, -11, 34, 22);

  context.beginPath();
  context.moveTo(-17, -11);
  context.quadraticCurveTo(0, -27, 17, -11);
  context.lineTo(17, -4);
  context.quadraticCurveTo(0, -18, -17, -4);
  context.closePath();
  context.fillStyle = "#8b542b";
  context.fill();
  context.strokeStyle = "#2a170d";
  context.stroke();

  context.fillStyle = "#d2a84f";
  context.fillRect(-3, -8, 6, 14);
  context.fillRect(-18, -3, 36, 4);
  context.strokeStyle = "#f4d781";
  context.strokeRect(-3, -8, 6, 14);

  context.restore();
}
