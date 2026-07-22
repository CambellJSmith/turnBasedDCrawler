export class PartyState {
  constructor() {
    this.member_ids = ["hero"];
    this.maximum_members = 3;
    this.monster_members = {};
  }

  add_member(character_id) {
    if (this.member_ids.includes(character_id) || this.member_ids.length >= this.maximum_members) {
      return false;
    }
    this.member_ids.push(character_id);
    return true;
  }

  add_monster_member(member) {
    if (!member?.member_id || !member.monster_id || !this.add_member(member.member_id)) {
      return false;
    }
    this.monster_members[member.member_id] = { ...member };
    return true;
  }

  get_monster_member(member_id) {
    return this.monster_members[member_id] ?? null;
  }

  to_json() {
    return {
      member_ids: [...this.member_ids],
      monster_members: Object.fromEntries(
        Object.entries(this.monster_members).map(([member_id, member]) => [member_id, { ...member }])
      )
    };
  }

  load(data) {
    this.member_ids = Array.isArray(data?.member_ids) && data.member_ids.length > 0 ? [...data.member_ids] : ["hero"];
    this.monster_members = data?.monster_members && typeof data.monster_members === "object"
      ? Object.fromEntries(Object.entries(data.monster_members).map(([member_id, member]) => [member_id, { ...member }]))
      : {};
  }
}
