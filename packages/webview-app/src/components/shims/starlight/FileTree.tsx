// packages/webview-app/src/components/shims/starlight/FileTree.tsx
// Starlight FileTree component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components FileTree

import React, {
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from 'react';
import { extractTextContent } from '../base/extractTextContent';
import { FILE_TREE_ICONS } from '../base/icons';

// file tree props (compatible w/ Starlight)
export interface FileTreeProps {
  children: ReactNode;
}

// internal representation of a file tree entry
interface FileTreeEntry {
  name: string;
  isDirectory: boolean;
  isHighlighted: boolean;
  comment?: string;
  isPlaceholder: boolean;
  children?: FileTreeEntry[];
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
    // check for nested ul (subdirectory)
    if (isValidElement(child) && child.type === 'ul') {
      nestedList = child;
      continue;
    }

    // check for bold (highlighted)
    if (isBoldElement(child)) {
      isHighlighted = true;
      const boldText = extractTextContent(child);
      // bold text is the name, any text after is comment
      const parts = boldText.split(/\s+/);
      name = parts[0] || '';
      if (parts.length > 1) {
        comment = parts.slice(1).join(' ');
      }
      continue;
    }

    // handle plain text
    if (typeof child === 'string') {
      const text = child.trim();
      if (!text) {
        continue;
      }

      if (!name) {
        // first text segment is the name
        const parts = text.split(/\s+/);
        name = parts[0] || '';
        if (parts.length > 1) {
          const restText = parts.slice(1).join(' ');
          comment = comment ? `${comment} ${restText}` : restText;
        }
      } else {
        // additional text is comment
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

  // check for placeholder
  if (name === '...' || name === '…') {
    return {
      name: '...',
      isDirectory: false,
      isHighlighted: false,
      isPlaceholder: true,
    };
  }

  // determine if directory (trailing / or has nested children)
  const isDirectory = name.endsWith('/') || nestedList !== undefined;
  const cleanName = name.endsWith('/') ? name.slice(0, -1) : name;

  // parse nested children if present
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
// handle both nested structure (<li>folder/<ul>...</ul></li>) &
// sibling structure (<li>folder/</li><ul>...</ul>)
function parseFileTreeChildren(children: ReactNode): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];
  const childArray = Children.toArray(children);

  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];

    if (!isValidElement(child)) {
      continue;
    }

    // handle <ul> wrapper - recursively process its children
    if (child.type === 'ul') {
      entries.push(...parseFileTreeChildren(child.props.children));
      continue;
    }

    // handle <li> items
    if (child.type === 'li') {
      const entry = parseLiElement(child);
      if (!entry) {
        continue;
      }

      // check if next sibling is a <ul> that should be this directory's children
      // handle the sibling pattern: <li>folder/</li><ul>...</ul>
      const nextChild = childArray[i + 1];
      if (
        entry.isDirectory &&
        !entry.children?.length &&
        isValidElement(nextChild) &&
        nextChild.type === 'ul'
      ) {
        entry.children = parseFileTreeChildren(nextChild.props.children);
        // skip the <ul> since we've processed it as children
        i++;
      }

      entries.push(entry);
    }
  }

  return entries;
}

// render a single file tree entry
function FileTreeItem({ entry }: { entry: FileTreeEntry }): ReactElement {
  if (entry.isPlaceholder) {
    return (
      <li className="mdx-preview-starlight-file-tree-placeholder">
        <span className="placeholder-dots">...</span>
      </li>
    );
  }

  if (entry.isDirectory) {
    return (
      <li className="mdx-preview-starlight-file-tree-directory">
        <details open>
          <summary className={entry.isHighlighted ? 'highlighted' : ''}>
            <span
              className="icon chevron"
              dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.chevron }}
            />
            <span
              className="icon folder"
              dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.folder }}
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
      className={`mdx-preview-starlight-file-tree-file${entry.isHighlighted ? ' highlighted' : ''}`}
    >
      <span
        className="icon file"
        dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.file }}
      />
      <span className="name">{entry.name}</span>
      {entry.comment && <span className="comment">{entry.comment}</span>}
    </li>
  );
}

// file tree component - render a file/folder tree structure
export function FileTree({ children }: FileTreeProps): ReactElement {
  const entries = parseFileTreeChildren(children);

  return (
    <div className="mdx-preview-starlight-file-tree">
      <ul>
        {entries.map((entry, i) => (
          <FileTreeItem key={i} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

export default FileTree;
