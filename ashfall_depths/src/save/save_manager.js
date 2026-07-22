const save_key = "ashfall_depths_save_v1";

export class SaveManager {
  save(game) {
    const payload = {
      version: 2,
      saved_at: new Date().toISOString(),
      game_state: game.state.to_json(),
      player: {
        health: game.player.health,
        magic: game.player.magic
      }
    };
    localStorage.setItem(save_key, JSON.stringify(payload));
    return payload;
  }

  load() {
    const raw_data = localStorage.getItem(save_key);
    if (!raw_data) {
      return null;
    }
    try {
      return JSON.parse(raw_data);
    } catch {
      return null;
    }
  }

  clear() {
    localStorage.removeItem(save_key);
  }
}
