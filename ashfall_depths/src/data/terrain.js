export const terrain_database = Object.freeze({
  void: { id: "void", name: "void", walkable: false, floor_color: "#090a0e" },
  stone_floor: { id: "stone_floor", name: "worn stone", walkable: true, floor_color: "#323947" },
  cracked_floor: { id: "cracked_floor", name: "cracked stone", walkable: true, floor_color: "#3c3742" },
  wall: { id: "wall", name: "dungeon wall", walkable: false, floor_color: "#252a35" },
  exit: { id: "exit", name: "descent gate", walkable: true, floor_color: "#66552e" }
});
