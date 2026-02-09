# Theme CSS Data

This directory contains CSS string data for preview and code block themes.

## Architecture

The theme system is intentionally split across two directories for bundle optimization:

- **`/themes/`** (this directory) - Contains large CSS strings for theme data
- **`/theme/`** - Contains logic for theme loading, detection, and React context

### Why Separate?

Large CSS strings are kept separate from implementation logic to:
1. Improve tree-shaking and code splitting
2. Keep business logic modules focused and testable
3. Allow lazy loading of theme CSS when needed

## Usage

Import theme CSS via the bridge file in `/theme/`:

```typescript
import { previewThemes, codeBlockThemes } from '../theme/css';
```

Do NOT import directly from this directory. The bridge file provides:
- Type safety
- Clear dependency direction
- Future flexibility for lazy loading

## Contents

- **`previewThemes`**: 15+ preview themes (github-light, github-dark, one-dark, etc.)
- **`codeBlockThemes`**: 20+ code block themes with Shiki CSS variables

## Related Files

- `/theme/css.ts` - Bridge file that re-exports from this directory
- `/theme/loader.ts` - Injects theme CSS into the DOM
- `/theme/context.tsx` - React context for theme state
- `/theme/detection.ts` - VS Code theme detection (light/dark/high-contrast)
