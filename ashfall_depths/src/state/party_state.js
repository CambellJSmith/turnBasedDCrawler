export class PartyState {
  constructor() {
    this.member_ids = ["hero"];
    this.maximum_members = 3;
  }

  add_member(character_id) {
    if (this.member_ids.includes(character_id) || this.member_ids.length >= this.maximum_members) {
      return false;
    }
    this.member_ids.push(character_id);
    return true;
  }

  to_json() {
    return { member_ids: [...this.member_ids] };
  }

  load(data) {
    this.member_ids = Array.isArray(data?.member_ids) && data.member_ids.length > 0 ? [...data.member_ids] : ["hero"];
  }
}
