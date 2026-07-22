import { Game } from "../core/game.js";
import { HudController } from "../ui/hud_controller.js";
import { MinimapController } from "../ui/minimap_controller.js";
import { ExplorationSystem } from "./exploration_system.js";

const original_generate_floor = Game.prototype.generate_floor;
Game.prototype.generate_floor = function generate_floor_with_exploration() {
  const result = original_generate_floor.call(this);
  this.exploration_system = new ExplorationSystem(this);
  this.minimap_controller ??= new MinimapController(this);
  this.exploration_system.initialize_floor();
  return result;
};

const original_hud_update = HudController.prototype.update;
HudController.prototype.update = function update_with_minimap() {
  original_hud_update.call(this);
  this.game.minimap_controller?.render();
};
