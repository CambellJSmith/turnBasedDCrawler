import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const test_directory = dirname(fileURLToPath(import.meta.url));
const project_root = resolve(test_directory, "..");
const html = readFileSync(resolve(project_root, "index.html"), "utf8");
const main_css = readFileSync(resolve(project_root, "styles/main.css"), "utf8");
const menu_css = readFileSync(resolve(project_root, "styles/menu.css"), "utf8");
const exploration_css = readFileSync(resolve(project_root, "styles/exploration.css"), "utf8");
const hud_source = readFileSync(resolve(project_root, "src/ui/hud_controller.js"), "utf8");

const required_ids = [
  "game_canvas",
  "hero_panel",
  "hero_name",
  "health_fill",
  "magic_fill",
  "dungeon_banner",
  "floor_text",
  "room_text",
  "room_description_text",
  "gold_text",
  "turn_text",
  "team_text",
  "experience_text",
  "message_log",
  "command_dock",
  "command_attack",
  "command_spell_1",
  "command_spell_2",
  "command_spell_3",
  "command_interact",
  "quick_healing_potion",
  "quick_mana_potion",
  "command_menu",
  "minimap_canvas",
  "objective_text",
  "enemy_count_text",
  "exploration_text",
  "party_status_list",
  "interaction_prompt_text",
  "dialogue_overlay",
  "level_up_overlay",
  "menu_overlay",
  "game_over_overlay"
];

for (const id of required_ids) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing redesigned UI element #${id}`);
}

const all_ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
assert.equal(new Set(all_ids).size, all_ids.length, "the redesigned shell must not contain duplicate ids");

assert.match(main_css, /\.adventure_window/);
assert.match(main_css, /\.command_dock/);
assert.match(main_css, /\.critical/);
assert.match(menu_css, /#menu_window/);
assert.match(exploration_css, /\.party_member/);
assert.match(exploration_css, /\.map_legend/);
assert.match(exploration_css, /@media \(max-width: 920px\)/);
assert.match(hud_source, /bind_commands\(\)/);
assert.match(hud_source, /update_objective\(\)/);
assert.match(hud_source, /update_party_status\(\)/);
assert.match(hud_source, /get_magic_cost/);

for (const relative_path of ["src/ui/hud_controller.js", "src/ui/room_ui_patch.js"]) {
  const result = spawnSync(process.execPath, ["--check", resolve(project_root, relative_path)], { encoding: "utf8" });
  assert.equal(result.status, 0, `${relative_path} failed syntax validation:\n${result.stderr}`);
}

assert.doesNotMatch(html.toLowerCase(), /pokemon|mystery dungeon/, "the UI must remain original and unbranded");

console.log("adventure HUD structure, responsiveness, command dock, and controller syntax passed");
