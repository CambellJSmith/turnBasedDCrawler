import { spell_database } from "../data/spells.js";

const spell_commands = Object.freeze([
  Object.freeze({ button_id: "command_spell_1", cost_id: "command_spell_1_cost", spell_id: "fire_bolt" }),
  Object.freeze({ button_id: "command_spell_2", cost_id: "command_spell_2_cost", spell_id: "healing_light" }),
  Object.freeze({ button_id: "command_spell_3", cost_id: "command_spell_3_cost", spell_id: "frost_nova" })
]);

export class HudController {
  constructor(game) {
    this.game = game;
    this.health_fill = document.querySelector("#health_fill");
    this.magic_fill = document.querySelector("#magic_fill");
    this.health_text = document.querySelector("#health_text");
    this.magic_text = document.querySelector("#magic_text");
    this.floor_text = document.querySelector("#floor_text");
    this.gold_text = document.querySelector("#gold_text");
    this.team_text = document.querySelector("#team_text");
    this.level_text = document.querySelector("#level_text");
    this.experience_text = document.querySelector("#experience_text");
    this.turn_text = document.querySelector("#turn_text");
    this.phase_text = document.querySelector("#phase_text");
    this.hero_name = document.querySelector("#hero_name");
    this.hero_avatar = document.querySelector("#hero_avatar");
    this.hero_status_text = document.querySelector("#hero_status_text");
    this.interaction_prompt = document.querySelector("#interaction_prompt");
    this.interaction_prompt_text = document.querySelector("#interaction_prompt_text");
    this.objective_text = document.querySelector("#objective_text");
    this.enemy_count_text = document.querySelector("#enemy_count_text");
    this.exploration_text = document.querySelector("#exploration_text");
    this.party_status_list = document.querySelector("#party_status_list");
    this.healing_potion_count = document.querySelector("#healing_potion_count");
    this.mana_potion_count = document.querySelector("#mana_potion_count");
    this.command_attack = document.querySelector("#command_attack");
    this.command_interact = document.querySelector("#command_interact");
    this.command_menu = document.querySelector("#command_menu");
    this.quick_healing_potion = document.querySelector("#quick_healing_potion");
    this.quick_mana_potion = document.querySelector("#quick_mana_potion");
    this.spell_command_nodes = spell_commands.map((command) => ({
      ...command,
      button: document.querySelector(`#${command.button_id}`),
      cost: document.querySelector(`#${command.cost_id}`)
    }));
    this.party_nodes = new Map();
    this.party_signature = "";
    this.bind_commands();
  }

  bind_commands() {
    this.command_attack?.addEventListener("click", () => {
      this.game.turn_system.try_player_action((now) => this.game.combat_system.player_attack(now));
    });
    this.command_interact?.addEventListener("click", () => this.game.perform_interaction_action());
    this.command_menu?.addEventListener("click", () => this.game.menu_controller.open());
    this.quick_healing_potion?.addEventListener("click", () => this.game.perform_item_action("healing_potion"));
    this.quick_mana_potion?.addEventListener("click", () => this.game.perform_item_action("mana_potion"));
    for (const command of this.spell_command_nodes) {
      command.button?.addEventListener("click", () => this.game.perform_spell_action(command.spell_id));
    }
  }

  update() {
    const player = this.game.player;
    if (!player) {
      return;
    }

    const health_ratio = safe_ratio(player.health, player.maximum_health);
    const magic_ratio = safe_ratio(player.magic, player.maximum_magic);
    this.health_fill.style.width = `${health_ratio * 100}%`;
    this.magic_fill.style.width = `${magic_ratio * 100}%`;
    this.health_fill.classList.toggle("low", health_ratio > 0.25 && health_ratio <= 0.5);
    this.health_fill.classList.toggle("critical", health_ratio <= 0.25);
    this.health_text.textContent = `${player.health} / ${player.maximum_health}`;
    this.magic_text.textContent = `${player.magic} / ${player.maximum_magic}`;

    const display_name = title_case(player.name || "hero");
    this.hero_name.textContent = display_name;
    this.hero_avatar.textContent = display_name.slice(0, 1).toUpperCase();
    this.hero_status_text.textContent = this.get_hero_status();

    this.floor_text.textContent = `B${this.game.state.floor}F`;
    this.gold_text.innerHTML = `<b>G</b> ${this.game.state.gold}`;
    this.team_text.textContent = `Party ${this.game.state.party.member_ids.length}/${this.game.state.party.maximum_members}`;
    this.level_text.textContent = `Lv. ${this.game.state.player_level}`;
    const required_experience = this.game.player_progression_system?.get_experience_requirement() ?? 0;
    this.experience_text.textContent = `XP ${this.game.state.player_experience} / ${required_experience}`;
    this.turn_text.textContent = `Turn ${this.game.state.turn_count}`;
    this.phase_text.textContent = this.get_phase_text();

    const prompt = this.game.interaction_system.get_prompt();
    this.interaction_prompt.hidden = !prompt;
    this.interaction_prompt_text.textContent = format_prompt(prompt);

    this.update_objective();
    this.update_party_status();
    this.update_commands(prompt);
  }

  update_objective() {
    const grid = this.game.dungeon?.grid;
    if (!grid) {
      return;
    }

    const exit = this.game.dungeon.exit;
    const exit_tile = grid.get_tile(exit.x, exit.y);
    const player_on_exit = this.game.player.grid_x === exit.x && this.game.player.grid_y === exit.y;
    const living_monsters = this.game.get_living_monsters().length;

    if (player_on_exit) {
      this.objective_text.textContent = "The descent door is beneath you. Continue when the team is ready.";
    } else if (exit_tile?.explored) {
      this.objective_text.textContent = "The descent door has been found. Navigate back to it when ready.";
    } else if (living_monsters === 0) {
      this.objective_text.textContent = "The floor is quiet. Continue exploring until the descent door is discovered.";
    } else {
      this.objective_text.textContent = "Explore the floor, gather supplies, and locate the descent door.";
    }

    const explorable_tiles = grid.tiles.flat().filter((tile) => !["wall", "void"].includes(tile.terrain_id));
    const explored_tiles = explorable_tiles.filter((tile) => tile.explored);
    const explored_percentage = explorable_tiles.length > 0
      ? Math.round((explored_tiles.length / explorable_tiles.length) * 100)
      : 0;
    this.enemy_count_text.textContent = `${living_monsters} ${living_monsters === 1 ? "enemy" : "enemies"}`;
    this.exploration_text.textContent = `explored ${explored_percentage}%`;
  }

  update_party_status() {
    const members = [
      this.game.player,
      ...this.game.entities.filter((entity) => entity.type === "companion")
    ].filter(Boolean);
    const next_signature = members.map((member) => member.entity_id).join("|");
    if (next_signature !== this.party_signature) {
      this.rebuild_party_status(members);
      this.party_signature = next_signature;
    }

    for (const member of members) {
      const nodes = this.party_nodes.get(member.entity_id);
      if (!nodes) {
        continue;
      }
      const health_ratio = safe_ratio(member.health, member.maximum_health);
      nodes.card.classList.toggle("fallen", !member.alive);
      nodes.fill.classList.toggle("low", health_ratio > 0.25 && health_ratio <= 0.5);
      nodes.fill.classList.toggle("critical", health_ratio <= 0.25);
      nodes.fill.style.width = `${health_ratio * 100}%`;
      nodes.health.textContent = `${member.health}/${member.maximum_health}`;
      nodes.role.textContent = member.type === "player" ? "Leader" : member.alive ? "Ally" : "Fallen";
    }
  }

  rebuild_party_status(members) {
    this.party_nodes.clear();
    this.party_status_list?.replaceChildren();
    for (const member of members) {
      const card = document.createElement("article");
      card.className = `party_member ${member.type === "player" ? "player_member" : ""}`;

      const portrait = document.createElement("div");
      portrait.className = "party_portrait";
      portrait.textContent = title_case(member.name || member.type).slice(0, 1).toUpperCase();

      const details = document.createElement("div");
      details.className = "party_details";
      const name_line = document.createElement("div");
      name_line.className = "party_name_line";
      const name = document.createElement("strong");
      name.textContent = title_case(member.name || member.type);
      const role = document.createElement("span");
      role.className = "party_role";
      name_line.append(name, role);

      const health_line = document.createElement("div");
      health_line.className = "party_hp_line";
      const bar = document.createElement("div");
      bar.className = "party_hp_bar";
      const fill = document.createElement("div");
      fill.className = "party_hp_fill";
      bar.append(fill);
      const health = document.createElement("span");
      health.className = "party_hp_text";
      health_line.append(bar, health);

      details.append(name_line, health_line);
      card.append(portrait, details);
      this.party_status_list?.append(card);
      this.party_nodes.set(member.entity_id, { card, fill, health, role });
    }
  }

  update_commands(prompt) {
    const player = this.game.player;
    const can_act = Boolean(this.game.turn_system.can_player_act?.()) && player.alive && !player.moving;
    this.command_attack.disabled = !can_act;
    this.command_interact.disabled = !can_act || !prompt;

    for (const command of this.spell_command_nodes) {
      const spell = spell_database[command.spell_id];
      const cost = this.game.magic_system.get_magic_cost(spell, player);
      command.cost.textContent = `${cost} MP`;
      command.button.disabled = !can_act || player.magic < cost;
    }

    const healing_count = this.game.state.inventory.get_amount("healing_potion");
    const mana_count = this.game.state.inventory.get_amount("mana_potion");
    this.healing_potion_count.textContent = `×${healing_count}`;
    this.mana_potion_count.textContent = `×${mana_count}`;
    this.quick_healing_potion.disabled = !can_act || healing_count <= 0 || player.health >= player.maximum_health;
    this.quick_mana_potion.disabled = !can_act || mana_count <= 0 || player.magic >= player.maximum_magic;
  }

  get_hero_status() {
    if (!this.game.player.alive) {
      return "Fallen";
    }
    if (this.game.player.moving) {
      return "Moving";
    }
    if (this.game.paused) {
      return "Time stopped";
    }
    if (this.game.turn_system.turn_in_progress) {
      return `${title_case(this.game.turn_system.phase)} phase`;
    }
    return "Leader · ready";
  }

  get_phase_text() {
    if (!this.game.player.alive) {
      return "Defeated";
    }
    if (this.game.paused) {
      return "Paused";
    }
    if (this.game.turn_system.turn_in_progress) {
      return `${this.game.turn_system.phase} acting`;
    }
    return "Your turn";
  }
}

function safe_ratio(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / maximum));
}

function title_case(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function format_prompt(prompt) {
  return String(prompt || "")
    .replace(/^press e or xbox a to /i, "")
    .replace(/ · consumes a turn$/i, " · 1 turn");
}
