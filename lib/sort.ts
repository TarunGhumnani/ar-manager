/** Sorts rows by the accessor named `key`. Strings compare case-insensitively. */
export function sortRows<T>(
  rows: T[],
  accessors: Record<string, (r: T) => string | number | null>,
  key: string,
  dir: string,
): T[] {
  const get = accessors[key];
  if (!get) return rows;
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y, 'en', { sensitivity: 'base' }) * sign;
    return (x < y ? -1 : 1) * sign;
  });
}
