export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function distance_between(a, b) {
  return Math.hypot(a.grid_x - b.grid_x, a.grid_y - b.grid_y);
}

export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
