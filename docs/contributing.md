# Contributing to MDX Preview

This document covers the current development workflow for the `vsc-mdx-preview` monorepo.

---

## Prerequisites

- Node.js 18+
- npm 9+
- VS Code 1.90+

---

## Getting Started

```bash
git clone https://github.com/ggfincke/vsc-mdx-preview.git
cd vsc-mdx-preview
npm install
npm run build
```

Open the repository in VS Code and press `F5` to launch an Extension Development Host.

In the development host:

1. Open an `.mdx` or `.md` file
2. Run `MDX: Open MDX Preview`
3. Use `Developer: Open Webview Developer Tools` when you need browser-side debugging

---

## Repo Layout

```text
vsc-mdx-preview/
├── packages/
│   ├── extension-host/   # VS Code extension runtime
│   ├── webview-client/   # React webview app
│   ├── contracts/        # Shared types, enums, constants, RPC contracts
│   ├── runtime-utils/    # Cross-runtime utilities
│   └── codegen/          # Code generation scripts and helpers
├── docs/                 # Public docs
├── examples/             # Example MDX projects
├── schemas/              # Generated config schema
└── tests/                # Production-critical test suite
```

### Extension Host

`packages/extension-host/src/` is organized around:

- `entry/` for activation and lifecycle
- `app/` for service registration and app-level coordination
- `features/` for framework detection, preview orchestration, commands, diagnostics, security, tailwind, and module runtime behavior
- `shared/` for configuration, logging, errors, and extension-only utilities
- `platform/` for RPC glue

### Webview Client

`packages/webview-client/src/` is organized around:

- `entry/` for bootstrapping
- `app/` for providers, state, and shell styles
- `features/preview/` for Safe and Trusted preview rendering
- `features/module-runtime/` for browser-side module loading and cache integration
- `features/diagrams/`, `features/code-block/`, `features/lightbox/`, and `features/theme/` for user-facing subsystems
- `platform/rpc/` for webview RPC wiring
- `generated/` for preload and shim-barrel outputs

---

## Commands

### Core Build and Test

| Script                         | Description                             |
| ------------------------------ | --------------------------------------- |
| `npm run build`                | Build extension and webview             |
| `npm run build:extension`      | Build extension host only               |
| `npm run build:webview-client` | Build webview client directly           |
| `npm run build:webview-app`    | Legacy alias for `build:webview-client` |
| `npm run watch`                | Watch extension host changes            |
| `npm run start:webview-client` | Run the webview Vite dev server         |
| `npm run start:webview-app`    | Legacy alias for `start:webview-client` |
| `npm test`                     | Run the production-critical suite       |
| `npm run test:webview`         | Run webview-focused tests               |
| `npm run test:all`             | Run all configured tests                |
| `npm run test:integration`     | Run VS Code integration tests           |

### Quality and Guardrails

| Script                     | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `npm run lint`             | Run ESLint                                              |
| `npm run lint:fix`         | Auto-fix lint issues                                    |
| `npm run format`           | Run Prettier                                            |
| `npm run format:check`     | Check formatting                                        |
| `npm run deps:check`       | Run dependency-cruiser boundary checks                  |
| `npm run check:generated`  | Verify generated file locations and manifest references |
| `npm run verify:codegen`   | Verify codegen idempotency                              |
| `npm run check:guardrails` | Run the full guardrail set                              |

### Codegen

| Script                      | Description                             |
| --------------------------- | --------------------------------------- |
| `npm run generate:preload`  | Regenerate preload entries              |
| `npm run generate:shims`    | Regenerate shim barrels                 |
| `npm run generate:settings` | Regenerate contributed settings         |
| `npm run generate:schema`   | Regenerate `.mdx-previewrc.json` schema |

---

## Security Model

### Safe Mode

- Default mode when trust requirements are not met
- Compiles MDX to HTML in the extension host
- Sanitizes HTML in the webview with DOMPurify
- Does not execute imported code

### Trusted Mode

Trusted Mode requires all of the following:

1. The workspace is trusted
2. `mdx-preview.preview.enableScripts` is `true`
3. VS Code is not running in a remote environment
4. The document uses a local `file:` scheme, or is `untitled:` in a local workspace

When Trusted Mode is allowed, the extension compiles MDX to JavaScript and the webview evaluates modules through the browser runtime.

---

## Testing

The repository intentionally keeps the test surface small and production-focused.

- `tests/` contains the enforced production-critical suites
- `packages/extension-host/test/__mocks__/vscode.ts` provides VS Code mocks for unit tests
- `vitest.integration.config.ts` runs integration coverage inside a real VS Code environment

See [`../tests/README.md`](../tests/README.md) for the current test philosophy and allowlist.

---

## Code Style

- TypeScript in strict mode
- Prettier: single quotes, semicolons, 2-space indent, 80-column width
- ESLint: custom rules plus project guardrails
- Comments must follow [`../../dev-docs/comment-style.md`](../../dev-docs/comment-style.md)

Important guardrails:

- `npm run check:legacy-paths` blocks deprecated package roots such as `packages/extension` and `packages/webview-app`
- `npm run deps:check` enforces package boundaries with dependency-cruiser
- `npm run check:test-philosophy` enforces the curated test allowlist

---

## Working with mdx-forge

`mdx-forge` is consumed as a normal npm dependency, not as a workspace package.

If you change `mdx-forge` locally and want to test those changes here before publishing, see [`../dev-docs/local-library-dev.md`](../dev-docs/local-library-dev.md).

---

## Before Opening a PR

Run the relevant checks for your change set:

```bash
npm run build
npm test
npm run check:guardrails
```

If you change component registry metadata or generated outputs, also run:

```bash
npm run generate:preload
npm run generate:shims
npm run verify:codegen
```
