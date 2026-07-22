import { game_config } from "../config/game_config.js";
import { CanvasRenderer } from "./canvas_renderer.js";

const original_draw_actor = CanvasRenderer.prototype.draw_actor;
CanvasRenderer.prototype.draw_actor = function draw_actor_or_dungeon_object(entity, screen, now) {
  if (entity.type !== "dungeon_object") {
    return original_draw_actor.call(this, entity, screen, now);
  }
  draw_dungeon_object(this, entity, screen.x, screen.y, now);
};

function draw_dungeon_object(renderer, object, x, y, now) {
  if (object.object_type === "spike_trap" && !object.revealed) {
    return;
  }
  if (object.object_type === "secret_wall") {
    draw_secret_wall(renderer, object, x, y);
    return;
  }

  const context = renderer.context;
  context.save();
  context.translate(x, y);

  switch (object.object_type) {
    case "pressure_plate": draw_pressure_plate(context, object); break;
    case "spike_trap": draw_spike_trap(context, object); break;
    case "explosive_barrel": draw_barrel(context); break;
    case "breakable_urn": draw_urn(context); break;
    case "healing_fountain": draw_fountain(context, object, now); break;
    case "lever": draw_lever(context, object); break;
    case "locked_door": draw_locked_door(context, object); break;
    default: break;
  }

  context.restore();
}

function draw_pressure_plate(context, object) {
  context.beginPath();
  context.ellipse(0, 1, 19, 8, 0, 0, Math.PI * 2);
  context.fillStyle = object.triggered ? "#4a3427" : "#6a645d";
  context.fill();
  context.strokeStyle = "#24211f";
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.arc(0, 0, 4, 0, Math.PI * 2);
  context.fillStyle = object.triggered ? "#8c472f" : "#a59b87";
  context.fill();
}

function draw_spike_trap(context, object) {
  context.strokeStyle = object.used ? "#625f5b" : "#c7c3b5";
  context.fillStyle = "#26272c";
  context.fillRect(-17, -3, 34, 8);
  for (let x = -14; x <= 14; x += 7) {
    context.beginPath();
    context.moveTo(x - 3, 0);
    context.lineTo(x, object.used ? -5 : -17);
    context.lineTo(x + 3, 0);
    context.closePath();
    context.fillStyle = object.used ? "#55565c" : "#b8bcc5";
    context.fill();
    context.stroke();
  }
}

function draw_barrel(context) {
  context.beginPath();
  context.ellipse(0, 7, 13, 6, 0, 0, Math.PI * 2);
  context.fillStyle = "#00000055";
  context.fill();
  context.fillStyle = "#793628";
  context.fillRect(-12, -22, 24, 28);
  context.strokeStyle = "#2b1715";
  context.lineWidth = 2;
  context.strokeRect(-12, -22, 24, 28);
  context.fillStyle = "#34363c";
  context.fillRect(-13, -16, 26, 4);
  context.fillRect(-13, -2, 26, 4);
  context.fillStyle = "#e6a23b";
  context.fillRect(-2, -25, 4, 7);
}

function draw_urn(context) {
  context.beginPath();
  context.ellipse(0, 7, 12, 5, 0, 0, Math.PI * 2);
  context.fillStyle = "#00000055";
  context.fill();
  context.beginPath();
  context.moveTo(-7, -22);
  context.quadraticCurveTo(-15, -5, -9, 5);
  context.quadraticCurveTo(0, 12, 9, 5);
  context.quadraticCurveTo(15, -5, 7, -22);
  context.closePath();
  context.fillStyle = "#7b6853";
  context.fill();
  context.strokeStyle = "#302920";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#a79275";
  context.fillRect(-8, -25, 16, 5);
}

function draw_fountain(context, object, now) {
  const pulse = 0.5 + Math.sin(now / 300) * 0.5;
  context.beginPath();
  context.ellipse(0, 7, 22, 9, 0, 0, Math.PI * 2);
  context.fillStyle = "#4b505b";
  context.fill();
  context.strokeStyle = "#252831";
  context.lineWidth = 3;
  context.stroke();
  context.beginPath();
  context.ellipse(0, 4, 15, 6, 0, 0, Math.PI * 2);
  context.fillStyle = object.used ? "#343a42" : `rgba(80, 177, 205, ${0.65 + pulse * 0.25})`;
  context.fill();
  context.fillStyle = "#555b66";
  context.fillRect(-4, -18, 8, 20);
  if (!object.used) {
    context.beginPath();
    context.arc(0, -19, 4 + pulse * 2, 0, Math.PI * 2);
    context.fillStyle = "#a8efff";
    context.fill();
  }
}

function draw_lever(context, object) {
  context.fillStyle = "#444851";
  context.fillRect(-10, -2, 20, 9);
  context.strokeStyle = "#1d2026";
  context.strokeRect(-10, -2, 20, 9);
  context.save();
  context.rotate(object.used ? 0.65 : -0.55);
  context.fillStyle = "#868c95";
  context.fillRect(-2, -25, 4, 27);
  context.beginPath();
  context.arc(0, -25, 5, 0, Math.PI * 2);
  context.fillStyle = object.used ? "#8d4a39" : "#b4a059";
  context.fill();
  context.restore();
}

function draw_locked_door(context, object) {
  if (object.open) {
    context.strokeStyle = "#685647";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-18, 3);
    context.lineTo(-18, -34);
    context.moveTo(18, 3);
    context.lineTo(18, -34);
    context.stroke();
    return;
  }
  context.fillStyle = "#343941";
  context.fillRect(-18, -37, 36, 42);
  context.strokeStyle = "#11151a";
  context.lineWidth = 3;
  context.strokeRect(-18, -37, 36, 42);
  context.fillStyle = "#777d84";
  for (let x = -12; x <= 12; x += 8) {
    context.fillRect(x, -36, 3, 39);
  }
  context.fillStyle = "#c19342";
  context.fillRect(-4, -18, 8, 9);
}

function draw_secret_wall(renderer, object, x, y) {
  const context = renderer.context;
  if (object.open) {
    context.save();
    context.translate(x, y);
    context.fillStyle = "#3f4148";
    context.fillRect(-18, 0, 12, 5);
    context.fillRect(5, -1, 14, 6);
    context.restore();
    return;
  }

  renderer.draw_wall(x, y);

  context.save();
  context.translate(x, y);
  context.lineCap = "round";
  context.lineJoin = "round";

  const top_y = -game_config.wall_height;
  context.beginPath();
  context.moveTo(-7, top_y - 7);
  context.lineTo(1, top_y - 1);
  context.lineTo(-3, top_y + 7);
  context.lineTo(5, top_y + 13);
  context.strokeStyle = "#10131a";
  context.lineWidth = 3;
  context.stroke();

  context.beginPath();
  context.moveTo(5, top_y + 13);
  context.lineTo(-2, top_y + 24);
  context.lineTo(5, top_y + 33);
  context.lineTo(0, top_y + 43);
  context.strokeStyle = "#10131a";
  context.lineWidth = 3;
  context.stroke();

  context.beginPath();
  context.moveTo(-1, top_y + 24);
  context.lineTo(-11, top_y + 29);
  context.moveTo(4, top_y + 33);
  context.lineTo(13, top_y + 38);
  context.strokeStyle = "#4a5263";
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}
