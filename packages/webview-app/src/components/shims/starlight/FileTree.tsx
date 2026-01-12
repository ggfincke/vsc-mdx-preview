// packages/webview-app/src/components/shims/starlight/FileTree.tsx
// Starlight FileTree component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components FileTree

import React, {
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from 'react';

// file tree props (compatible w/ Starlight)
export interface FileTreeProps {
  children: ReactNode;
}

// Internal representation of a file tree entry
interface FileTreeEntry {
  name: string;
  isDirectory: boolean;
  isHighlighted: boolean;
  comment?: string;
  isPlaceholder: boolean;
  children?: FileTreeEntry[];
}

// SVG icons
const CHEVRON_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

const FOLDER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

const FILE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';

// extract text content from React children
function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }
  if (isValidElement(node)) {
    return extractTextContent(node.props.children);
  }
  return '';
}

// check if a child is a bold element (strong)
function isBoldElement(node: ReactNode): boolean {
  if (!isValidElement(node)) {
    return false;
  }
  return node.type === 'strong' || node.type === 'b';
}

// parse li element content to extract name, highlight status, & comment
function parseLiContent(children: ReactNode): {
  name: string;
  isHighlighted: boolean;
  comment?: string;
  nestedList?: ReactNode;
} {
  const childArray = Children.toArray(children);
  let name = '';
  let isHighlighted = false;
  let comment: string | undefined;
  let nestedList: ReactNode | undefined;

  for (const child of childArray) {
    // Check for nested ul (subdirectory)
    if (isValidElement(child) && child.type === 'ul') {
      nestedList = child;
      continue;
    }

    // Check for bold (highlighted)
    if (isBoldElement(child)) {
      isHighlighted = true;
      const boldText = extractTextContent(child);
      // Bold text is the name, any text after is comment
      const parts = boldText.split(/\s+/);
      name = parts[0] || '';
      if (parts.length > 1) {
        comment = parts.slice(1).join(' ');
      }
      continue;
    }

    // Handle plain text
    if (typeof child === 'string') {
      const text = child.trim();
      if (!text) {
        continue;
      }

      if (!name) {
        // First text segment is the name
        const parts = text.split(/\s+/);
        name = parts[0] || '';
        if (parts.length > 1) {
          const restText = parts.slice(1).join(' ');
          comment = comment ? `${comment} ${restText}` : restText;
        }
      } else {
        // Additional text is comment
        comment = comment ? `${comment} ${text}` : text;
      }
    }
  }

  return { name, isHighlighted, comment, nestedList };
}

// parse a single <li> element into a FileTreeEntry
function parseLiElement(li: ReactElement): FileTreeEntry | null {
  const { name, isHighlighted, comment, nestedList } = parseLiContent(
    li.props.children
  );

  if (!name) {
    return null;
  }

  // Check for placeholder
  if (name === '...' || name === '…') {
    return {
      name: '...',
      isDirectory: false,
      isHighlighted: false,
      isPlaceholder: true,
    };
  }

  // Determine if directory (trailing / or has nested children)
  const isDirectory = name.endsWith('/') || nestedList !== undefined;
  const cleanName = name.endsWith('/') ? name.slice(0, -1) : name;

  // Parse nested children if present
  let entryChildren: FileTreeEntry[] | undefined;
  if (nestedList && isValidElement(nestedList)) {
    entryChildren = parseFileTreeChildren(nestedList.props.children);
  }

  return {
    name: cleanName,
    isDirectory,
    isHighlighted,
    comment: comment || undefined,
    isPlaceholder: false,
    children: entryChildren,
  };
}

// parse children (unordered list) into structured entries
function parseFileTreeChildren(children: ReactNode): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    // Handle <ul> wrapper
    if (child.type === 'ul') {
      entries.push(...parseFileTreeChildren(child.props.children));
      return;
    }

    // Handle <li> items
    if (child.type === 'li') {
      const entry = parseLiElement(child);
      if (entry) {
        entries.push(entry);
      }
    }
  });

  return entries;
}

// render a single file tree entry
function FileTreeItem({ entry }: { entry: FileTreeEntry }): ReactElement {
  if (entry.isPlaceholder) {
    return (
      <li className="starlight-file-tree-placeholder">
        <span className="placeholder-dots">...</span>
      </li>
    );
  }

  if (entry.isDirectory) {
    return (
      <li className="starlight-file-tree-directory">
        <details open>
          <summary className={entry.isHighlighted ? 'highlighted' : ''}>
            <span
              className="icon chevron"
              dangerouslySetInnerHTML={{ __html: CHEVRON_ICON }}
            />
            <span
              className="icon folder"
              dangerouslySetInnerHTML={{ __html: FOLDER_ICON }}
            />
            <span className="name">{entry.name}</span>
            {entry.comment && <span className="comment">{entry.comment}</span>}
          </summary>
          {entry.children && entry.children.length > 0 && (
            <ul>
              {entry.children.map((child, i) => (
                <FileTreeItem key={i} entry={child} />
              ))}
            </ul>
          )}
        </details>
      </li>
    );
  }

  return (
    <li
      className={`starlight-file-tree-file${entry.isHighlighted ? ' highlighted' : ''}`}
    >
      <span
        className="icon file"
        dangerouslySetInnerHTML={{ __html: FILE_ICON }}
      />
      <span className="name">{entry.name}</span>
      {entry.comment && <span className="comment">{entry.comment}</span>}
    </li>
  );
}

// file tree component - renders a file/folder tree structure
export function FileTree({ children }: FileTreeProps): ReactElement {
  const entries = parseFileTreeChildren(children);

  return (
    <div className="starlight-file-tree">
      <ul>
        {entries.map((entry, i) => (
          <FileTreeItem key={i} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

export default FileTree;
