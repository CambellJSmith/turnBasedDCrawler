import "./render/player_visibility_patch.js";
import { Game } from "./core/game.js";
import { GameOverController } from "./ui/game_over_controller.js";

const canvas = document.querySelector("#game_canvas");
const game = new Game(canvas);
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

game.start();
window.ashfall_game = game;
