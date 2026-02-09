// tests/shared/plantuml-server.test.ts
// unit tests for PlantUML server constant and runtime URL helpers

import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANTUML_SERVER } from '@mdx-preview/contracts';
import {
  normalizePlantUmlServerUrl,
  getPlantUmlServerOrigin,
  getPlantUmlRenderEndpoints,
} from '@mdx-preview/runtime-utils';

describe('PlantUML server helpers', () => {
  it('normalizes empty input to default server', () => {
    expect(normalizePlantUmlServerUrl('')).toBe(DEFAULT_PLANTUML_SERVER);
  });

  it('normalizes bare host input to https URL', () => {
    expect(normalizePlantUmlServerUrl('kroki.io')).toBe('https://kroki.io');
  });

  it('preserves explicit http server & trims trailing slash', () => {
    expect(normalizePlantUmlServerUrl('http://localhost:8000/')).toBe(
      'http://localhost:8000'
    );
  });

  it('extracts origin for CSP', () => {
    expect(getPlantUmlServerOrigin('https://kroki.io/plantuml')).toBe(
      'https://kroki.io'
    );
  });

  it('builds Kroki fallback endpoints from server root', () => {
    expect(getPlantUmlRenderEndpoints('https://kroki.io')).toEqual([
      'https://kroki.io/plantuml/svg',
      'https://kroki.io/svg',
    ]);
  });

  it('builds PlantUML endpoints from /plantuml base path', () => {
    expect(getPlantUmlRenderEndpoints('https://example.com/plantuml')).toEqual([
      'https://example.com/plantuml/svg',
      'https://example.com/svg',
    ]);
  });

  it('uses direct endpoint when server already points to /svg', () => {
    expect(getPlantUmlRenderEndpoints('https://example.com/custom/svg')).toEqual([
      'https://example.com/custom/svg',
    ]);
  });
});
