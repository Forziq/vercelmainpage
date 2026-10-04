---
name: The Editorial Folio
colors:
  surface: '#fff8f5'
  surface-dim: '#e0d8d5'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#faf2ee'
  surface-container: '#f4ece8'
  surface-container-high: '#eee7e3'
  surface-container-highest: '#e9e1dd'
  on-surface: '#1e1b19'
  on-surface-variant: '#55423d'
  inverse-surface: '#33302d'
  inverse-on-surface: '#f7efeb'
  outline: '#89726c'
  outline-variant: '#dcc1b9'
  surface-tint: '#9b4427'
  primary: '#5e1700'
  on-primary: '#ffffff'
  primary-container: '#7c2d12'
  on-primary-container: '#ff9b7b'
  inverse-primary: '#ffb59e'
  secondary: '#ac3400'
  on-secondary: '#ffffff'
  secondary-container: '#fd6b36'
  on-secondary-container: '#5d1900'
  tertiary: '#00334f'
  on-tertiary: '#ffffff'
  tertiary-container: '#004b71'
  on-tertiary-container: '#85bbe6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#3a0b00'
  on-primary-fixed-variant: '#7c2d12'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#cbe6ff'
  tertiary-fixed-dim: '#97ccf9'
  on-tertiary-fixed: '#001e30'
  on-tertiary-fixed-variant: '#004b71'
  background: '#fff8f5'
  on-background: '#1e1b19'
  surface-variant: '#e9e1dd'
typography:
  headline-xl:
    fontFamily: EB Garamond
    fontSize: 3.5rem
    fontWeight: '400'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: EB Garamond
    fontSize: 2.25rem
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 2.5rem
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 1.85rem
    fontWeight: '400'
    lineHeight: '1.25'
    letterSpacing: 0em
  headline-md:
    fontFamily: EB Garamond
    fontSize: 1.875rem
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: EB Garamond
    fontSize: 1.35rem
    fontWeight: '500'
    lineHeight: '1.35'
    letterSpacing: 0em
  quote-display:
    fontFamily: EB Garamond
    fontSize: 1.65rem
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: 0em
  body-lg:
    fontFamily: Manrope
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: '1.75'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.65'
    letterSpacing: 0em
  body-sm:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.55'
    letterSpacing: 0.005em
  label-md:
    fontFamily: Manrope
    fontSize: 0.8125rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Manrope
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.75rem
  space-xl: 3rem
---

## Brand & Style

This design system embodies the intellectual clarity, poise, and cadence of an elite literary journal transposed into a modern digital publication. Designed for high-level marketing, sales strategy, and essays, it bridges the analytical precision of growth strategy with the intimacy and timeless authority of classic bookmaking.

The visual style blends refined editorial classicism with sharp architectural minimalism. It rejects transient web trends, excessive drop shadows, and rounded plastic UI in favor of crisp 1-pixel rules, deliberate negative space, and typographic cadence. The experience should evoke the sensation of reading an impeccably set letterpress essay or broadsheet monograph: authoritative, calm, intellectually stimulating, and unmistakably premium.

## Colors

The palette is rooted in historical book publishing materials: archival cream paper, deep carbon ink, and hot iron bookbinding foil.

- **Primary (`#7C2D12`)**: Deep Burnt Amber. Used selectively for key interactive moments, distinguished active states, category flags, and impactful typographic emphasis.
- **Secondary (`#C2410C`)**: Terracotta Ember. Serves as a lively accent for hover highlights, pull-quote keylines, subtle notification pips, and editorial tags.
- **Neutral Surface**: Archival Paper (`#FBFBF9`). Serves as the primary canvas, imparting warmth and eliminating harsh screen glare. Surface shifts use a tinted parchment step (`#F4F1EA`) rather than cold grays.
- **Neutral Ink (`#1C1917`)**: Deep Charcoal Slate. Provides maximum reading comfort with high editorial contrast while avoiding the sterile severity of pure digital black.
- **Border Rules (`#E7E4DC`)**: Low-contrast, hairline rules that define structure without interrupting textual flow.

## Typography

The typographic system relies on deliberate tension between two historical genres:
1. **Headlines and Literary Accents**: Set in `EB Garamond`. Evokes the gravitas of classical letterpress typography, giving titles, pull quotes, and essay subheads an elevated, bookish cadence.
2. **Body, Interface, and Data**: Set in `Manrope`. Provides crisp modern geometric legibility for analytical reading, interface elements, navigational labels, and numeric metrics.

### Typographic Rules
- All uppercase labels (`label-sm`, `label-md`) use expanded letter spacing (+0.06em to +0.1em) for crisp architectural cataloging.
- Longform essay text must default to `body-lg` with a strict max-width of `68ch` to preserve optimal reader focus and line cadence.
- Article introductory paragraphs use `headline-sm` or `body-lg` with italicized opening phrases.

## Layout & Spacing

Layouts follow a structured editorial broadsheet model. Content conforms to a central column grid with asymmetric margins designed to accommodate annotations, references, and margin notes on wider viewports.

### Breakpoints & Flow
- **Desktop (1200px+)**: 12-column layout. Essay bodies occupy a dedicated 7-column span (approx. 680px), flanked by a 3-column peripheral rail for marginalia, footnotes, and publication metadata.
- **Tablet (768px - 1199px)**: 8-column layout. Peripheral notes collapse directly inline beneath relevant sections or into expandable drawer compartments. Margins reduce to `2rem`.
- **Mobile (<768px)**: 4-column single-flow layout. Margins tighten to `1.25rem`. Structural gutters compress to `1rem` to maximize legible line length.

## Elevation & Depth

This design system deliberately eschews skeuomorphic drop shadows and blur filters. Depth and hierarchy are achieved through **crisp architectural layering and hairline boundaries**:

- **Low-Contrast Outlines**: Structure is defined by `1px solid #E7E4DC` hairline rules rather than spatial drop shadows.
- **Tonal Stepping**: Overlay surfaces (such as flyouts, author bios, and search dialogs) use `#F4F1EA` or `#FFFFFF` resting against `#FBFBF9`, framed with a precise 1-pixel border.
- **Print Register Focus**: Active and selected states do not lift off the page; instead, they anchor into the page using crisp double-lines, solid fills in `#7C2D12`, or high-contrast hairline underlines.

## Shapes

The shape geometry is strictly architectural (`0px` border-radius). 

Every button, input field, card, tag, modal, and portrait container terminates in sharp, crisp 90-degree right angles. This strict rectangular geometry reinforces the bookish, editorial discipline of physical print, distinguishing the publication from rounded, generic SaaS software interfaces.

## Components

### Buttons
- **Primary**: Solid `#7C2D12` background, pure `#FFFFFF` typography (`label-md`, uppercase), 0px corner radius. Padding: `0.75rem 1.75rem`. Hover transitions smoothly to `#C2410C`.
- **Secondary**: Transparent background, 1px border in `#1C1917`, text in `#1C1917`. Hover inverts to solid `#1C1917` with white text.
- **Editorial Text Button**: Unbordered, text set in `label-md` uppercase with a persistent 1px hairline underline offset by `4px`. Underline turns `#7C2D12` on hover.

### Inputs & Subscription Forms
- Sharp rectangular containers with a 1px border in `#E7E4DC`, background in `#FFFFFF`.
- Typography in `body-md` (`Manrope`).
- Focus state: Border transitions to a sharp 1px `#7C2D12` border outline with no ambient glow or blur ring.
- Inline Newsletter Module: Flat single-unit group with input flush against a solid `#7C2D12` submit button.

### Cards & Essay Previews
- Minimal borderless cards or cards separated by a single top hairline rule (`1px solid #E7E4DC`).
- Header sets category tag in `label-sm` with `#C2410C` tint.
- Article Title sets in `headline-md` (`EB Garamond`), changing to `#7C2D12` on hover.
- Metadata (reading time, publication date, edition number) separated by middle dots (`·`) in `body-sm`.

### Chips & Topic Tags
- Zero border radius. Rectangular badge bounded by a 1px border (`#E7E4DC`) or flat parchment surface (`#F4F1EA`).
- Set in uppercase `label-sm` with `0.35rem 0.65rem` padding.

### Blockquotes & Pull Quotes
- No rounded speech bubbles. Styled with a prominent left border rule (`2px solid #7C2D12`).
- Set in `quote-display` (`EB Garamond` italic) with generous top and bottom spacing (`space-lg`).

### Lists & Index Directories
- Numbered items use tabular lining numerals set in `EB Garamond` with burnt amber `#7C2D12` tint.
- Horizontal hairline divider (`#E7E4DC`) between each index row.