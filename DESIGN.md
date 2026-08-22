---
tokens:
  color:
    background: "#f5f7fb"
    surface: "#ffffff"
    surface_subtle: "#eef2f7"
    text: "#172033"
    text_muted: "#5b667a"
    primary: "#2563eb"
    primary_dark: "#1d4ed8"
    accent: "#f59e0b"
    danger: "#dc2626"
    border: "#d9e0ea"
    focus: "#0ea5e9"
  typography:
    font_family: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    display_weight: 700
    body_weight: 500
  spacing:
    xs: "4px"
    sm: "8px"
    md: "12px"
    lg: "16px"
    xl: "24px"
  radius:
    control: "8px"
    panel: "8px"
  elevation:
    panel: "0 18px 48px rgba(23, 32, 51, 0.14)"
  motion:
    duration_fast: "120ms"
    easing: "ease-out"
---

# Calculator App Design

## Purpose

The app is a focused utility workspace for basic arithmetic and lightweight task tracking. The interface should feel precise, readable, and fast rather than decorative.

## Visual Direction

Use a light workbench layout with a white calculator surface, crisp blue primary actions, amber operator accents, and restrained borders. The palette intentionally mixes blue, amber, white, and neutral text to avoid a one-note theme.

## Components

- Tabs: segmented controls switch between Calculator and Todo List without changing the page shell.
- Display: fixed-height result area with expression, current value, and inline error text.
- Keypad: stable four-column grid with equal-size buttons to prevent layout shifts.
- History: compact list of recent completed calculations with a small per-entry delete control.
- Todo List: compact Supabase-backed task list with create, complete, edit, delete, loading, empty, setup, and error states.
- Actions: clear, delete, todo add, edit, save, and delete controls with clear labels and keyboard focus states.

## Responsive Behavior

The workspace is centered on desktop with a constrained width. On mobile it fills the available width with stable button dimensions and no text overlap.

## Accessibility

Buttons use semantic HTML, visible focus rings, adequate contrast, and keyboard support. Calculator shortcuts are active only while the Calculator tab is visible, so typing in Todo inputs cannot trigger calculator operations.
