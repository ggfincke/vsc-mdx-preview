// tests/webview/create-diagram-container-finder.test.ts
// unit tests for the diagram container finder factory
//
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import {
  createDiagramContainerFinder,
  type BaseDiagramInfo,
} from '../../packages/webview-client/src/features/diagrams/utils/createDiagramContainerFinder';

describe('createDiagramContainerFinder', () => {
  it('finds containers w/ required attributes', () => {
    const finder = createDiagramContainerFinder<BaseDiagramInfo>({
      selector: '.test-container[data-test-code]',
      attributes: { codeAttr: 'data-test-code', idAttr: 'data-test-id' },
    });

    document.body.innerHTML = `
      <div class="test-container" data-test-code="hello" data-test-id="t1"></div>
      <div class="test-container"></div>
    `;

    const found = finder(document.body);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 't1', code: 'hello' });
    expect(found[0].el).toBeInstanceOf(HTMLElement);
  });

  it('skips containers missing code attribute', () => {
    const finder = createDiagramContainerFinder<BaseDiagramInfo>({
      selector: '.test-container[data-test-code]',
      attributes: { codeAttr: 'data-test-code', idAttr: 'data-test-id' },
    });

    document.body.innerHTML = `
      <div class="test-container" data-test-id="t1"></div>
    `;

    expect(finder(document.body)).toHaveLength(0);
  });

  it('skips containers missing id attribute', () => {
    const finder = createDiagramContainerFinder<BaseDiagramInfo>({
      selector: '.test-container[data-test-code]',
      attributes: { codeAttr: 'data-test-code', idAttr: 'data-test-id' },
    });

    document.body.innerHTML = `
      <div class="test-container" data-test-code="hello"></div>
    `;

    expect(finder(document.body)).toHaveLength(0);
  });

  it('finds multiple valid containers', () => {
    const finder = createDiagramContainerFinder<BaseDiagramInfo>({
      selector: '.test-container[data-test-code]',
      attributes: { codeAttr: 'data-test-code', idAttr: 'data-test-id' },
    });

    document.body.innerHTML = `
      <div class="test-container" data-test-code="a" data-test-id="t1"></div>
      <div class="test-container" data-test-code="b" data-test-id="t2"></div>
    `;

    const found = finder(document.body);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ id: 't1', code: 'a' });
    expect(found[1]).toMatchObject({ id: 't2', code: 'b' });
  });

  it('supports extra field extraction w/ validation', () => {
    interface ExtendedInfo extends BaseDiagramInfo {
      lang: 'a' | 'b';
    }

    const finder = createDiagramContainerFinder<ExtendedInfo>({
      selector: '.ext-container[data-ext-code]',
      attributes: { codeAttr: 'data-ext-code', idAttr: 'data-ext-id' },
      extra: {
        extract: (el) => {
          const lang = el.getAttribute('data-ext-lang');
          if (lang === 'a' || lang === 'b') {
            return { lang };
          }
          return null;
        },
      },
    });

    document.body.innerHTML = `
      <div class="ext-container" data-ext-code="ok" data-ext-id="e1" data-ext-lang="a"></div>
      <div class="ext-container" data-ext-code="bad" data-ext-id="e2" data-ext-lang="invalid"></div>
      <div class="ext-container" data-ext-code="ok2" data-ext-id="e3" data-ext-lang="b"></div>
    `;

    const found = finder(document.body);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ id: 'e1', code: 'ok', lang: 'a' });
    expect(found[1]).toMatchObject({ id: 'e3', code: 'ok2', lang: 'b' });
  });

  it('skips element when extra extraction returns null', () => {
    interface WithRequired extends BaseDiagramInfo {
      version: string;
    }

    const finder = createDiagramContainerFinder<WithRequired>({
      selector: '.ver-container[data-ver-code]',
      attributes: { codeAttr: 'data-ver-code', idAttr: 'data-ver-id' },
      extra: {
        extract: (el) => {
          const version = el.getAttribute('data-ver-version');
          if (version) {
            return { version };
          }
          return null;
        },
      },
    });

    document.body.innerHTML = `
      <div class="ver-container" data-ver-code="x" data-ver-id="v1"></div>
    `;

    // missing data-ver-version -> extract returns null -> skipped
    expect(finder(document.body)).toHaveLength(0);
  });
});
