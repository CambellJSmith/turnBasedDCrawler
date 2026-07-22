export const input_actions = Object.freeze({
  move_north: "move_north",
  move_south: "move_south",
  move_west: "move_west",
  move_east: "move_east",
  attack: "attack",
  spell_1: "spell_1",
  spell_2: "spell_2",
  spell_3: "spell_3",
  interact: "interact",
  menu: "menu",
  confirm: "confirm",
  cancel: "cancel",
  previous_tab: "previous_tab",
  next_tab: "next_tab"
});

export const key_bindings = Object.freeze({
  KeyW: input_actions.move_north,
  ArrowUp: input_actions.move_north,
  KeyS: input_actions.move_south,
  ArrowDown: input_actions.move_south,
  KeyA: input_actions.move_west,
  ArrowLeft: input_actions.move_west,
  KeyD: input_actions.move_east,
  ArrowRight: input_actions.move_east,
  Space: input_actions.attack,
  Digit1: input_actions.spell_1,
  Digit2: input_actions.spell_2,
  Digit3: input_actions.spell_3,
  KeyE: input_actions.interact,
  Enter: input_actions.confirm,
  Tab: input_actions.menu,
  Escape: input_actions.menu
});

export const xbox_button_bindings = Object.freeze({
  0: input_actions.confirm,
  1: input_actions.cancel,
  2: input_actions.attack,
  3: input_actions.spell_3,
  4: input_actions.spell_1,
  5: input_actions.spell_2,
  8: input_actions.menu,
  9: input_actions.menu,
  12: input_actions.move_north,
  13: input_actions.move_south,
  14: input_actions.move_west,
  15: input_actions.move_east
});

export const gamepad_config = Object.freeze({
  axis_deadzone: 0.55,
  direction_repeat_delay_ms: 300,
  direction_repeat_interval_ms: 170
});
