# DESIGN_SYSTEM.md — Twenty CRM Architecture & Sizing Specification

This document outlines how styling, sizing, and layout decisions are engineered across the
[`twentyhq/twenty`](https://github.com/twentyhq/twenty) open-source repository.

Twenty uses a strict two-package separation:

1. [`packages/twenty-ui`](https://github.com/twentyhq/twenty/tree/main/packages/twenty-ui) — primitive design tokens (named variables for layout constants such as margins and shades) and atomic elements (buttons, inputs, chips, icons).
2. [`packages/twenty-front`](https://github.com/twentyhq/twenty/tree/main/packages/twenty-front) — composite CRM views (tables, drawer panels, modal dialogs, field inputs).

---

## 1. Core Sizing Foundation: 4px Grid System

Twenty bases spacing, heights, paddings, and margins on a predictable **4-pixel incremental grid**. Instead of arbitrary pixel values, sizing relies on CSS custom properties (reusable stylesheet variables prefixed with `--t-`) injected at the document root.

### Spacing & Layout Scale

The spacing scale is defined in:

- [`packages/twenty-ui/src/theme-constants/theme-light.css`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/theme-light.css)
- [`packages/twenty-ui/src/theme-constants/theme-dark.css`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/theme-dark.css)

| Token | Value | Typical usage |
|---|---:|---|
| `--t-spacing-0-5` | `2px` | Micro-alignments, tag gaps, inline badges |
| `--t-spacing-1` | `4px` | Inner button padding (small), compact icon gaps |
| `--t-spacing-2` | `8px` | Standard input padding, table cell vertical rhythm |
| `--t-spacing-3` | `12px` | Card padding, modal content separation |
| `--t-spacing-4` | `16px` | Container gutters, sidebar section padding |
| `--t-spacing-5` | `20px` | Page header padding |
| `--t-spacing-6` | `24px` | Large panel margins |
| `--t-spacing-8` | `32px` | Empty-state view wrappers |

TypeScript bindings matching these variables live in
[`packages/twenty-ui/src/theme-constants/themeCssVariables.ts`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/themeCssVariables.ts).

---

## 2. Component Sizing Standards

To preserve dense data visibility across large records and CRM tables, Twenty standardizes interactive elements around two primary fixed heights.

### Buttons and Inputs

See the implementation in
[`packages/twenty-ui/src/input/Button/Button.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Button/Button.module.scss).

#### Small

- **Height:** `24px` (`min-height: 24px; max-height: 24px;`)
- **Font size:** `12px` (`var(--t-font-size-sm)`)
- **Horizontal padding:** `0 var(--t-spacing-1)` (`4px`)
- **Purpose:** Inline table actions, tag pickers, breadcrumb chips, compact filter controls.

#### Medium

- **Height:** `32px` (`min-height: 32px; max-height: 32px;`)
- **Font size:** `13px` / `14px` (`var(--t-font-size-md)`)
- **Horizontal padding:** `0 var(--t-spacing-2)` (`8px`)
- **Purpose:** Top navigation action buttons, standard CRM form inputs, modal primary actions.

### Icon Bounding Boxes

Icon assets live in
[`packages/twenty-ui/src/assets/icons/`](https://github.com/twentyhq/twenty/tree/main/packages/twenty-ui/src/assets/icons)
and are mapped through
[`TwentyIconDictionary.ts`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/icon/constants/TwentyIconDictionary.ts).

Twenty uses these bounding sizes:

- `14px` — inline meta indicators (for example, dropdown carets).
- `16px` — standard button and input-prefix icons.
- `20px` / `24px` — main sidebar navigation drawer icons.

---

## 3. Corner Radius Hierarchy

Twenty avoids overly rounded, bubble-like interfaces. It uses subtle radius tokens to keep layouts sharp and utility-first.

Sources:

- [`BorderDark.ts`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme/constants/BorderDark.ts)
- [`BorderLight.ts`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme/constants/BorderLight.ts)

| Token | Value | Typical usage |
|---|---:|---|
| `--t-border-radius-xs` | `2px` | Badges, micro tags |
| `--t-border-radius-sm` | `4px` | Buttons, inputs, menu items, table chips |
| `--t-border-radius-md` | `6px` / `8px` | Dropdown menus, popovers, flyout cards |
| `--t-border-radius-lg` | `12px` | Modals, dialog surfaces |
| `--t-border-radius-pill` | `9999px` | Status pills, avatar status indicators |

---

## 4. Typography Scale

System fonts are prioritized for instant native rendering with zero font layout shift.

Source:
[`FontCommon.ts`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme/constants/FontCommon.ts)

### Font Stack

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```

### Type Scale

| Token | Value | Typical usage |
|---|---:|---|
| `--t-font-size-xs` | `11px` | Field labels, helper micro-copy |
| `--t-font-size-sm` | `12px` | Dense table cell content, compact buttons |
| `--t-font-size-md` | `13px` / `14px` | Body text, standard inputs |
| `--t-font-size-lg` | `16px` | Modal headers, subheadings |
| `--t-font-size-xl` | `18px` / `20px` | Page titles, record titles |

---

## 5. Three-Tier Token Flow & Styling Pattern

Twenty deliberately rejects runtime CSS-in-JS in favor of **typed SCSS modules** (`.module.scss` files with `.module.scss.d.ts` definitions).

Values cascade through three layers:

```text
Tier 1: Raw palette scales
(e.g. GrayScaleLight.ts, AccentLight.ts)
        ↓
Tier 2: Root theme variables
(--t-background-primary, --t-spacing-2 in theme-light.css)
        ↓
Tier 3: Local component custom properties
(--btn-bg, --btn-color inside Button.module.scss)
```

### Why Component-Level Variables (`--btn-*`) Exist

Instead of rewriting compound CSS rules for every hover and focus combination, component stylesheets introduce a local buffer variable:

```scss
/* packages/twenty-ui/src/input/Button/Button.module.scss */

.button {
  height: var(--btn-height, 32px);
  background: var(--btn-bg, transparent);
  border: var(--btn-border-width, 1px) solid var(--btn-border-color, transparent);
  border-radius: var(--btn-radius, var(--t-border-radius-sm));
  color: var(--btn-color, var(--t-font-color-primary));
  font-size: var(--btn-font-size, var(--t-font-size-md));
  padding: 0 var(--btn-padding-x, var(--t-spacing-2));
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

When state changes (hover, focus, disabled, active), the stylesheet updates local variables such as `--btn-bg` or `--btn-border-color` rather than redeclaring entire property rules.

---

## 6. State and Variants via HTML Data Attributes

Twenty avoids class-name explosions such as `.btn-primary`, `.btn-is-focused`, and `.btn-medium`.

Instead, variants, accents, positions, and interactive states are passed into HTML `data-*` attributes on the React element:

```tsx
/* packages/twenty-ui/src/input/Button/Button.tsx */

<button
  className={styles.button}
  data-variant={variant}          // 'primary' | 'secondary' | 'tertiary'
  data-size={size}                // 'small' | 'medium'
  data-accent={accent}            // 'blue' | 'danger' | 'gray'
  data-position={position}        // 'left' | 'middle' | 'right' | 'standalone'
  data-focus={isFocused || undefined}
  data-disabled={disabled || undefined}
>
  {children}
</button>
```

### Button Groups and Border Collapsing

When multiple buttons sit together inside a segmented control or filter group, `data-position` controls radius and border collapsing automatically:

```scss
.button[data-position='left'] {
  --btn-radius: var(--t-border-radius-sm) 0 0 var(--t-border-radius-sm);
  --btn-border-width: 1px 0px 1px 1px;
}

.button[data-position='middle'] {
  --btn-radius: 0;
  --btn-border-width: 1px 0px 1px 0px;
}

.button[data-position='right'] {
  --btn-radius: 0 var(--t-border-radius-sm) var(--t-border-radius-sm) 0;
  --btn-border-width: 1px 1px 1px 0px;
}
```

---

## 7. Master Repository Directory Index

Direct links to inspect the actual source code across the repository are grouped below.

### Design Tokens & Base Themes

- [`theme-light.css`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/theme-light.css) — Light palette variables.
- [`theme-dark.css`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/theme-dark.css) — Dark palette variables.
- [`themeCssVariables.ts`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/themeCssVariables.ts) — TypeScript token keys.
- [`ThemeProvider.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/theme-constants/ThemeProvider.tsx) — Theme context provider.
- [`theme/constants/`](https://github.com/twentyhq/twenty/tree/main/packages/twenty-ui/src/theme/constants) — Raw color palettes (P3/sRGB scales).

### Atomic Input Controls — `packages/twenty-ui/src/input/`

- [`Button.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Button/Button.tsx) & [`Button.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Button/Button.module.scss)
- [`IconButton.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/IconButton/IconButton.tsx) & [`IconButton.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/IconButton/IconButton.module.scss)
- [`Checkbox.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Checkbox/Checkbox.tsx) & [`Checkbox.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Checkbox/Checkbox.module.scss)
- [`Radio.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Radio/Radio.tsx) & [`Radio.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/input/Radio/Radio.module.scss)

### Badges, Tags & Display — `packages/twenty-ui/src/data-display/`

- [`Chip.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Chip/Chip.tsx) & [`Chip.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Chip/Chip.module.scss)
- [`Tag.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Tag/Tag.tsx) & [`Tag.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Tag/Tag.module.scss)
- [`Avatar.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Avatar/Avatar.tsx) & [`Avatar.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Avatar/Avatar.module.scss)
- [`Status.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Status/Status.tsx) & [`Status.module.scss`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-ui/src/data-display/Status/Status.module.scss)

### Composite Layout Surfaces — `packages/twenty-front/src/modules/ui/`

- [`Dropdown.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-front/src/modules/ui/layout/dropdown/components/Dropdown.tsx)
- [`ConfirmationModal.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-front/src/modules/ui/layout/modal/components/ConfirmationModal.tsx)
- [`Table.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-front/src/modules/ui/layout/table/components/Table.tsx)
- [`NavigationDrawer.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-front/src/modules/ui/navigation/navigation-drawer/components/NavigationDrawer.tsx)
- [`ResizablePanelEdge.tsx`](https://github.com/twentyhq/twenty/blob/main/packages/twenty-front/src/modules/ui/layout/resizable-panel/components/ResizablePanelEdge.tsx)

---

## 8. Practical Implementation Rule

> **Never declare hardcoded pixel heights or background hex values inside components.**

Instead:

1. Use a `24px` or `32px` sizing step where appropriate.
2. Bind colors to the `--t-*` theme variables.
3. Toggle component states through `data-*` attributes.
4. Use the shared Twenty UI primitives and tokens before creating new local patterns.

Following this approach keeps the frontend closely aligned with Twenty Core and makes the design system easier to maintain.
