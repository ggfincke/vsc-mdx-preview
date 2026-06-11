# Theme CSS Data

This directory contains CSS string data for preview and code block themes.

## Architecture

The theme system is intentionally split across two directories for bundle optimization:

- **`features/theme/data`** (this directory) - Contains large CSS strings for theme data
- **`features/theme/runtime`** - Contains logic for theme loading, detection, and React context

### Why Separate?

Large CSS strings are kept separate from implementation logic to:

1. Improve tree-shaking and code splitting
2. Keep business logic modules focused and testable
3. Allow lazy loading of theme CSS when needed

## Usage

Runtime code that injects themes imports the CSS maps directly from this
directory:

```typescript
import { previewThemes, codeBlockThemes } from '../data';
```

Keep direct imports limited to runtime loaders or code that actually needs the
full CSS payloads. General theme code should use runtime hooks and contract
types so large CSS strings stay out of unrelated modules.

This preserves:

- Clear dependency direction
- Focused runtime modules
- Future flexibility for lazy loading

## Contents

- **`previewThemes`**: 16 preview themes
- **`codeBlockThemes`**: 24 code block themes with Shiki CSS variables

## Related Files

- `./index.ts` - Theme CSS string maps
- `../runtime/loader.ts` - Injects theme CSS into the DOM
- `../runtime/context.tsx` - React context for theme state
- `../runtime/detection.ts` - VS Code theme detection (light/dark/high-contrast)
