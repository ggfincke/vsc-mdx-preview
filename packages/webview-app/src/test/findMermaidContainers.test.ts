// packages/webview-app/src/test/findMermaidContainers.test.ts
// unit tests for findMermaidContainers utility

import { describe, it, expect, beforeEach } from 'vitest';
import { findMermaidContainers } from '../utils/findMermaidContainers';

describe('findMermaidContainers', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('finds containers with valid data attributes', () => {
    root.innerHTML = `
      <div class="mermaid-container" data-mermaid-chart="flowchart TD" data-mermaid-id="test-1">
        <div class="mermaid-loading">Loading...</div>
      </div>
    `;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-1');
    expect(results[0].code).toBe('flowchart TD');
    expect(results[0].el).toBeInstanceOf(HTMLElement);
  });

  it('returns empty array when no containers exist', () => {
    root.innerHTML = `<p>No mermaid here</p>`;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(0);
  });

  it('ignores containers missing data-mermaid-chart', () => {
    root.innerHTML = `
      <div class="mermaid-container" data-mermaid-id="test-1">
        Missing chart attribute
      </div>
    `;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(0);
  });

  it('ignores containers missing data-mermaid-id', () => {
    root.innerHTML = `
      <div class="mermaid-container" data-mermaid-chart="flowchart TD">
        Missing id attribute
      </div>
    `;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(0);
  });

  it('ignores elements without mermaid-container class', () => {
    root.innerHTML = `
      <div data-mermaid-chart="flowchart TD" data-mermaid-id="test-1">
        Wrong class
      </div>
    `;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(0);
  });

  it('handles multiple containers', () => {
    root.innerHTML = `
      <div class="mermaid-container" data-mermaid-chart="flowchart TD" data-mermaid-id="id-1"></div>
      <p>Some text</p>
      <div class="mermaid-container" data-mermaid-chart="sequenceDiagram" data-mermaid-id="id-2"></div>
      <div class="mermaid-container" data-mermaid-chart="pie title Test" data-mermaid-id="id-3"></div>
    `;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('id-1');
    expect(results[0].code).toBe('flowchart TD');
    expect(results[1].id).toBe('id-2');
    expect(results[1].code).toBe('sequenceDiagram');
    expect(results[2].id).toBe('id-3');
    expect(results[2].code).toBe('pie title Test');
  });

  it('finds nested containers', () => {
    root.innerHTML = `
      <div class="wrapper">
        <div class="inner">
          <div class="mermaid-container" data-mermaid-chart="graph LR" data-mermaid-id="nested-1"></div>
        </div>
      </div>
    `;

    const results = findMermaidContainers(root);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('nested-1');
  });
});
