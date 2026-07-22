const directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function find_next_step(grid, start, target, is_blocked) {
  const start_key = `${start.x},${start.y}`;
  const target_key = `${target.x},${target.y}`;
  const queue = [start];
  const previous = new Map([[start_key, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    const current_key = `${current.x},${current.y}`;
    if (current_key === target_key) {
      break;
    }

    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = `${next.x},${next.y}`;
      if (previous.has(key) || !grid.is_walkable(next.x, next.y)) {
        continue;
      }
      if (key !== target_key && is_blocked(next.x, next.y)) {
        continue;
      }
      previous.set(key, current);
      queue.push(next);
    }
  }

  if (!previous.has(target_key)) {
    return null;
  }

  let current = target;
  let previous_position = previous.get(target_key);
  while (previous_position && `${previous_position.x},${previous_position.y}` !== start_key) {
    current = previous_position;
    previous_position = previous.get(`${current.x},${current.y}`);
  }
  return current;
}
