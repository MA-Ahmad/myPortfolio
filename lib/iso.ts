const UX = 55.425;
const UY = 32;
const OX = 0.5;
const OY = 256.58;

export function iso(i: number, j: number, k = 0) {
  return {
    x: +(OX + UX * (i - j)).toFixed(2),
    y: +(OY + UY * (i + j - k)).toFixed(2)
  };
}

export function pt(i: number, j: number, k = 0) {
  const { x, y } = iso(i, j, k);
  return `${x} ${y}`;
}

export function poly(points: Array<[number, number, number?]>) {
  return points.map(([i, j, k = 0], index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${command}${pt(i, j, k)}`;
  }).join('') + 'Z';
}
