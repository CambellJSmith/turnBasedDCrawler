import "./world/lava_generation_patch.js";
import "./render/lava_render_patch.js";
import "./render/player_visibility_patch.js";
import "./ui/player_progression_ui_patch.js";
import "./ui/room_ui_patch.js";
import { Game } from "./core/game.js";
import { install_player_progression } from "./systems/player_progression_system.js";
import { GameOverController } from "./ui/game_over_controller.js";

const canvas = document.querySelector("#game_canvas");
const game = new Game(canvas);
const saved_player_vitals = game.save_manager.load()?.player ?? null;
install_player_progression(game, saved_player_vitals);

const game_over_controller = new GameOverController(game);
game.game_over_controller = game_over_controller;
game.handle_player_defeat = () => {
  game.paused = true;
  game.turn_system.phase = "defeat";
  game.add_log("the dungeon claims this run");
  if (!game_over_controller.is_open()) {
    game_over_controller.show();
  }
};

const advance_floor = game.advance_floor.bind(game);
game.advance_floor = () => {
  game.player.health = game.player.maximum_health;
  game.player.magic = game.player.maximum_magic;
  return advance_floor();
};

game.start = () => {
  game.add_log("find the wall door whenever you want to descend");
  game.add_log("lava is impassable, but every generated route remains fully connected");
  game.add_log("rooms use distinct layouts, architecture, and floor materials");
  game.add_log("monsters are optional · fighting earns xp, gold, loot, and possible allies");
  requestAnimationFrame(game.loop);
};

game.start();
window.ashfall_game = game;
