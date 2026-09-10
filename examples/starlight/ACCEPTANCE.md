# Starlight compatibility fixture

This is a minimal reproduction of issue #133's routing failure, not the
reporter's original project. Dependencies are pinned to Starlight 0.42.0 and
its declared Astro/markdown peers.

Open shim-compatibility.mdx in a trusted VS Code workspace with scripts enabled.
Preview it with framework auto, starlight, and generic: icons, link buttons,
and both tab panels must work. With componentShims disabled, an unsupported
Astro import must produce actionable guidance rather than a Babel syntax error.
A relative custom .astro import must explain the React/MDX replacement path.

Safe Mode must remain non-executing. Record installed VSIX hash, VS Code version,
results, and any limitations in the shared v2-mdx-studio ledger.
