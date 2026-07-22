export class SeededRandom {
  constructor(seed = Date.now()) {
    this.state = Number(seed) >>> 0;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(minimum, maximum) {
    return Math.floor(this.next() * (maximum - minimum + 1)) + minimum;
  }

  pick(values) {
    return values[Math.floor(this.next() * values.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }
}
