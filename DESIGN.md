---
name: Redline
description: A printed agreement on a felt desk, with numbered flag tabs stuck on the exact lines that could cost the Signer.
colors:
  desk: "#3f474c"
  desk-deep: "#353c40"
  desk-ink: "#ffffff"
  desk-ink-2: "#c7d0d3"
  desk-card: "rgb(255 255 255 / 0.06)"
  desk-card-hover: "rgb(255 255 255 / 0.1)"
  desk-hairline: "rgb(255 255 255 / 0.14)"
  paper: "#ffffff"
  ink: "#16191b"
  ink-2: "#4b5358"
  rule: "#d9dde0"
  flag: "#d1006f"
  on-flag: "#ffffff"
  tape: "rgb(236 26 140 / 0.26)"
  tape-clear: "rgb(236 26 140 / 0.22)"
  focus: "#6ccff6"
  focus-on-paper: "#0079ab"
  selection: "rgb(108 207 246 / 0.38)"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.4rem + 2.2vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 86"
  display-close:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.2rem + 2.2vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 86"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.2rem + 1.4vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 86"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
  list-heading:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.35
  wordmark:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 112"
  numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "\"wdth\" 112"
  numeral-tab:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "\"wdth\" 110"
  cta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
  lede:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  doc-page:
    fontFamily: "Tinos, \"Times New Roman\", Times, serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
  doc-quote:
    fontFamily: "Tinos, \"Times New Roman\", Times, serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  doc-strip:
    fontFamily: "Tinos, \"Times New Roman\", Times, serif"
    fontSize: "clamp(1.5rem, 1rem + 1.6vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  none: "0px"
spacing:
  2xs: "8px"
  list-gap: "10px"
  xs: "12px"
  sm: "16px"
  md: "20px"
  lg: "32px"
  xl: "48px"
  2xl: "64px"
  section-compact: "72px"
  section: "112px"
  gutter: "clamp(16px, 4vw, 56px)"
components:
  cta-flag:
    backgroundColor: "{colors.flag}"
    textColor: "{colors.on-flag}"
    typography: "{typography.cta}"
    rounded: "{rounded.none}"
    padding: "0 24px 0 0"
    height: "52px"
  flag-card:
    backgroundColor: "{colors.desk-card}"
    textColor: "{colors.desk-ink}"
    rounded: "{rounded.none}"
    padding: "12px 16px 14px"
  flag-card-hover:
    backgroundColor: "{colors.desk-card-hover}"
  flag-card-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  flag-card-tip:
    backgroundColor: "{colors.flag}"
    textColor: "{colors.on-flag}"
    typography: "{typography.numeral}"
    width: "40px"
  page-tab:
    backgroundColor: "{colors.flag}"
    textColor: "{colors.on-flag}"
    typography: "{typography.numeral-tab}"
    width: "54px"
    height: "24px"
  page-tab-compact:
    width: "42px"
  taped-line:
    backgroundColor: "{colors.tape}"
    textColor: "{colors.ink}"
  paper-page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.doc-page}"
    rounded: "{rounded.none}"
    padding: "8% 10% 9%"
    width: "480px"
  proof-strip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.doc-strip}"
    rounded: "{rounded.none}"
    padding: "clamp(24px, 3vw, 40px) clamp(24px, 3.5vw, 48px)"
  paper-slip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 32px"
  wordmark:
    textColor: "{colors.desk-ink}"
    typography: "{typography.wordmark}"
---

# Design System: Redline

## Overview

**Creative North Star: "Page Flags"**

The Document is a printed page lying on a desk, and Redline's findings are flag tabs stuck on the exact lines they come from, numbered by rank. A slate felt blotter owns the ground. On it sit bright white paper objects set in a Times-style contract face. Translucent magenta flag tape is the only loud material, and it always points at a line. Redline speaks in Archivo; the Document speaks in Tinos. Cyan belongs to the reader alone: focus and selection.

The system is built so that a claim can be checked. Every Risk flag has a physical twin on the page: a numbered tab at the edge of the cited line, and a stretch of tape that lays across the Source sentence when the flag is pulled. The ranked list beside the page repeats that Source sentence in the document face, so the Signer can read the same words in both places. Density is calm: one page, one short ranked list, and wide desk around them.

The world refuses the category default of a headline next to a floating dashboard screenshot. It also rules out legal-tech SaaS styling, scare tactics, a chatbot look, and law-firm gravitas (surface brief, confirmed by the user).

**Key Characteristics:**
- Slate felt desk ground, darkened by a fixed noise layer and never lightened.
- White Letter-proportion paper with square corners and a soft three-layer lift.
- Magenta appears only as flags: the opaque tip, the translucent tape, the clear end.
- Two voices: Archivo (variable, wdth axis) for Redline, Tinos for the Document.
- Cyan is reserved for the reader's own marks.
- One signature motion: pull a flag, and its tape wipes across the cited line.

## Colors

A cool slate-and-paper neutral world with one saturated accent, magenta, used only as flag material, and one reserved cyan for the reader.

### Primary
- **Flag Magenta** (flag): the opaque tip of every flag. It fills page-tab tips, ranked-list tips, the right-hand block of the wordmark flag, and the body of the CTA. Numerals on it are white (on-flag) at 5.33:1.
- **Laying Tape** (tape): translucent magenta laid over a cited line on paper. It is a background wipe behind the words, so ink stays readable through it (ink on tape measures 11.78:1).
- **Clear Tape End** (tape-clear): the translucent, unprinted end of a flag. It forms the left segment of page tabs and of the wordmark flag, where the flag sticks down.
- **Tape on Desk** (`--tape-on-desk`, rgb(236 26 140 / 0.42)): declared in globals.css but not used by any built surface yet. It is the stronger tape meant to read against the felt. Treat it as reserved until a surface actually uses it; it is left out of the frontmatter for that reason.

### Tertiary
- **Reader's Cyan** (focus): the 2px focus outline on the desk, offset 3px (5.36:1 on the desk).
- **Reader's Cyan on Paper** (focus-on-paper): the focus outline inside white objects, such as the pulled flag card, where light cyan would disappear (4.86:1 on paper).
- **Reader's Highlight** (selection): text selection everywhere.

### Neutral
- **Slate Felt** (desk): the ground, and the brightest the desk ever gets.
- **Deep Felt** (desk-deep): the scrollbar track only.
- **Desk White** (desk-ink): Redline's primary words on the desk, such as headlines, flag titles and the wordmark (9.47:1).
- **Fog** (desk-ink-2): secondary words on the desk, such as the lede, captions, fineprint, the list heading, inactive Source sentences and the footer. It measures 6.04:1 on the flat base desk, 5.07:1 on an inactive flag card and 4.52:1 on a hovered card.
- **Felt Card** (desk-card) and **Felt Card Hover** (desk-card-hover): the faint white veils behind inactive ranked flags.
- **Desk Hairline** (desk-hairline): 1px rules between sections on the desk. It is written as a literal value in three places, not as a custom property.
- **Paper** (paper): every paper object: the page, the pulled flag card, the proof strip and the limits slip.
- **Ink** (ink): near-black text on paper.
- **Ink Grey** (ink-2): secondary text on paper, such as the running head, the Source sentence in a pulled card, meta lines and strip captions (7.84:1).
- **Paper Rule** (rule): 1px dividers inside paper objects.

### Named Rules
**The Magenta Is a Flag Rule.** Magenta appears only as flag material: tip, tape, clear end, and the 1.5px underline that marks a flagged line that has not been pulled. Headlines, links and body text are never set in magenta, and it is never used as general-purpose emphasis.

**The Reader's Cyan Rule.** Cyan marks only what the reader did: focus and selection. Redline never uses it for its own content.

**The Felt Only Darkens Rule.** Both felt layers are black noise at low alpha, so the desk's brightest point is the base desk color. Every desk contrast figure is measured against that base. A felt layer that lightens, or a desk-card veil above 10% white, breaks the secondary-text floor (Fog on a hovered card is already 4.52:1).

## Typography

**Display Font:** Archivo (variable, with the wdth axis), falling back to system-ui, sans-serif
**Body Font:** Archivo
**Document Font:** Tinos, falling back to "Times New Roman", Times, serif

**Character:** Archivo is Redline's voice. It is heavy and condensed for claims, and expanded for the wordmark and rank numerals. Tinos is the Document's voice, the plain Times of a contractor's template. The pairing lets the reader tell at a glance which words Redline wrote and which it quoted.

### Hierarchy
- **Display** (800, wdth 86, lh 1, -0.02em): the hero headline, balanced wrap. **Display-close** is the same face at a slightly larger clamp, used for the closing question.
- **Headline** (800, wdth 86, lh 1.05, -0.015em): section headings on the desk.
- **Title** (700, 1rem, lh 1.3): Risk flag titles in the ranked list.
- **List heading** (700, 0.9375rem, lh 1.35, Fog): the heading above the ranked list.
- **Lede** (400, 1.125rem, lh 1.5): the one line of support under the hero headline.
- **Body** (400, 1.0625rem, lh 1.55 to 1.6): proof prose, capped at 44ch, and the limits slip.
- **Body-sm** (400, 0.9375rem, lh 1.5): the plain-English note in a pulled flag, and the line under the list.
- **Caption** (400, 0.875rem, lh 1.5): figure captions, fineprint (capped at 36ch) and the footer.
- **Meta** (400, 0.8125rem, Ink Grey): the "Quoted word for word from section N" line.
- **Wordmark / Numerals** (800, wdth 110 to 112): the wordmark and rank numbers on flag tips.
- **Doc-page** (Tinos 400, 12px, lh 1.55; 10.5px at 760px and below): text on the sample page. Headings inside are 700; the agreement title is uppercase with 0.06em tracking, and the running head is 0.8em with 0.04em tracking, all as a printed contract would set them.
- **Doc-quote** (Tinos 400, 0.9375rem, lh 1.45): a Source sentence repeated in the ranked list, in curly quotes.
- **Doc-strip** (Tinos 400, fluid up to 2.5rem, lh 1.35): one Source sentence set large on its own strip of paper.

### Named Rules
**The Two Voices Rule.** Tinos sets only words that come from the Document: the page itself, Source sentences, and the Document's own title and running head. Everything Redline writes, including notes, captions, titles and "Section 3 of the sample agreement", is set in Archivo.

**The Two Widths Rule.** Archivo runs condensed (wdth 86) for display and section headings, expanded (wdth 110 to 112) for the wordmark and rank numerals, and at normal width for anything read as prose.

**The Page Is a Picture Rule.** The page's 12px and 10.5px sizes come from scaling a Letter page down; they are not a text size for reading. Every Source sentence on the page is repeated in the ranked list at 0.9375rem or larger. Never set readable content at page scale anywhere else.

## Layout

A centered shell (max 1360px) with fluid side gutters sits on the desk. Sections are separated by 112px of vertical space and a desk hairline, dropping to 72px at 760px and below. Spacing steps are 8, 12, 16, 20, 32, 48 and 64px, plus 10px between ranked flags.

**Hero, above 1180px:** three columns. The pitch takes min 300px and 1fr, the page 400 to 480px, and the ranked list 280 to 300px, with a 48px gap. The pitch holds the wordmark, headline, lede, CTA and fineprint, all above the fold.

**The Page Scale Rule.** At 1440px the sample page renders 480px wide at Letter proportion (8.5 / 11), about 60% of life size. At full size, the page and the ranked list could not share a 900px first viewport. The page stays as large as the viewport allows beside the list; shrinking it further to make room for anything else is a regression.

**1180px and below:** the pitch spans the full width (max 640px), and the page and list sit side by side beneath it, the list taking 260 to 320px.

**760px and below:** a single column. The page drops its fixed aspect ratio and is **cropped to the flagged sections**: clauses outside the first to last flagged clause are hidden, a pinked cut edge runs along the bottom, and the caption adds "Sections N to M shown." The stage keeps 34px of right padding so the tabs still stick out. The ranked list sits directly under the page.

**Below the hero:** two-column splits at 3fr/2fr (proof) and 2fr/3fr (limits) with a 64px gap. Both collapse to one column with a 32px row gap at 760px.

**Tab placement:** each page tab is placed at the vertical middle of the first line of its cited sentence, measured live. Tabs never sit closer than 30px apart; a crowded tab moves down rather than overlapping. Tabs are ordered by where their lines fall on the page, not by rank.

## Elevation & Depth

Depth is physical. Paper lifts off the felt with a soft three-layer shadow, while tape lies flat and casts nothing. Flag tips carry a small shadow that deepens as the flag is pulled. Every shadow is soft and blurred black; none is a hard offset. The felt adds texture to the ground through two fixed noise layers, a broad mottle and a fine grain, both of which only darken.

### Shadow Vocabulary
- **Paper lift** (`box-shadow: 0 1px 1px rgb(0 0 0 / 0.15), 0 14px 30px -10px rgb(0 0 0 / 0.5), 0 40px 70px -30px rgb(0 0 0 / 0.45)`): the sample page and the proof strip.
- **Slip lift** (`box-shadow: 0 1px 1px rgb(0 0 0 / 0.15), 0 14px 30px -12px rgb(0 0 0 / 0.5)`): the limits slip, a smaller sheet with a shallower shadow.
- **Flag rest / hover / pulled** (`0 1px 2px rgb(0 0 0 / 0.3)` / `0 2px 5px rgb(0 0 0 / 0.34)` / `0 3px 8px rgb(0 0 0 / 0.38)`): page-tab tips.
- **CTA flag rest / hover** (`0 2px 4px rgb(0 0 0 / 0.25), 0 10px 24px -10px rgb(0 0 0 / 0.55)` / `0 3px 6px rgb(0 0 0 / 0.28), 0 14px 28px -10px rgb(0 0 0 / 0.6)`).

### Named Rules
**The Paper Lifts, Tape Lies Flat Rule.** Paper objects cast the paper or slip lift. Tape, clear ends and desk cards have no shadow. Only a flag tip may lift, and only as it is pulled or hovered.

## Shapes

Every corner is square (0px): paper, flags, cards, the CTA and tabs. Silhouettes come from objects, not from rounding. A flag is a rectangle made of two parts, a clear translucent end and an opaque magenta tip. Paper is a Letter-proportion rectangle.

The only irregular edge in the system is the **pinked cut edge**: a 7px zigzag of paper (14px period) along the bottom of a page that has been cropped at 760px and below. It marks that the page continues and that the crop is Redline's, not the Document's. The app icon's 6/32 corner is the operating system's tile, not part of the world.

## Components

### Buttons: the CTA flag
The primary action is a flag, not a pill.
- **Shape:** square, 52px minimum height.
- **Construction:** an 18px clear end on the left (a 30% white veil over the magenta body, since the button is opaque), 20px of space, the label in white at 700, then 24px of right padding.
- **Hover:** the whole flag slides 6px to the right over 240ms on the house ease, and its shadow deepens. **Active:** it rests at 2px. **Focus:** the cyan outline.
- There is no secondary button style yet. Do not invent one inside this world.

### Page tabs
The numbered flags stuck on the page edge.
- **Construction:** 54px by 24px (42px at 760px and below). A 16px clear end overlaps the page by 16px (12px on narrow screens), and the magenta tip carries the rank numeral.
- **Arrival:** tabs stick on in rank order. Each fades in and slides from 24px to its place over 520ms, 120ms apart.
- **Hover / press:** an unpulled tab moves 4px out on hover and 7px on press (2px for both at 760px and below).
- **Pulled:** the tab slides 10px out (4px at 760px and below) over 300ms, and its tip shadow deepens.
- Tabs are a pointer mirror of the ranked list and are hidden from assistive technology. The ranked list's buttons are the keyboard and screen-reader control.

### Taped line (the signature interaction)
- **Unpulled:** the cited sentence carries a 1.5px magenta underline at 60% opacity, offset 3px, so every flagged line shows before it is pulled.
- **Pulled:** translucent tape wipes across the sentence from left to right by growing its background size from 0% to 100% over 380ms on cubic-bezier(0.16, 1, 0.3, 1). At the same time, the underline fades to transparent. Tape wraps with the text across line breaks.
- **Proof strip:** the same tape wipes once over a single large Source sentence when half of it scrolls into view, over 700ms.
- **Reduced motion:** every transition and the tab arrival are removed, so each state appears at its end: tabs already stuck on, tape already laid, the CTA without a slide.

### Ranked flag cards
- **Structure:** a 40px magenta tip column holding the rank numeral, beside a body padded 12px 16px 14px with the title, then the Source sentence in the document face.
- **Inactive:** a felt card veil, desk-white title, Fog Source sentence. **Hover:** the 10% veil over 220ms.
- **Pulled (one at a time):** the card turns to paper with ink text and an Ink Grey Source sentence. A paper rule divides it from the plain-English note and the "Quoted word for word from section N" meta line. The focus outline switches to cyan on paper.
- The title is a real button with aria-expanded; the whole card is clickable.

### Paper objects
- **Sample page:** described under Layout and Typography. It has a running head, an uppercase centered title, bold clause numbers and headings, and the paper lift.
- **Proof strip:** one Source sentence at doc-strip size, with an Archivo caption naming its section.
- **Limits slip:** a sheet of paper holding a ruled list, with 20px vertical padding per item and paper rules between items (no rule after the last).

### Wordmark
"Redline" in Archivo 800 at wdth 112, followed by a 26px by 12px flag: a 9px clear end, then the magenta tip. The app icon uses the same flag on a slate tile.

### Operate surfaces (not yet built)
The signed-in app shell exists only as a brief (`.impeccable/surfaces/app-app-layout-tsx.md`). None of the following is evidenced by a build, and no tokens exist for it yet. Record real values here once it ships.
- **Operate rules win over the world there:** standard controls, one sans (Archivo) for UI, restrained color, and motion of 150 to 250ms that shows state changes only. The pulled-flag slide and tape wipe carry over as state changes; the entrance stagger and the scroll-in wipe do not.
- **Carried from the built world:** the Document as a centered page with Risk flags on its edge at the lines they cite, and the ranked list in a rail beside it. Selecting either one lights the line. The tab, taped-line, flag-card and focus tokens above apply as built.
- **Planned but not built:** Missing protections as outlined flags with no line under them, in their own list, labeled as not in the Document and never placed on the page. Worth a look, Nice to have and Multiplier notes as shorter, quieter tabs, collapsed by default. Red lines as the Signer's own set of flags. Library entries as stacked pages with tabs peeking out. Inputs, navigation and form fields. The outlined flag has no stroke, width or color decided yet, and `--tape-on-desk` has not been assigned to it or to anything else.
- **Page scale in Operate** is unresolved. The landing page's 12px page is a picture (see The Page Is a Picture Rule). A Document the Signer actually reads needs reading-size type, not page scale.

### Named Rules
**The One Pulled Flag Rule.** Exactly one flag is pulled at a time, and flag 1 starts pulled. A pulled flag shows the same state in three places at once: its tab out, its tape on the line, and its card turned to paper.

**The Verbatim Rule.** A flag's Source sentence must appear word for word in the Document it sits on. The sample module throws at build time when a sample flag's sentence is not an exact substring of its clause (ADR-0001). No component may render a Risk flag without its Source sentence.

## Do's and Don'ts

### Do:
- **Do** put every flag on a line: a page tab at the cited line's first-line midpoint, tape across the Source sentence when pulled.
- **Do** repeat each Source sentence in the ranked list in Tinos, in quotation marks, word for word.
- **Do** keep the sample page as large as the first viewport allows beside the ranked list (480px at 1440), and crop it to the flagged sections under a pinked cut edge at 760px and below.
- **Do** use the house ease, cubic-bezier(0.16, 1, 0.3, 1), for every transition, and show end states under reduced motion.
- **Do** measure desk contrast against the flat base desk color, and keep Fog on hovered cards at or above 4.5:1.
- **Do** switch the focus outline to cyan on paper inside white objects.
- **Do** run every user-facing line, including labels, empty states and errors, through the humanizer skill before committing it (CLAUDE.md, Copy). Copy that reads as model-written is a defect.

### Don't:
- **Don't** use magenta for anything other than flag material: no magenta headlines, links, icons or emphasis.
- **Don't** use cyan for Redline's own content; it belongs to focus and selection.
- **Don't** set Redline's own words in Tinos, or the Document's words in Archivo.
- **Don't** round corners on paper, flags, cards or the CTA.
- **Don't** give tape a shadow, or give paper a hard offset shadow.
- **Don't** add a felt layer that lightens the desk, or raise the desk-card veil above 10% white.
- **Don't** show a Risk flag, a tab or tape without its verbatim Source sentence.
- **Don't** put a Missing protection on the page; it cites nothing, so it gets no tab and no tape.
- **Don't** set readable content at the page's scaled-down size outside the page picture.
