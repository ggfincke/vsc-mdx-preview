const GENERIC_COMPONENTS = {
  Callout: { aliases: ['Alert', 'Admonition'] },
  Collapsible: { aliases: ['Accordion', 'Details'] },
  Tabs: { aliases: [] },
  TabItem: { aliases: ['Tab'] },
  CodeGroup: { aliases: [] },
} as const;

let cachedAllGenericNames: string[] | null = null;
let cachedGenericSet: Set<string> | null = null;

export function getAllGenericComponentNames(): string[] {
  if (cachedAllGenericNames === null) {
    const names: string[] = [];
    for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
      names.push(name, ...config.aliases);
    }
    cachedAllGenericNames = names;
  }
  return cachedAllGenericNames;
}

export function getGenericComponentSet(): Set<string> {
  if (cachedGenericSet === null) {
    cachedGenericSet = new Set(getAllGenericComponentNames());
  }
  return cachedGenericSet;
}

export function getGenericComponentAliases(
  name: keyof typeof GENERIC_COMPONENTS
): readonly string[] {
  return GENERIC_COMPONENTS[name].aliases;
}
