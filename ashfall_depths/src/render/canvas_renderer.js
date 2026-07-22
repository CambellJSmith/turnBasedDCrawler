import { game_config } from "../config/game_config.js";
import { terrain_database } from "../data/terrain.js";
import { calculate_camera, grid_to_screen } from "../world/isometric.js";

export class CanvasRenderer {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.context.imageSmoothingEnabled = false;
  }

  render(now) {
    const context = this.context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const gradient = context.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#151925");
    gradient.addColorStop(1, "#080a0f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const camera = calculate_camera(this.game.player);
    this.draw_floor_tiles(camera);
    this.draw_depth_sorted_world(camera, now);
    this.draw_effects(camera, now);
    this.draw_combat_text(camera, now);
    this.draw_vignette();
  }

  draw_floor_tiles(camera) {
    const grid = this.game.dungeon.grid;
    const draw_order = [];
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        draw_order.push({ x, y, depth: x + y });
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

      this.draw_floor(screen.x, screen.y, terrain_database[tile.terrain_id].floor_color, tile.terrain_id === "exit");
      if (this.game.state.settings.show_grid_coordinates) {
        this.context.fillStyle = "#ffffff66";
        this.context.font = "9px monospace";
        this.context.textAlign = "center";
        this.context.fillText(`${position.x},${position.y}`, screen.x, screen.y + 4);
      }
    }
  }

  draw_depth_sorted_world(camera, now) {
    for (const drawable of this.build_depth_sorted_drawables()) {
      const screen = grid_to_screen(drawable.display_x, drawable.display_y, camera);
      if (!this.is_visible_on_canvas(screen.x, screen.y)) {
        continue;
      }

      if (drawable.kind === "wall") {
        this.draw_wall(screen.x, screen.y);
      } else if (drawable.entity.type === "ground_item") {
        this.draw_ground_item(drawable.entity, screen);
      } else {
        this.draw_actor(drawable.entity, screen, now);
      }
    }
  }

  build_depth_sorted_drawables() {
    const drawables = [];
    const grid = this.game.dungeon.grid;

    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        if (grid.get_tile(x, y).terrain_id !== "wall") {
          continue;
        }
        drawables.push({
          kind: "wall",
          display_x: x,
          display_y: y,
          depth: x + y,
          sort_x: x,
          sort_priority: 2
        });
      }
    }

    for (const entity of this.game.entities) {
      if (!entity.alive) {
        continue;
      }
      drawables.push({
        kind: "entity",
        entity,
        display_x: entity.display_x,
        display_y: entity.display_y,
        depth: entity.display_x + entity.display_y,
        sort_x: entity.display_x,
        sort_priority: entity.type === "ground_item" ? 0 : 1
      });
    }

    drawables.sort((a, b) =>
      a.depth - b.depth ||
      a.sort_x - b.sort_x ||
      a.sort_priority - b.sort_priority
    );
    return drawables;
  }

  is_visible_on_canvas(x, y) {
    return x >= -100 &&
      x <= game_config.canvas_width + 100 &&
      y >= -game_config.wall_height - 100 &&
      y <= game_config.canvas_height + 100;
  }

  draw_floor(x, y, color, is_exit) {
    const half_width = game_config.tile_width / 2;
    const half_height = game_config.tile_height / 2;
    const context = this.context;
    context.beginPath();
    context.moveTo(x, y - half_height);
    context.lineTo(x + half_width, y);
    context.lineTo(x, y + half_height);
    context.lineTo(x - half_width, y);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = "#0c0e15";
    context.lineWidth = 1;
    context.stroke();
    if (is_exit) {
      context.strokeStyle = "#f0cf6a";
      context.lineWidth = 2;
      context.stroke();
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fillStyle = "#e8c35c";
      context.fill();
    }
  }

  draw_wall(x, y) {
    const half_width = game_config.tile_width / 2;
    const half_height = game_config.tile_height / 2;
    const top_y = y - game_config.wall_height;
    const context = this.context;

    context.beginPath();
    context.moveTo(x - half_width, y);
    context.lineTo(x, y + half_height);
    context.lineTo(x, top_y + half_height);
    context.lineTo(x - half_width, top_y);
    context.closePath();
    context.fillStyle = "#202532";
    context.fill();

    context.beginPath();
    context.moveTo(x + half_width, y);
    context.lineTo(x, y + half_height);
    context.lineTo(x, top_y + half_height);
    context.lineTo(x + half_width, top_y);
    context.closePath();
    context.fillStyle = "#171b24";
    context.fill();

    context.beginPath();
    context.moveTo(x, top_y - half_height);
    context.lineTo(x + half_width, top_y);
    context.lineTo(x, top_y + half_height);
    context.lineTo(x - half_width, top_y);
    context.closePath();
    context.fillStyle = "#343b4d";
    context.fill();
    context.strokeStyle = "#11131a";
    context.stroke();
  }

  draw_actor(entity, screen, now) {
    const context = this.context;
    const dimensions = this.get_actor_dimensions(entity);
    context.beginPath();
    context.ellipse(screen.x, screen.y + 10, dimensions.shadow_radius, 7, 0, 0, Math.PI * 2);
    context.fillStyle = "#00000066";
    context.fill();

    this.draw_actor_body(entity, screen, dimensions, now);
    this.draw_actor_resource_bars(entity, screen, dimensions);

    if (entity.type === "recruitable") {
      context.fillStyle = "#f5d36d";
      context.font = "bold 15px sans-serif";
      context.textAlign = "center";
      context.fillText("!", screen.x, screen.y - 38);
    }
  }

  get_actor_dimensions(entity) {
    if (entity.type === "player") {
      return { radius: 15, height: 34, shadow_radius: 22, bar_width: 36 };
    }
    if (entity.type === "companion" || entity.type === "recruitable") {
      return { radius: 13, height: 31, shadow_radius: 20, bar_width: 34 };
    }
    if (entity.archetype === "tank") {
      return { radius: 18, height: 31, shadow_radius: 25, bar_width: 42 };
    }
    if (entity.archetype === "bruiser") {
      return { radius: 16, height: 34, shadow_radius: 23, bar_width: 38 };
    }
    if (entity.archetype === "glass_cannon") {
      return { radius: 11, height: 38, shadow_radius: 18, bar_width: 32 };
    }
    return { radius: 13, height: 31, shadow_radius: 20, bar_width: 34 };
  }

  draw_actor_body(entity, screen, dimensions, now) {
    const context = this.context;
    context.beginPath();

    if (entity.type === "monster" && entity.archetype === "tank") {
      context.moveTo(screen.x, screen.y - dimensions.height);
      context.lineTo(screen.x + dimensions.radius, screen.y - 18);
      context.lineTo(screen.x + dimensions.radius, screen.y + 1);
      context.lineTo(screen.x, screen.y + 10);
      context.lineTo(screen.x - dimensions.radius, screen.y + 1);
      context.lineTo(screen.x - dimensions.radius, screen.y - 18);
    } else if (entity.type === "monster" && entity.archetype === "bruiser") {
      context.moveTo(screen.x, screen.y - dimensions.height);
      context.lineTo(screen.x + dimensions.radius + 2, screen.y - 10);
      context.lineTo(screen.x + dimensions.radius - 4, screen.y + 6);
      context.lineTo(screen.x - dimensions.radius + 4, screen.y + 6);
      context.lineTo(screen.x - dimensions.radius - 2, screen.y - 10);
    } else if (entity.type === "monster" && entity.archetype === "glass_cannon") {
      context.moveTo(screen.x, screen.y - dimensions.height);
      context.lineTo(screen.x + dimensions.radius, screen.y + 8);
      context.lineTo(screen.x, screen.y + 2);
      context.lineTo(screen.x - dimensions.radius, screen.y + 8);
    } else {
      context.moveTo(screen.x, screen.y - 25);
      context.lineTo(screen.x + dimensions.radius, screen.y - 4);
      context.lineTo(screen.x, screen.y + 9);
      context.lineTo(screen.x - dimensions.radius, screen.y - 4);
    }

    context.closePath();
    context.fillStyle = now < entity.flash_until ? "#ffffff" : entity.color;
    context.fill();
    context.strokeStyle = this.get_actor_stroke_color(entity);
    context.lineWidth = entity.type === "monster" && entity.archetype === "tank" ? 3 : 2;
    context.stroke();
  }

  get_actor_stroke_color(entity) {
    if (entity.type === "player") {
      return "#d8efff";
    }
    if (entity.type === "companion") {
      return "#ffe7a0";
    }
    if (entity.type === "monster" && entity.archetype === "glass_cannon") {
      return "#f0c8ff";
    }
    if (entity.type === "monster" && entity.archetype === "bruiser") {
      return "#522b25";
    }
    if (entity.type === "monster" && entity.archetype === "tank") {
      return "#c6d0d8";
    }
    return "#2a1e23";
  }

  draw_actor_resource_bars(entity, screen, dimensions) {
    if (entity.type !== "companion") {
      return;
    }

    const context = this.context;
    const width = dimensions.bar_width;
    const bar_x = screen.x - width / 2;
    const health_y = screen.y - dimensions.height - 9;
    const magic_y = health_y + 6;
    const health_ratio = Math.max(0, entity.health / entity.maximum_health);
    const magic_ratio = entity.maximum_magic > 0 ? Math.max(0, entity.magic / entity.maximum_magic) : 0;

    context.fillStyle = "#171923";
    context.fillRect(bar_x, health_y, width, 4);
    context.fillStyle = "#63c67b";
    context.fillRect(bar_x, health_y, width * health_ratio, 4);

    if (entity.maximum_magic > 0) {
      context.fillStyle = "#171923";
      context.fillRect(bar_x, magic_y, width, 3);
      context.fillStyle = "#5a8fe8";
      context.fillRect(bar_x, magic_y, width * magic_ratio, 3);
    }
  }

  draw_ground_item(entity, screen) {
    const context = this.context;
    context.beginPath();
    context.arc(screen.x, screen.y - 4, 7, 0, Math.PI * 2);
    context.fillStyle = "#f2d76f";
    context.fill();
    context.strokeStyle = "#fff0ad";
    context.stroke();
  }

  draw_effects(camera, now) {
    this.game.effects = this.game.effects.filter((effect) => now - effect.created_at < 550);
    for (const effect of this.game.effects) {
      const progress = (now - effect.created_at) / 550;
      const screen = grid_to_screen(effect.grid_x, effect.grid_y, camera);
      const radius = 10 + progress * 28;
      this.context.beginPath();
      this.context.arc(screen.x, screen.y - 8, radius, 0, Math.PI * 2);
      this.context.strokeStyle = effect.type === "fire" ? `rgba(255,120,60,${1 - progress})` : effect.type === "heal" ? `rgba(110,255,150,${1 - progress})` : `rgba(130,210,255,${1 - progress})`;
      this.context.lineWidth = 3;
      this.context.stroke();
    }
  }

  draw_combat_text(camera, now) {
    this.game.combat_texts = this.game.combat_texts.filter((entry) => now - entry.created_at < 700);
    for (const entry of this.game.combat_texts) {
      const progress = (now - entry.created_at) / 700;
      const screen = grid_to_screen(entry.grid_x, entry.grid_y, camera);
      this.context.globalAlpha = 1 - progress;
      this.context.fillStyle = "#ffffff";
      this.context.font = "bold 16px sans-serif";
      this.context.textAlign = "center";
      this.context.fillText(entry.text, screen.x, screen.y - 34 - progress * 25);
      this.context.globalAlpha = 1;
    }
  }

  draw_vignette() {
    const context = this.context;
    const gradient = context.createRadialGradient(480, 300, 150, 480, 300, 570);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.72)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
