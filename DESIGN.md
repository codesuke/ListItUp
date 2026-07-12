---
version: "listitup-design-reference-2026-06-26"
name: "ListItUp"
description: "ListItUp uses a compact operational interface style derived from the sample HTML reference. Key features include clear information density, modular panels, ambient canvas motion, technical label language, and strong contrast."
colors:
  primary: "#FF6B4A"
  secondary: "#333333"
  accent: "#FF8A70"
  background: "#E5E5E0"
  surface: "#333333"
  text-primary: "#111827"
  text-secondary: "#4B5563"
  border: "#333333"
typography:
  display-lg:
    fontFamily: "Inter"
    fontSize: "64px"
    fontWeight: 500
    lineHeight: "1.04"
    letterSpacing: "0"
  body-md:
    fontFamily: "JetBrains Mono"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.6"
  label-md:
    fontFamily: "JetBrains Mono"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "1.2"
spacing:
  base: "8px"
  gap: "16px"
  card-padding: "24px"
  section-padding: "80px"
rounded:
  card: "8px"
  control: "8px"
  pill: "9999px"
components:
  card:
    background: "Use the surface token with subtle borders and HTML-matched shadow depth"
    radius: "Match the declared card radius token"
  button:
    background: "Use primary or accent colors for the main action"
    radius: "Use the control or pill radius based on the source HTML"
---

# ListItUp Design System

Source reference: `sample.html`.

The current UI direction is derived from the Nexus Protocol reference component and adapted for ListItUp. Treat `sample.html` as the visual implementation reference and this file as the design contract.

Tags: dashboard, animated, canvas, dense interface, operational UI, lists, capture, archive, workspace.

## Overview

ListItUp should use a focused, dark operational workspace style. The UI should feel structured, fast, and serious without becoming heavy. The interface should emphasize immediate capture, scannable lists, compact navigation groups, subtle borders, ambient motion, and clear hierarchy.

## Composition

Use `sample.html` as the source of truth for visual composition. Preserve the first-screen layout rhythm: a strong left intro/capture panel, dense right-side grouped navigation, a narrow operational status strip, and a grounded footer row.

Future app screens do not need to copy this exact landing composition, but they should preserve the same density, border language, motion restraint, and technical calm.

## Colors

Anchor the palette in primary #FF6B4A, secondary #333333, accent #FF8A70, background #E5E5E0, surface #333333, text-primary #111827. Keep background, surface, text, and border roles distinct so generated layouts retain the same contrast pattern as the source.

## Typography

Use Inter for display moments and JetBrains Mono for body copy unless the HTML clearly demands a compatible fallback. Labels and technical metadata should use JetBrains Mono or an equivalent mono face.

## Layout

Keep spacing deliberate and stable. Favor the same grid direction, max-width behavior, card density, and responsive stacking seen in the HTML. Do not replace distinctive source structures with generic SaaS sections.

Primary app screens should use the full available page width rather than compact centered mock containers. Use premium spacing: generous page gutters, breathable vertical rhythm, and enough separation between major regions for each workflow to feel intentional.

## Components

Workspace, List, Item, archive, and capture panels should preserve the compact operational hierarchy, nested surfaces, and subtle metadata emphasis from `sample.html`.

Use Lucide icons across the app. Do not hand-roll SVG icons for app UI unless Lucide does not provide a suitable symbol.

## Motion

Preserve existing motion cues such as masked reveals, staggered entrance, hover lift, scroll-triggered transitions, and ambient movement. Keep easing smooth and restrained.

## WebGL & Effects

If the source includes canvas, WebGL, Three.js, gradients, particles, or atmospheric effects, rebuild them as supporting layers behind the content. Keep effects performant, responsive, and secondary to the interface.

## Guardrails

- Do not flatten the source into a generic card grid.
- Do not swap the color mode unless the source clearly supports it.
- Preserve the first viewport signal, focal object, and visual density.
- Keep buttons, cards, and badges aligned to the same radius and border language.
- Do not drift into a cheerful todo-app style; ListItUp should feel like a precise workspace.
