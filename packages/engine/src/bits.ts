import { CELLS, H, W } from "./map.ts";

export function bit(cell: number): bigint {
  return 1n << BigInt(cell);
}

export const ALL = (1n << BigInt(CELLS)) - 1n;
export const COL0 = Array.from({ length: H }, (_, y) => bit(y * W)).reduce(
  (mask, cellBit) => mask | cellBit,
  0n,
);
export const COL11 = Array.from({ length: H }, (_, y) => bit(y * W + W - 1)).reduce(
  (mask, cellBit) => mask | cellBit,
  0n,
);

export function neighbors(mask: bigint): bigint {
  return (
    ((mask >> 12n) | ((mask << 12n) & ALL) | ((mask & ~COL11) << 1n) | ((mask & ~COL0) >> 1n)) & ALL
  );
}

export function reach(mask: bigint, steps: number, walk: bigint): bigint {
  let result = mask & walk;
  for (let step = 0; step < steps; step += 1) {
    result |= neighbors(result) & walk;
  }
  return result & walk;
}

export function plus(cell: number): bigint {
  return bit(cell) | neighbors(bit(cell));
}

export function isOneHot(mask: bigint): boolean {
  return mask > 0n && mask <= ALL && (mask & (mask - 1n)) === 0n;
}

export function cellOf(mask: bigint): number {
  if (!isOneHot(mask)) return -1;
  let low = 0;
  let high = CELLS - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    const lowerBits = (1n << BigInt(middle + 1)) - 1n;
    if ((mask & lowerBits) !== 0n) high = middle;
    else low = middle + 1;
  }
  return low;
}

export function popcount(mask: bigint): number {
  let count = 0;
  let remaining = mask;
  while (remaining !== 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }
  return count;
}
