// tests/webview/diagram-containers.test.ts
// unit tests for diagram container DOM discovery helpers
//
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { findMermaidContainers } from '../../packages/webview-app/src/utils/findMermaidContainers';
import { findPlantUMLContainers } from '../../packages/webview-app/src/utils/findPlantUMLContainers';
import { findGraphvizContainers } from '../../packages/webview-app/src/utils/findGraphvizContainers';

describe('diagram container finders', () => {
  it('finds Mermaid containers w/ required attributes', () => {
    document.body.innerHTML = `
      <div class="mermaid-container" data-mermaid-chart="graph TD;A-->B" data-mermaid-id="m1"></div>
      <div class="mermaid-container"></div>
    `;

    const found = findMermaidContainers(document.body);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: 'm1',
      code: 'graph TD;A-->B',
    });
  });

  it('finds PlantUML containers w/ required attributes', () => {
    document.body.innerHTML = `
      <div class="plantuml-container" data-plantuml-code="@startuml" data-plantuml-id="p1"></div>
      <div class="plantuml-container"></div>
    `;

    const found = findPlantUMLContainers(document.body);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: 'p1',
      code: '@startuml',
    });
  });

  it('finds Graphviz containers w/ language metadata', () => {
    document.body.innerHTML = `
      <div class="graphviz-container" data-graphviz-code="digraph G { A -> B }" data-graphviz-id="g1" data-graphviz-language="dot"></div>
      <div class="graphviz-container" data-graphviz-code="digraph G {}" data-graphviz-id="g2" data-graphviz-language="invalid"></div>
    `;

    const found = findGraphvizContainers(document.body);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: 'g1',
      code: 'digraph G { A -> B }',
      language: 'dot',
    });
  });
});
