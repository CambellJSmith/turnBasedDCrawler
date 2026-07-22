export class GameOverController {
  constructor(game) {
    this.game = game;
    this.overlay = document.querySelector("#game_over_overlay");
    this.restart_button = document.querySelector("#wipe_restart_game");

    if (!this.overlay || !this.restart_button) {
      throw new Error("game over interface is missing from index.html");
    }

    this.restart_button.addEventListener("click", () => this.wipe_and_restart());
  }

  show() {
    this.overlay.hidden = false;
    this.restart_button.disabled = false;
    this.restart_button.focus({ preventScroll: true });
  }

  is_open() {
    return !this.overlay.hidden;
  }

  wipe_and_restart() {
    this.restart_button.disabled = true;
    this.game.save_manager.clear();
    window.location.reload();
  }
}
