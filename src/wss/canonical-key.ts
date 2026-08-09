export function canonicalKey(id: any): string {
  return typeof id === 'string' ? id : JSON.stringify(sortKeysDeep(id));
}

function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {} as Record<string, any>);
  }
  return value;
}
