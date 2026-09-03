# UI Guidelines

## Design Philosophy

- Clean
- Minimal
- Modern
- Consistent
- Accessible
- Mobile responsive

## Components

- Prefer shadcn/ui components.
- Do not create custom components if an existing
  component can satisfy the requirement.
- Reuse existing components before creating new ones.

## Colors

- Use semantic color tokens.
- Do not hard-code colors such as blue-500/red-500.
- Maintain consistent primary, secondary and muted colors.

## Typography

- Use a consistent typography scale.
- Do not randomly change font sizes.
- Headings must follow the project's typography hierarchy.

## Spacing

- Use consistent spacing.
- Prefer Tailwind spacing tokens.
- Avoid arbitrary spacing unless necessary.

## Layout

- Use responsive layouts.
- Mobile first.
- Avoid excessive cards, borders and shadows.
- Keep content visually focused.

## States

Every interactive component should consider:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
- Empty

## Accessibility

- Interactive elements must be keyboard accessible.
- Images require meaningful alt text.
- Dialogs must have accessible titles.
- Form controls must have labels.

## Chat UI

- User and assistant messages must be visually distinguishable.
- Streaming responses should show a loading/streaming state.
- Code blocks must be visually separated from normal text.
- Long messages should remain readable.
- Input area should remain easy to access.
