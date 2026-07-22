import { create_companion, create_monster_companion } from "../entities/entity_factory.js";
import { distance_between } from "../utils/math.js";

export class RecruitmentSystem {
  constructor(game) {
    this.game = game;
  }

  get_nearby_recruitable() {
    return this.game.entities.find((entity) =>
      entity.alive && entity.type === "recruitable" && !entity.recruited && distance_between(this.game.player, entity) <= 1.5
    ) ?? null;
  }

  recruit(entity) {
    if (entity.recruitment_kind === "monster") {
      return this.recruit_monster(entity);
    }

    if (!this.game.state.party.add_member(entity.character_id)) {
      this.game.add_log("your active team is already full");
      return false;
    }
    if (!this.game.state.unlocked_character_ids.includes(entity.character_id)) {
      this.game.state.unlocked_character_ids.push(entity.character_id);
    }
    entity.recruited = true;
    entity.alive = false;
    const companion = create_companion(entity.character_id, entity.grid_x, entity.grid_y);
    this.game.entities.push(companion);
    this.game.add_log(`${entity.name} joins the team`);
    return true;
  }

  recruit_monster(entity) {
    const member = {
      member_id: entity.character_id,
      monster_id: entity.monster_id,
      name: entity.name,
      archetype: entity.archetype,
      ai_profile: entity.ai_profile,
      maximum_health: entity.maximum_health,
      maximum_magic: entity.maximum_magic,
      attack: entity.attack,
      defence: entity.defence,
      magic_power: entity.magic_power,
      color: entity.color
    };

    if (!this.game.state.party.add_monster_member(member)) {
      this.game.add_log("your active team is already full");
      return false;
    }

    entity.recruited = true;
    entity.alive = false;
    this.game.entities.push(create_monster_companion(member, entity.grid_x, entity.grid_y));
    this.game.add_log(`${entity.name} rises and joins the team`);
    return true;
  }
}
