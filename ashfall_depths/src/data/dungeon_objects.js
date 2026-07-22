export const dungeon_object_definitions = Object.freeze({
  pressure_plate: Object.freeze({
    id: "pressure_plate",
    name: "pressure plate",
    minimum_floor: 2,
    weight: 8,
    blocks_movement: false,
    blocks_vision: false,
    placement: "room"
  }),
  spike_trap: Object.freeze({
    id: "spike_trap",
    name: "spike trap",
    minimum_floor: 2,
    weight: 10,
    blocks_movement: false,
    blocks_vision: false,
    placement: "room"
  }),
  explosive_barrel: Object.freeze({
    id: "explosive_barrel",
    name: "explosive barrel",
    minimum_floor: 2,
    weight: 7,
    blocks_movement: false,
    blocks_vision: false,
    placement: "room_static"
  }),
  breakable_urn: Object.freeze({
    id: "breakable_urn",
    name: "breakable urn",
    minimum_floor: 1,
    weight: 11,
    blocks_movement: false,
    blocks_vision: false,
    placement: "room_static"
  }),
  healing_fountain: Object.freeze({
    id: "healing_fountain",
    name: "healing fountain",
    minimum_floor: 1,
    weight: 4,
    blocks_movement: false,
    blocks_vision: false,
    placement: "room_static"
  }),
  lever: Object.freeze({
    id: "lever",
    name: "ancient lever",
    minimum_floor: 3,
    weight: 5,
    blocks_movement: false,
    blocks_vision: false,
    placement: "room_static"
  }),
  locked_door: Object.freeze({
    id: "locked_door",
    name: "locked iron door",
    minimum_floor: 3,
    weight: 5,
    blocks_movement: false,
    blocks_vision: true,
    placement: "corridor"
  }),
  secret_wall: Object.freeze({
    id: "secret_wall",
    name: "secret wall",
    minimum_floor: 4,
    weight: 4,
    blocks_movement: true,
    blocks_vision: true,
    placement: "corridor"
  })
});

export const dungeon_object_list = Object.freeze(Object.values(dungeon_object_definitions));
