# Markdown Tables

A short standalone demo of GFM table rendering & per-column alignment in MDX Preview. Works in **both Safe Mode and Trusted Mode** — no JSX required.

## Project Status

| Item          | Owner   | Status         | Due Date   | Notes                    |
| :------------ | :------ | :------------: | :--------: | :----------------------- |
| Auth refactor | Garrett | 🟡 In progress | 2026-03-05 | Split logic into modules |
| CI pipeline   | Alex    | 🟢 Done        | 2026-02-20 | Added lint + tests       |
| Docs update   | Sam     | 🔴 Blocked     | 2026-03-01 | Waiting on API changes   |

## Alignment Cheatsheet

- Left align: `:---`
- Center align: `:---:`
- Right align: `---:`

Example alignment row:

| Left | Center | Right |
| :--- | :----: | ----: |
| a    |   b    |     c |

For more complex tables (column attributes, colgroups, multi-row headers) write the table as JSX in MDX — see [`../html-support/`](../html-support/README.mdx) for HTML pass-through in Safe Mode.
