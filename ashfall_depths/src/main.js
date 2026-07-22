import "./render/player_visibility_patch.js";
import { Game } from "./core/game.js";

const canvas = document.querySelector("#game_canvas");
const game = new Game(canvas);
game.start();

window.ashfall_game = game;
