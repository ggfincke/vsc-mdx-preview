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

Import theme CSS via the bridge file in `features/theme/runtime`:

```typescript
import { previewThemes, codeBlockThemes } from '../runtime/css';
```

Do NOT import directly from this directory. The bridge file provides:

- Type safety
- Clear dependency direction
- Future flexibility for lazy loading

## Contents

- **`previewThemes`**: 15+ preview themes (github-light, github-dark, one-dark, etc.)
- **`codeBlockThemes`**: 20+ code block themes with Shiki CSS variables

## Related Files

- `../runtime/css.ts` - Bridge file that re-exports from this directory
- `../runtime/loader.ts` - Injects theme CSS into the DOM
- `../runtime/context.tsx` - React context for theme state
- `../runtime/detection.ts` - VS Code theme detection (light/dark/high-contrast)
