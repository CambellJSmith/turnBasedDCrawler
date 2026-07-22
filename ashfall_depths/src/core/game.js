import { game_config } from "../config/game_config.js";
import { get_floor_progression, calculate_monster_threat } from "../config/floor_progression.js";
import { input_actions } from "../config/input_config.js";
import { item_database } from "../data/items.js";
import { monster_database } from "../data/monsters.js";
import { create_ground_item, create_monster, create_player, create_recruitable, create_companion, create_monster_companion } from "../entities/entity_factory.js";
import { CanvasRenderer } from "../render/canvas_renderer.js";
import { SaveManager } from "../save/save_manager.js";
import { GameState } from "../state/game_state.js";
import { CombatSystem } from "../systems/combat_system.js";
import { CompanionAiSystem } from "../systems/companion_ai_system.js";
import { EnemyAiSystem } from "../systems/enemy_ai_system.js";
import { InputSystem } from "../systems/input_system.js";
import { InteractionSystem } from "../systems/interaction_system.js";
import { LootSystem } from "../systems/loot_system.js";
import { MagicSystem } from "../systems/magic_system.js";
import { MovementSystem } from "../systems/movement_system.js";
import { MonsterAbilitySystem } from "../systems/monster_ability_system.js";
import { RecruitmentSystem } from "../systems/recruitment_system.js";
import { ResourceRecoverySystem } from "../systems/resource_recovery_system.js";
import { TurnSystem } from "../systems/turn_system.js";
import { DialogueController } from "../ui/dialogue_controller.js";
import { HudController } from "../ui/hud_controller.js";
import { MenuController } from "../ui/menu_controller.js";
import { generate_dungeon } from "../world/dungeon_generator.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = new GameState();
    this.save_manager = new SaveManager();
    this.entities = [];
    this.effects = [];
    this.combat_texts = [];
    this.paused = false;
    this.last_frame_time = performance.now();
    this.message_log = document.querySelector("#message_log");

    this.input_system = new InputSystem(this);
    this.movement_system = new MovementSystem(this);
    this.monster_ability_system = new MonsterAbilitySystem(this);
    this.combat_system = new CombatSystem(this);
    this.loot_system = new LootSystem(this);
    this.magic_system = new MagicSystem(this);
    this.recruitment_system = new RecruitmentSystem(this);
    this.interaction_system = new InteractionSystem(this);
    this.enemy_ai_system = new EnemyAiSystem(this);
    this.companion_ai_system = new CompanionAiSystem(this);
    this.resource_recovery_system = new ResourceRecoverySystem(this);
    this.turn_system = new TurnSystem(this);
    this.renderer = new CanvasRenderer(this, canvas);
    this.hud_controller = new HudController(this);
    this.dialogue_controller = new DialogueController(this);
    this.menu_controller = new MenuController(this);

    this.load_campaign();
    this.generate_floor();
    this.loop = this.loop.bind(this);
  }

  start() {
    this.add_log("turn-based mode · every significant action advances the dungeon");
    this.add_log("each floor grows larger, denser, and more dangerous without a level cap");
    this.add_log("rarely, a monster defeated by you may return and ask to join");
    this.add_log("find the door in the wall after defeating the floor's enemies");
    requestAnimationFrame(this.loop);
  }

  load_campaign() {
    const save_data = this.save_manager.load();
    if (!save_data) {
      return;
    }
    this.state.load(save_data.game_state);
    this.pending_player_vitals = save_data.player;
  }

  generate_floor() {
    const seed = Date.now() + this.state.floor * 7919;
    this.floor_progression = get_floor_progression(this.state.floor);
    this.dungeon = generate_dungeon(
      this.floor_progression.map_width,
      this.floor_progression.map_height,
      seed,
      this.floor_progression
    );
    this.entities = [];
    this.effects = [];
    this.combat_texts = [];
    this.paused = false;
    this.turn_system.turn_in_progress = false;
    this.turn_system.phase = "player";
    this.player = create_player(this.dungeon.start.x, this.dungeon.start.y);

    if (this.pending_player_vitals) {
      this.player.health = Math.max(1, Math.min(this.player.maximum_health, this.pending_player_vitals.health ?? this.player.maximum_health));
      this.player.magic = Math.max(0, Math.min(this.player.maximum_magic, this.pending_player_vitals.magic ?? this.player.maximum_magic));
      this.pending_player_vitals = null;
    }
    this.entities.push(this.player);

    const used_positions = new Set([`${this.player.grid_x},${this.player.grid_y}`]);
    const all_floor_positions = this.dungeon.grid.get_floor_positions().filter((position) =>
      !(position.x === this.player.grid_x && position.y === this.player.grid_y) &&
      !(position.x === this.dungeon.exit.x && position.y === this.dungeon.exit.y)
    );
    const distant_positions = all_floor_positions.filter((position) =>
      Math.hypot(position.x - this.player.grid_x, position.y - this.player.grid_y) > this.floor_progression.minimum_spawn_distance
    );
    const floor_positions = distant_positions.length >= this.floor_progression.monster_count
      ? distant_positions
      : all_floor_positions;

    this.spawn_monsters(this.floor_progression, floor_positions, used_positions);

    if (!this.state.unlocked_character_ids.includes("mira_ashwalker")) {
      const recruit_position = this.take_random_position(floor_positions, used_positions);
      if (recruit_position) {
        this.entities.push(create_recruitable("mira_ashwalker", recruit_position.x, recruit_position.y));
      }
    }

    this.spawn_party_companions();

    for (const item_id of ["healing_potion", "mana_potion", "iron_sabre"]) {
      const position = this.take_random_position(floor_positions, used_positions);
      if (position) {
        this.entities.push(create_ground_item(item_id, position.x, position.y));
      }
    }
  }

  spawn_party_companions() {
    for (const member_id of this.state.party.member_ids.slice(1)) {
      const companion_position = this.find_open_near(this.player.grid_x, this.player.grid_y);
      const monster_member = this.state.party.get_monster_member(member_id);
      if (monster_member) {
        this.entities.push(create_monster_companion(monster_member, companion_position.x, companion_position.y));
      } else {
        this.entities.push(create_companion(member_id, companion_position.x, companion_position.y));
      }
    }
  }

  spawn_monsters(progression, floor_positions, used_positions) {
    if (progression.floor === 1) {
      const position = this.take_random_position(floor_positions, used_positions);
      if (position) {
        this.entities.push(this.create_scaled_monster("ember_slime", position.x, position.y, progression));
      }
      return;
    }

    const unlocked_entries = Object.values(monster_database).filter((monster) => monster.minimum_floor <= progression.floor);
    const threat_filtered_entries = unlocked_entries.filter((monster) => calculate_monster_threat(monster) <= progression.monster_threat_limit);
    const available_entries = threat_filtered_entries.length > 0 ? threat_filtered_entries : unlocked_entries;
    const guaranteed_archetypes = ["bruiser", "glass_cannon", "tank"].slice(0, progression.guaranteed_archetype_count);
    let spawned_count = 0;

    for (const archetype of guaranteed_archetypes) {
      const candidates = available_entries.filter((monster) => monster.archetype === archetype);
      const position = this.take_random_position(floor_positions, used_positions);
      if (!position || candidates.length === 0) {
        continue;
      }
      const monster = this.pick_weighted_monster(candidates);
      this.entities.push(this.create_scaled_monster(monster.id, position.x, position.y, progression));
      spawned_count += 1;
    }

    while (spawned_count < progression.monster_count) {
      const position = this.take_random_position(floor_positions, used_positions);
      if (!position || available_entries.length === 0) {
        break;
      }
      const monster = this.pick_weighted_monster(available_entries);
      this.entities.push(this.create_scaled_monster(monster.id, position.x, position.y, progression));
      spawned_count += 1;
    }
  }

  create_scaled_monster(monster_id, x, y, progression) {
    const monster = create_monster(monster_id, x, y);
    monster.maximum_health = Math.max(1, Math.round(monster.maximum_health * progression.health_multiplier));
    monster.health = monster.maximum_health;
    monster.maximum_magic = Math.max(0, Math.round(monster.maximum_magic * progression.magic_multiplier));
    monster.magic = monster.maximum_magic;
    monster.attack = Math.max(1, Math.round(monster.attack * progression.attack_multiplier));
    monster.magic_power = Math.max(0, Math.round(monster.magic_power * progression.magic_multiplier));
    monster.defence = Math.max(0, Math.round(monster.defence * progression.attack_multiplier) + progression.defence_bonus);
    monster.difficulty_floor = progression.floor;
    if (progression.floor === 1) {
      monster.special_ability = null;
    }
    return monster;
  }

  pick_weighted_monster(monsters) {
    const total_weight = monsters.reduce((total, monster) => total + Math.max(0, monster.spawn_weight), 0);
    if (total_weight <= 0) {
      return monsters[0];
    }

    let roll = this.dungeon.random.next() * total_weight;
    for (const monster of monsters) {
      roll -= Math.max(0, monster.spawn_weight);
      if (roll <= 0) {
        return monster;
      }
    }

    return monsters.at(-1);
  }

  take_random_position(positions, used_positions) {
    for (let attempt = 0; attempt < 100 && positions.length > 0; attempt += 1) {
      const index = this.dungeon.random.integer(0, positions.length - 1);
      const [position] = positions.splice(index, 1);
      const key = `${position.x},${position.y}`;
      if (!used_positions.has(key)) {
        used_positions.add(key);
        return position;
      }
    }
    return null;
  }

  find_open_near(x, y) {
    const candidates = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
    return candidates.find((position) => this.dungeon.grid.is_walkable(position.x, position.y) && !this.is_tile_blocked(position.x, position.y)) ?? { x, y };
  }

  loop(now) {
    this.last_frame_time = now;
    this.movement_system.update(now);
    this.turn_system.update();
    this.input_system.update(now);
    this.process_input();
    this.hud_controller.update();
    this.renderer.render(now);
    requestAnimationFrame(this.loop);
  }

  process_input() {
    const actions = this.input_system.consume_actions();
    for (const action of actions) {
      if (!this.dialogue_controller.overlay.hidden) {
        this.dialogue_controller.handle_input(action);
        continue;
      }
      if (!this.menu_controller.overlay.hidden) {
        this.menu_controller.handle_input(action);
        continue;
      }
      if (action === input_actions.menu) {
        this.menu_controller.open();
        continue;
      }
      if (!this.turn_system.can_player_act()) {
        continue;
      }

      const directions = {
        [input_actions.move_north]: { x: 0, y: -1 },
        [input_actions.move_south]: { x: 0, y: 1 },
        [input_actions.move_west]: { x: -1, y: 0 },
        [input_actions.move_east]: { x: 1, y: 0 }
      };

      if (directions[action]) {
        const direction = directions[action];
        this.player.facing = direction;
        this.turn_system.try_player_action((now) => this.movement_system.try_move(this.player, direction, now));
      } else if (action === input_actions.attack) {
        this.turn_system.try_player_action((now) => this.combat_system.player_attack(now));
      } else if (action === input_actions.spell_1) {
        this.perform_spell_action("fire_bolt");
      } else if (action === input_actions.spell_2) {
        this.perform_spell_action("healing_light");
      } else if (action === input_actions.spell_3) {
        this.perform_spell_action("frost_nova");
      } else if (action === input_actions.interact || action === input_actions.confirm) {
        this.perform_interaction_action();
      }
    }
  }

  perform_spell_action(spell_id) {
    return this.turn_system.try_player_action((now) => this.magic_system.cast(spell_id, this.player, now));
  }

  perform_item_action(item_id) {
    return this.turn_system.try_player_action(() => this.use_item(item_id));
  }

  perform_interaction_action() {
    if (!this.turn_system.can_player_act()) {
      return false;
    }

    const result = this.interaction_system.interact();
    if (!result?.consumes_turn) {
      return false;
    }

    this.turn_system.commit_player_action(performance.now(), {
      skip_non_player_turns: result.skip_non_player_turns === true
    });
    if (result.skip_non_player_turns === true) {
      this.save_manager.save(this);
    }
    return true;
  }

  is_tile_blocked(x, y, ignored_entity_id = "") {
    return this.entities.some((entity) =>
      entity.alive && entity.entity_id !== ignored_entity_id && entity.type !== "ground_item" && entity.grid_x === x && entity.grid_y === y
    );
  }

  get_living_monsters() {
    return this.entities.filter((entity) => entity.alive && entity.type === "monster");
  }

  get_living_companions() {
    return this.entities.filter((entity) => entity.alive && entity.type === "companion");
  }

  use_item(item_id) {
    const item = item_database[item_id];
    if (!item || item.category !== "consumable") {
      return false;
    }

    if (item.effect === "restore_health" && this.player.health >= this.player.maximum_health) {
      this.add_log("health is already full");
      return false;
    }
    if (item.effect === "restore_magic" && this.player.magic >= this.player.maximum_magic) {
      this.add_log("magic is already full");
      return false;
    }
    if (!this.state.inventory.remove_item(item_id)) {
      return false;
    }

    if (item.effect === "restore_health") {
      const restored = Math.min(item.amount, this.player.maximum_health - this.player.health);
      this.player.health += restored;
      this.add_effect("heal", this.player.grid_x, this.player.grid_y);
      this.add_log(`restored ${restored} health`);
      return true;
    }
    if (item.effect === "restore_magic") {
      const restored = Math.min(item.amount, this.player.maximum_magic - this.player.magic);
      this.player.magic += restored;
      this.add_log(`restored ${restored} magic`);
      return true;
    }

    return false;
  }

  equip_item(item_id) {
    const item = item_database[item_id];
    if (!item) {
      return;
    }
    if (item.category === "weapon") {
      this.state.inventory.equipped_weapon_id = item_id;
      this.add_log(`equipped ${item.name}`);
    } else if (item.category === "accessory") {
      this.state.inventory.equipped_accessory_id = item_id;
      this.add_log(`equipped ${item.name}`);
    }
  }

  advance_floor() {
    this.state.floor += 1;
    this.player.health = Math.min(this.player.maximum_health, this.player.health + 25);
    this.player.magic = Math.min(this.player.maximum_magic, this.player.magic + 20);
    this.pending_player_vitals = { health: this.player.health, magic: this.player.magic };
    this.generate_floor();
    this.save_manager.save(this);
    this.add_log(`you descend to floor ${this.state.floor}`);
  }

  handle_player_defeat() {
    this.paused = true;
    this.add_log("the dungeon claims this run · press escape and generate a new floor");
  }

  add_effect(type, grid_x, grid_y) {
    this.effects.push({ type, grid_x, grid_y, created_at: performance.now() });
  }

  spawn_combat_text(grid_x, grid_y, text) {
    this.combat_texts.push({ grid_x, grid_y, text, created_at: performance.now() });
  }

  add_log(message) {
    const line = document.createElement("div");
    line.className = "log_line";
    line.textContent = message;
    this.message_log.prepend(line);
    while (this.message_log.children.length > game_config.maximum_log_lines) {
      this.message_log.lastElementChild.remove();
    }
  }
}
