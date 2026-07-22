import { input_actions } from "../config/input_config.js";
import { character_database } from "../data/characters.js";
import { item_database } from "../data/items.js";
import { spell_database } from "../data/spells.js";
import { terrain_database } from "../data/terrain.js";

const tabs = ["items", "magic", "stats", "team", "ground_tile", "settings"];

export class MenuController {
  constructor(game) {
    this.game = game;
    this.overlay = document.querySelector("#menu_overlay");
    this.tabs_element = document.querySelector("#menu_tabs");
    this.content_element = document.querySelector("#menu_content");
    this.close_button = document.querySelector("#menu_close");
    this.active_tab = "items";
    this.controller_navigation_active = false;
    this.close_button.addEventListener("click", () => this.close());
    this.build_tabs();
  }

  build_tabs() {
    this.tabs_element.replaceChildren();
    for (const tab_id of tabs) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu_tab";
      button.dataset.tabId = tab_id;
      button.textContent = tab_id.replaceAll("_", " ");
      button.addEventListener("click", () => this.show_tab(tab_id));
      this.tabs_element.append(button);
    }
  }

  toggle() {
    if (this.overlay.hidden) {
      this.open();
    } else {
      this.close();
    }
  }

  open() {
    if (!document.querySelector("#dialogue_overlay").hidden) {
      return;
    }
    this.overlay.hidden = false;
    this.game.paused = true;
    this.show_tab(this.active_tab);
    this.focus_active_tab();
  }

  close() {
    this.overlay.hidden = true;
    this.game.paused = !this.game.player.alive;
    this.controller_navigation_active = false;
    this.game.canvas.focus();
  }

  handle_input(action) {
    this.controller_navigation_active = true;
    if (action === input_actions.menu || action === input_actions.cancel) {
      this.close();
      return;
    }
    if (action === input_actions.previous_tab || action === input_actions.spell_1) {
      this.switch_tab(-1);
      return;
    }
    if (action === input_actions.next_tab || action === input_actions.spell_2) {
      this.switch_tab(1);
      return;
    }
    if (action === input_actions.move_north) {
      this.move_focus(-1);
      return;
    }
    if (action === input_actions.move_south) {
      this.move_focus(1);
      return;
    }
    if (action === input_actions.move_west) {
      if (!this.adjust_focused_range(-1)) {
        this.move_focus(-1);
      }
      return;
    }
    if (action === input_actions.move_east) {
      if (!this.adjust_focused_range(1)) {
        this.move_focus(1);
      }
      return;
    }
    if (action === input_actions.confirm || action === input_actions.interact) {
      this.activate_focused_control();
    }
  }

  show_tab(tab_id) {
    this.active_tab = tab_id;
    for (const button of this.tabs_element.children) {
      button.classList.toggle("active", button.dataset.tabId === tab_id);
    }
    const render_method = this[`render_${tab_id}`].bind(this);
    this.content_element.innerHTML = render_method();
    this.bind_content_actions();
  }

  switch_tab(direction) {
    const current_index = tabs.indexOf(this.active_tab);
    const next_index = (current_index + direction + tabs.length) % tabs.length;
    this.show_tab(tabs[next_index]);
    this.focus_active_tab();
  }

  focus_active_tab() {
    const button = this.tabs_element.querySelector(`[data-tab-id="${this.active_tab}"]`);
    this.focus_control(button);
  }

  focus_first_content_control() {
    const control = this.content_element.querySelector("button:not([disabled]), input:not([disabled])");
    this.focus_control(control ?? this.tabs_element.querySelector(`[data-tab-id="${this.active_tab}"]`));
  }

  get_focusable_controls() {
    return [
      ...this.tabs_element.querySelectorAll("button:not([disabled])"),
      ...this.content_element.querySelectorAll("button:not([disabled]), input:not([disabled])"),
      this.close_button
    ].filter((element) => !element.hidden && element.offsetParent !== null);
  }

  move_focus(direction) {
    const controls = this.get_focusable_controls();
    if (controls.length === 0) {
      return;
    }
    const current_index = controls.indexOf(document.activeElement);
    const start_index = current_index >= 0 ? current_index : 0;
    const next_index = (start_index + direction + controls.length) % controls.length;
    this.focus_control(controls[next_index]);
  }

  focus_control(control) {
    if (!control) {
      return;
    }
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  adjust_focused_range(direction) {
    const control = document.activeElement;
    if (!(control instanceof HTMLInputElement) || control.type !== "range") {
      return false;
    }
    const step = Number(control.step || 1);
    const minimum = Number(control.min || 0);
    const maximum = Number(control.max || 100);
    control.value = String(Math.max(minimum, Math.min(maximum, Number(control.value) + step * direction)));
    control.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  activate_focused_control() {
    const control = document.activeElement;
    if (control instanceof HTMLButtonElement) {
      control.click();
      return;
    }
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      control.checked = !control.checked;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  bind_content_actions() {
    this.content_element.querySelectorAll("[data-use-item]").forEach((button) => {
      button.addEventListener("click", () => {
        const item_id = button.dataset.useItem;
        this.close();
        if (!this.game.perform_item_action(item_id)) {
          this.open();
          this.show_tab("items");
          this.focus_first_content_control();
        }
      });
    });

    this.content_element.querySelectorAll("[data-equip-item]").forEach((button) => {
      button.addEventListener("click", () => {
        this.game.equip_item(button.dataset.equipItem);
        this.show_tab("items");
        if (this.controller_navigation_active) {
          this.focus_first_content_control();
        }
      });
    });

    this.content_element.querySelectorAll("[data-cast-spell]").forEach((button) => {
      button.addEventListener("click", () => {
        const spell_id = button.dataset.castSpell;
        this.close();
        if (!this.game.perform_spell_action(spell_id)) {
          this.open();
          this.show_tab("magic");
          this.focus_first_content_control();
        }
      });
    });

    this.content_element.querySelector("#save_game")?.addEventListener("click", () => {
      this.game.save_manager.save(this.game);
      this.game.add_log("game saved");
      this.show_tab("settings");
      if (this.controller_navigation_active) {
        this.focus_first_content_control();
      }
    });

    this.content_element.querySelector("#new_floor")?.addEventListener("click", () => {
      this.close();
      this.game.advance_floor();
    });

    this.content_element.querySelector("#master_volume")?.addEventListener("input", (event) => {
      this.game.state.settings.master_volume = Number(event.target.value);
    });

    this.content_element.querySelector("#screen_shake")?.addEventListener("change", (event) => {
      this.game.state.settings.screen_shake = event.target.checked;
    });

    this.content_element.querySelector("#show_grid_coordinates")?.addEventListener("change", (event) => {
      this.game.state.settings.show_grid_coordinates = event.target.checked;
    });
  }

  render_items() {
    const entries = [...this.game.state.inventory.items.entries()];
    const cards = entries.map(([item_id, amount]) => {
      const item = item_database[item_id];
      const equipped = this.game.state.inventory.equipped_weapon_id === item_id || this.game.state.inventory.equipped_accessory_id === item_id;
      const action = item.category === "consumable"
        ? `<button class="menu_button" data-use-item="${item_id}">use · 1 turn</button>`
        : `<button class="menu_button" data-equip-item="${item_id}">${equipped ? "equipped" : "equip · free"}</button>`;
      return `<article class="menu_card ${equipped ? "selected" : ""}"><h3>${item.name} × ${amount}</h3><p>${item.category}</p><p>${item.description}</p><footer>${action}</footer></article>`;
    }).join("");
    return `<h2>items</h2><p>using a consumable advances the turn. equipment changes are free.</p><div class="menu_grid">${cards || '<div class="empty_state">your inventory is empty</div>'}</div>`;
  }

  render_magic() {
    const cards = this.game.player.spell_ids.map((spell_id) => {
      const spell = spell_database[spell_id];
      return `<article class="menu_card"><h3>${spell.name}</h3><p>${spell.description}</p><p>magic cost: ${spell.magic_cost} · power: ${spell.power}</p><footer><button class="menu_button" data-cast-spell="${spell_id}">cast · 1 turn</button></footer></article>`;
    }).join("");
    return `<h2>magic</h2><p>successful spell casts advance the turn.</p><div class="menu_grid">${cards}</div>`;
  }

  render_stats() {
    const player = this.game.player;
    const weapon = item_database[this.game.state.inventory.equipped_weapon_id];
    const accessory = item_database[this.game.state.inventory.equipped_accessory_id];
    return `<h2>stats</h2><table class="stat_table"><tbody>
      <tr><td>name</td><td>${player.name}</td></tr>
      <tr><td>health</td><td>${player.health} / ${player.maximum_health}</td></tr>
      <tr><td>magic</td><td>${player.magic} / ${player.maximum_magic}</td></tr>
      <tr><td>attack</td><td>${player.attack + (weapon?.attack_bonus ?? 0)}</td></tr>
      <tr><td>defence</td><td>${player.defence + (accessory?.defence_bonus ?? 0)}</td></tr>
      <tr><td>magic power</td><td>${player.magic_power + (weapon?.magic_bonus ?? 0)}</td></tr>
      <tr><td>turns taken</td><td>${this.game.state.turn_count}</td></tr>
      <tr><td>defeated monsters</td><td>${this.game.state.defeated_monsters}</td></tr>
      <tr><td>current seed</td><td>${this.game.dungeon.seed}</td></tr>
    </tbody></table>`;
  }

  render_team() {
    const cards = this.game.state.party.member_ids.map((character_id, index) => {
      const character = character_database[character_id];
      const runtime = character_id === "hero" ? this.game.player : this.game.get_living_companions().find((member) => member.character_id === character_id);
      return `<article class="menu_card ${index === 0 ? "selected" : ""}"><h3>${character.name}</h3><p>${index === 0 ? "party leader · acts first" : "active companion · acts after player"}</p><p>health: ${runtime?.health ?? 0} / ${character.maximum_health}</p><p>magic power: ${character.magic_power}</p></article>`;
    }).join("");
    return `<h2>team</h2><p>${this.game.state.party.member_ids.length} / ${this.game.state.party.maximum_members} active members</p><div class="menu_grid">${cards}</div>`;
  }

  render_ground_tile() {
    const x = this.game.player.grid_x;
    const y = this.game.player.grid_y;
    const tile = this.game.dungeon.grid.get_tile(x, y);
    const terrain = terrain_database[tile.terrain_id];
    const entities = this.game.entities.filter((entity) => entity.alive && entity.grid_x === x && entity.grid_y === y && entity.entity_id !== this.game.player.entity_id);
    return `<h2>ground tile</h2><table class="stat_table"><tbody>
      <tr><td>coordinates</td><td>${x}, ${y}</td></tr>
      <tr><td>terrain</td><td>${terrain.name}</td></tr>
      <tr><td>walkable</td><td>${terrain.walkable ? "yes" : "no"}</td></tr>
      <tr><td>contents</td><td>${entities.length ? entities.map((entity) => entity.name).join(", ") : "nothing"}</td></tr>
      <tr><td>floor exit</td><td>${tile.terrain_id === "exit" ? "present" : "none"}</td></tr>
    </tbody></table>`;
  }

  render_settings() {
    const settings = this.game.state.settings;
    return `<h2>settings</h2>
      <div class="setting_row"><label for="master_volume">master volume</label><input id="master_volume" type="range" min="0" max="1" step="0.05" value="${settings.master_volume}"></div>
      <div class="setting_row"><label for="screen_shake">screen shake</label><input id="screen_shake" type="checkbox" ${settings.screen_shake ? "checked" : ""}></div>
      <div class="setting_row"><label for="show_grid_coordinates">show grid coordinates</label><input id="show_grid_coordinates" type="checkbox" ${settings.show_grid_coordinates ? "checked" : ""}></div>
      <h3>save and run</h3><div class="menu_grid">
        <article class="menu_card"><h3>save game</h3><p>stores campaign progress in this browser. saving is free.</p><footer><button id="save_game" class="menu_button">save</button></footer></article>
        <article class="menu_card"><h3>generate new floor</h3><p>abandons the current floor and creates another procedural dungeon.</p><footer><button id="new_floor" class="menu_button">new floor</button></footer></article>
      </div>`;
  }
}
