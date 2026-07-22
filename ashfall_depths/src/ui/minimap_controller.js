export class MinimapController {
  constructor(game) {
    this.game = game;
    this.canvas = document.querySelector("#minimap_canvas");
    this.context = this.canvas?.getContext("2d") ?? null;
  }

  render() {
    if (!this.canvas || !this.context || !this.game.dungeon?.grid) {
      return;
    }
    const context = this.context;
    const grid = this.game.dungeon.grid;
    const padding = 8;
    const scale = Math.max(2, Math.min(
      (this.canvas.width - padding * 2) / grid.width,
      (this.canvas.height - padding * 2) / grid.height
    ));
    const offset_x = (this.canvas.width - grid.width * scale) / 2;
    const offset_y = (this.canvas.height - grid.height * scale) / 2;

    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.fillStyle = "#080a0f";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const tile = grid.get_tile(x, y);
        if (!tile?.explored) {
          continue;
        }
        context.fillStyle = minimap_terrain_color(tile.terrain_id, tile.visible);
        context.fillRect(offset_x + x * scale, offset_y + y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    for (const position of this.game.exploration_system?.known_chest_positions.values() ?? []) {
      draw_marker(context, offset_x, offset_y, scale, position.x, position.y, "#e3b84f", Math.max(2, scale * 0.52));
    }

    for (const object of this.game.entities.filter((entity) => entity.alive && entity.type === "dungeon_object")) {
      const tile = grid.get_tile(object.grid_x, object.grid_y);
      if (!tile?.explored || (object.object_type === "secret_wall" && !object.revealed)) {
        continue;
      }
      const color = object.object_type === "healing_fountain" ? "#69c7dc" :
        object.object_type === "locked_door" ? "#b98b4d" :
        ["spike_trap", "pressure_plate", "explosive_barrel"].includes(object.object_type) ? "#bd6648" : "#a7a09a";
      draw_marker(context, offset_x, offset_y, scale, object.grid_x, object.grid_y, color, Math.max(1.5, scale * 0.38));
    }

    for (const entity of this.game.entities) {
      if (!entity.alive || !grid.get_tile(entity.grid_x, entity.grid_y)?.visible) {
        continue;
      }
      if (entity.type === "monster") {
        draw_marker(context, offset_x, offset_y, scale, entity.grid_x, entity.grid_y, "#d95a63", Math.max(1.5, scale * 0.35));
      } else if (entity.type === "companion") {
        draw_marker(context, offset_x, offset_y, scale, entity.grid_x, entity.grid_y, "#e7d28a", Math.max(1.5, scale * 0.35));
      }
    }

    draw_marker(
      context,
      offset_x,
      offset_y,
      scale,
      this.game.player.grid_x,
      this.game.player.grid_y,
      "#eaf5ff",
      Math.max(2.2, scale * 0.52)
    );
  }
}

function minimap_terrain_color(terrain_id, visible) {
  const colors = {
    wall: "#242a34",
    exit: "#d5a653",
    lava_floor: "#b8461c",
    flooded_floor: "#355969",
    moss_floor: "#435c44",
    overgrown_floor: "#4a5f3d",
    rune_floor: "#5b4d78",
    blood_floor: "#63383c",
    treasure_floor: "#766238"
  };
  const color = colors[terrain_id] ?? "#676c75";
  return visible ? color : dim_hex(color, 0.55);
}

function draw_marker(context, offset_x, offset_y, scale, x, y, color, radius) {
  context.beginPath();
  context.arc(offset_x + (x + 0.5) * scale, offset_y + (y + 0.5) * scale, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function dim_hex(hex, factor) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = Math.round(((value >> 16) & 255) * factor);
  const green = Math.round(((value >> 8) & 255) * factor);
  const blue = Math.round((value & 255) * factor);
  return `rgb(${red}, ${green}, ${blue})`;
}
