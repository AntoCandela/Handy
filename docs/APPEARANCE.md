# Appearance architecture

The appearance fixture is a test host, not a source of production design tokens.
Its initial color mode and layout live in named fixture constants. Production
appearance uses the following boundaries:

- `src/lib/appearance/definitions.ts`: versioned theme shape, built-in registry,
  named light/dark colors, accents, defaults and preference normalization.
- `src/lib/appearance/resolve.ts`: pure accent resolution and adapters to the
  existing application/preview CSS properties. No DOM, React, storage or Tauri.
- `src/lib/utils/appearance.ts`: compatibility entry point and browser adapter;
  owns persistence, root styles and cross-window events. It clears managed
  overrides before applying a new definition.
- `ThemePreview.tsx`: reusable presentation; consumes the same resolver as the
  actual interface. Settings owns selection and translated labels.

Existing storage uses `handy.appearance.v1`; preset IDs, text sizing and the
removed brutalist migration are unchanged. Classic deliberately inherits the
upstream CSS defaults. Its preview colors mirror those defaults; keep them in
sync when changing upstream Classic CSS. High Contrast and text-size behavior
still include preset-specific CSS. This is a palette abstraction, not yet a
complete replacement for the upstream design system.

## Adding a built-in preset

Add a named entry satisfying `ThemeDefinition` to the registry and supply its
translated name/description. Picker options derive from the registry. Add new
semantic roles to the definition and both adapters together, not as positional
array entries or component-specific colors.

## Future custom themes

`ThemeDefinition.version` establishes an evolution boundary. The resolver already
accepts a definition independently of the built-in ID registry. A future import
feature should add:

1. A runtime parser for unknown JSON with version checks, bounded names and file
   sizes, and an explicit allowlist of color formats. TypeScript types alone do
   not validate a file. Do not accept CSS rules, URLs, scripts or arbitrary style
   property names.
2. A separate custom-definition store and stable IDs, with a migration from the
   current built-in-only preferences. Missing/deleted themes must fall back to
   Classic in both app and overlay. User labels should be rendered as plain text.
3. Registry lookup across built-ins and validated custom definitions, plus live
   preview, contrast checks, import/export and deletion recovery.
4. Explicit treatment of accessibility modes and any new semantic roles (status,
   borders, focus rings, typography), rather than promising that three palette
   colors customize the whole application.

No import UI, arbitrary custom CSS, or custom-theme persistence is enabled by
this refactor. Browser tests cover migration, palette/preview agreement, accent
independence, and a synthetic definition that is not in the built-in registry.
