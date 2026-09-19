# Editorial Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive editorial portfolio homepage that presents Egor's CV-backed experience and future case-study structure while keeping the game as a temporary standalone link.

**Architecture:** Keep the repository as a dependency-free static website. Replace only `index.html` with semantic HTML, embedded design tokens and responsive CSS; preserve `game.html` and the CV exactly as they are.

**Tech Stack:** HTML5, CSS3, minimal browser JavaScript only if needed, Python standard-library validation, local HTTP server.

**Spec:** `docs/superpowers/specs/2026-09-19-editorial-portfolio-design.md`

## Global Constraints

- Course copy must read "BSc Digital Business & E-commerce" and "2026-2030".
- Neon Dodge must not appear as a CV item, featured project, or case study.
- The temporary "Play Game" action must link to `game.html`.
- All experience claims must be grounded in `Egor_Grigorciuc_CV.pdf`.
- Follow the color, typography, square geometry, hairline-rule, and responsive-layout principles in `deisgn.md`.
- Do not add a framework, package manager, dependency, or build step.
- Do not modify `game.html` or `Egor_Grigorciuc_CV.pdf`.

---

### Task 1: Rebuild the editorial homepage

**Files:**
- Modify: `index.html`
- Preserve: `game.html`
- Preserve: `Egor_Grigorciuc_CV.pdf`

**Interfaces:**
- Consumes: the copy requirements in the approved spec and visual tokens in `deisgn.md`.
- Produces: a standalone `index.html` whose navigation targets are `#profile`, `#work`, `#experience`, `#capabilities`, and `#contact`; every "Play Game" action targets `game.html`.

- [ ] **Step 1: Run a failing content assertion against the current homepage**

```bash
python3 -c "from pathlib import Path; s=Path('index.html').read_text(); assert 'BSc Digital Business &amp; E-commerce' in s and '2026-2030' in s and 'NexusCloud.ie' in s and 'Jana Bake' in s"
```

Expected: FAIL because the current homepage contains placeholder projects and does not include the approved degree and professional content.

- [ ] **Step 2: Replace the homepage with the approved semantic structure**

Use a body-level skip link targeting `#main`, followed by a `header.site-header`, `main#main`, and `footer#contact`. Inside the main landmark, create the sections `section.hero[aria-labelledby="hero-title"]`, `section#profile[aria-labelledby="profile-title"]`, `section#work[aria-labelledby="work-title"]`, `section#experience[aria-labelledby="experience-title"]`, and `section#capabilities[aria-labelledby="capabilities-title"]` in that order and add no other content sections.

The header contains Egor's wordmark, anchor navigation, and `<a href="game.html">Play Game</a>`. The hero states that Egor works where digital business, customer experience, and practical execution meet. The profile identifies TU Dublin and the exact degree/date copy from the global constraints.

The selected-work section contains exactly two case-study previews:

```html
<article class="case-study">
  <p class="case-study__index">01 / Jana Bake</p>
  <h3>Customer experience, content &amp; operations</h3>
  <p>Customer enquiries, custom orders, product photography, promotional content, and day-to-day support for a busy family bakery.</p>
  <span class="case-study__status">Case study coming soon</span>
</article>
<article class="case-study">
  <p class="case-study__index">02 / NexusCloud.ie</p>
  <h3>Business development &amp; customer communication</h3>
  <p>Prospect conversations, tailored explanations, organised follow-ups, and independently maintained customer records.</p>
  <span class="case-study__status">Case study coming soon</span>
</article>
```

The experience timeline repeats the CV dates `2021-Present` and `2025-2026`. The capabilities list uses only the approved skills. The footer contains the CV-backed email address and a second `game.html` link.

Implement `:root` design tokens for the archival paper, parchment, charcoal, amber, terracotta, and hairline colors. Load EB Garamond and Manrope from Google Fonts with serif/sans-serif fallbacks. Use square corners, no box shadows, visible `:focus-visible` treatment, a 12-column desktop composition, single-column mobile flow below 768px, and a `prefers-reduced-motion` override.

- [ ] **Step 3: Run content and link assertions**

```bash
python3 -c "from pathlib import Path; from html.parser import HTMLParser; s=Path('index.html').read_text(); assert 'BSc Digital Business &amp; E-commerce' in s; assert '2026-2030' in s; assert s.count('Case study coming soon') == 2; assert 'Project Name' not in s; assert 'Neon Dodge' not in s; assert s.count('href=\"game.html\"') >= 2; HTMLParser().feed(s)"
```

Expected: PASS with no output.

- [ ] **Step 4: Verify local files referenced by the homepage**

```bash
python3 -c "from pathlib import Path; assert Path('index.html').is_file(); assert Path('game.html').is_file(); assert Path('Egor_Grigorciuc_CV.pdf').is_file()"
```

Expected: PASS with no output.

- [ ] **Step 5: Confirm protected files are unchanged**

```bash
git diff --exit-code -- game.html
git diff --exit-code -- Egor_Grigorciuc_CV.pdf
```

Expected: both commands exit successfully with no output.

- [ ] **Step 6: Commit the homepage implementation**

```bash
git add index.html
git commit -m "feat: build editorial portfolio homepage"
```

### Task 2: Perform final static-site verification

**Files:**
- Verify: `index.html`
- Verify: `game.html`

**Interfaces:**
- Consumes: the completed static homepage from Task 1.
- Produces: evidence that both routes respond locally and the final source contains no placeholders or broken local targets.

- [ ] **Step 1: Start a local static server**

```bash
python3 -m http.server 8000
```

Expected: the process remains active and serves the repository root.

- [ ] **Step 2: Request both required pages**

```bash
curl --fail --silent --show-error http://127.0.0.1:8000/index.html >/dev/null
curl --fail --silent --show-error http://127.0.0.1:8000/game.html >/dev/null
```

Expected: both requests return HTTP 200.

- [ ] **Step 3: Scan the final homepage for forbidden placeholder text**

```bash
python3 -c "from pathlib import Path; s=Path('index.html').read_text(); banned=['Project'+' Name','title '+'goes here','href=\"#\"','T'+'BD','T'+'ODO']; assert not [x for x in banned if x in s]"
```

Expected: no matches.

- [ ] **Step 4: Review the final diff and repository state**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only pre-existing untracked source documents may remain.
