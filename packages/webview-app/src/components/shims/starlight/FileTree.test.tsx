// Tests for Starlight FileTree component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileTree } from './FileTree';

describe('FileTree', () => {
  describe('file parsing', () => {
    it('parses simple file list', () => {
      render(
        <FileTree>
          <ul>
            <li>file1.txt</li>
            <li>file2.js</li>
          </ul>
        </FileTree>
      );

      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.js')).toBeInTheDocument();
    });

    it('identifies directories by trailing slash', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>src/</li>
            <li>README.md</li>
          </ul>
        </FileTree>
      );

      // Directory should have the directory class
      const dirItem = container.querySelector('.mdx-preview-starlight-file-tree-directory');
      expect(dirItem).toBeInTheDocument();
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    it('identifies directories by nested ul', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>
              components
              <ul>
                <li>Button.tsx</li>
              </ul>
            </li>
          </ul>
        </FileTree>
      );

      const dirItem = container.querySelector('.mdx-preview-starlight-file-tree-directory');
      expect(dirItem).toBeInTheDocument();
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    });

    it('extracts comments from file entries', () => {
      render(
        <FileTree>
          <ul>
            <li>config.json this is the config</li>
          </ul>
        </FileTree>
      );

      expect(screen.getByText('config.json')).toBeInTheDocument();
      expect(screen.getByText('this is the config')).toBeInTheDocument();
    });

    it('identifies bold (highlighted) entries', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>
              <strong>important.ts</strong>
            </li>
          </ul>
        </FileTree>
      );

      const highlightedFile = container.querySelector(
        '.mdx-preview-starlight-file-tree-file.highlighted'
      );
      expect(highlightedFile).toBeInTheDocument();
    });

    it('handles placeholder entries (...)', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>file.txt</li>
            <li>...</li>
          </ul>
        </FileTree>
      );

      const placeholder = container.querySelector(
        '.mdx-preview-starlight-file-tree-placeholder'
      );
      expect(placeholder).toBeInTheDocument();
    });

    it('handles ellipsis placeholder (…)', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>file.txt</li>
            <li>…</li>
          </ul>
        </FileTree>
      );

      const placeholder = container.querySelector(
        '.mdx-preview-starlight-file-tree-placeholder'
      );
      expect(placeholder).toBeInTheDocument();
    });
  });

  describe('icon rendering', () => {
    it('renders files with file icon', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>document.md</li>
          </ul>
        </FileTree>
      );

      const fileIcon = container.querySelector(
        '.mdx-preview-starlight-file-tree-file .icon.file'
      );
      expect(fileIcon).toBeInTheDocument();
      expect(fileIcon?.innerHTML).toContain('svg');
    });

    it('renders directories with folder icon', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>folder/</li>
          </ul>
        </FileTree>
      );

      const folderIcon = container.querySelector(
        '.mdx-preview-starlight-file-tree-directory .icon.folder'
      );
      expect(folderIcon).toBeInTheDocument();
      expect(folderIcon?.innerHTML).toContain('svg');
    });

    it('renders directories with chevron icon', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>folder/</li>
          </ul>
        </FileTree>
      );

      const chevron = container.querySelector(
        '.mdx-preview-starlight-file-tree-directory .icon.chevron'
      );
      expect(chevron).toBeInTheDocument();
      expect(chevron?.innerHTML).toContain('svg');
    });
  });

  describe('nested structure rendering', () => {
    it('renders nested directories as expandable details', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>
              src
              <ul>
                <li>index.ts</li>
              </ul>
            </li>
          </ul>
        </FileTree>
      );

      const details = container.querySelector(
        '.mdx-preview-starlight-file-tree-directory details'
      );
      expect(details).toBeInTheDocument();
      expect(details).toHaveAttribute('open');
    });

    it('renders multiple levels of nesting', () => {
      render(
        <FileTree>
          <ul>
            <li>
              src
              <ul>
                <li>
                  components
                  <ul>
                    <li>Button.tsx</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </FileTree>
      );

      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('components')).toBeInTheDocument();
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    });

    it('renders comments on directory entries', () => {
      render(
        <FileTree>
          <ul>
            <li>
              src source files
              <ul>
                <li>index.ts</li>
              </ul>
            </li>
          </ul>
        </FileTree>
      );

      expect(screen.getByText('source files')).toBeInTheDocument();
    });
  });

  describe('highlighting', () => {
    it('applies highlighted class to bold file entries', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>
              <strong>selected.ts</strong>
            </li>
          </ul>
        </FileTree>
      );

      expect(
        container.querySelector('.mdx-preview-starlight-file-tree-file.highlighted')
      ).toBeInTheDocument();
    });

    it('applies highlighted class to bold directory summaries', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>
              <strong>highlighted-dir</strong>
              <ul>
                <li>child.ts</li>
              </ul>
            </li>
          </ul>
        </FileTree>
      );

      expect(
        container.querySelector('summary.highlighted')
      ).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty file tree', () => {
      const { container } = render(
        <FileTree>
          <ul></ul>
        </FileTree>
      );

      expect(
        container.querySelector('.mdx-preview-starlight-file-tree')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.mdx-preview-starlight-file-tree-file')
      ).not.toBeInTheDocument();
    });

    it('handles mixed files and directories', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>README.md</li>
            <li>
              src/
              <ul>
                <li>index.ts</li>
              </ul>
            </li>
            <li>package.json</li>
          </ul>
        </FileTree>
      );

      const files = container.querySelectorAll('.mdx-preview-starlight-file-tree-file');
      const dirs = container.querySelectorAll('.mdx-preview-starlight-file-tree-directory');

      expect(files).toHaveLength(3); // README.md, index.ts, package.json
      expect(dirs).toHaveLength(1); // src
    });

    it('handles deeply nested structures (5+ levels)', () => {
      render(
        <FileTree>
          <ul>
            <li>
              a
              <ul>
                <li>
                  b
                  <ul>
                    <li>
                      c
                      <ul>
                        <li>
                          d
                          <ul>
                            <li>
                              e
                              <ul>
                                <li>deep.txt</li>
                              </ul>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </FileTree>
      );

      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.getByText('e')).toBeInTheDocument();
      expect(screen.getByText('deep.txt')).toBeInTheDocument();
    });

    it('applies mdx-preview-starlight-file-tree wrapper class', () => {
      const { container } = render(
        <FileTree>
          <ul>
            <li>file.txt</li>
          </ul>
        </FileTree>
      );

      expect(
        container.querySelector('.mdx-preview-starlight-file-tree')
      ).toBeInTheDocument();
    });
  });
});
