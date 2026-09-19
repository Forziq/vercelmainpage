# Editorial Portfolio Design

## Purpose

Create a polished personal blog and portfolio for Egor Grigorciuc. The site should present Egor as a BSc Digital Business & E-commerce student with practical customer experience, content, operations, and business-development experience. It must also provide a simple structure that can later expand into detailed project case-study pages.

## Source material

The site content is derived from Egor's CV and the repository's `deisgn.md` design system. It must not imply achievements, metrics, responsibilities, or technical experience that are absent from those sources.

Neon Dodge is not a CV or portfolio project on this version of the site. It is accessible only through a temporary "Play Game" action that links to `game.html`.

## Content architecture

The homepage is a single responsive document with these sections:

1. Header with Egor's name, section navigation, and the temporary "Play Game" button.
2. Editorial hero introducing Egor and the intersection of digital business, customer experience, and practical execution.
3. Profile section identifying the course as "BSc Digital Business & E-commerce" at TU Dublin, 2026-2030.
4. Selected work section with two grounded case-study previews:
   - Jana Bake: customer communication, custom-order support, product photography, promotional content, and day-to-day business support.
   - NexusCloud.ie: business development, prospect communication, follow-ups, and customer-record organisation.
5. Experience timeline giving concise roles and dates.
6. Capabilities section covering customer service, communication, organisation, teamwork, problem-solving, content creation, and independent work.
7. Contact/footer area with CV-backed contact information and a second temporary link to `game.html`.

The work previews use a reusable card pattern. Their calls to action are visibly marked as future case studies rather than linking to missing pages. This prepares the site for later pages without creating dead navigation.

## Visual design

Follow `deisgn.md` closely:

- Archival cream and parchment surfaces with deep charcoal text.
- Burnt amber as the primary accent and terracotta for hover or secondary emphasis.
- EB Garamond for editorial headings and Manrope for body and interface text, with robust system-font fallbacks.
- Sharp rectangular geometry with no rounded cards or buttons.
- Hairline rules, tonal surface changes, generous whitespace, and no drop shadows.
- A restrained broadsheet layout with asymmetric editorial composition on large screens and a single reading flow on mobile.
- Small uppercase labels with expanded tracking, readable long-form widths, and tabular date styling.

The result should feel like a premium literary-business publication rather than a generic developer template.

## Interaction and accessibility

- All navigation uses real anchors or real pages.
- "Play Game" navigates to `game.html`.
- Future case-study actions are non-link status labels until detail pages exist.
- Keyboard focus is clearly visible.
- Semantic headings, landmarks, lists, and descriptive labels are used throughout.
- Color contrast remains readable across all surfaces.
- Motion is subtle and disabled when reduced motion is requested.
- The layout remains usable on narrow mobile screens and large desktops.

## Technical approach

Preserve the repository as a lightweight static site. Replace the current homepage implementation in `index.html`; keep `game.html` unchanged. Use embedded CSS and minimal progressive JavaScript only if it materially improves navigation. No framework or build step is required.

## Verification

Before completion:

- Confirm the homepage and game page exist and are connected by the required links.
- Check that there are no placeholder project names, invented claims, or dead links.
- Verify the course text reads "BSc Digital Business & E-commerce" and "2026-2030".
- Validate local asset references and JavaScript syntax.
- Check responsive styles at mobile, tablet, and desktop widths through source-level rules and a local server response.
- Confirm the final diff does not modify `game.html` or the CV.
