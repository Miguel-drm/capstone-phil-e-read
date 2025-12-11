# Button Component

A modern, accessible button component with multiple variants, sizes, and loading states.

## Features

- **4 Variants**: Primary, Secondary, Outline, Ghost
- **3 Sizes**: Small (36px), Medium (44px), Large (52px)
- **Loading States**: Built-in spinner with automatic disabled state
- **Accessibility**: Proper focus states, ARIA support, keyboard navigation
- **Responsive**: Touch-friendly targets on mobile devices
- **Animations**: Smooth hover and active state transitions

## Usage

```tsx
import { Button } from '../components/ui';

// Basic usage
<Button variant="primary">Click Me</Button>

// With loading state
<Button variant="primary" loading={isLoading}>
  Submit
</Button>

// Different sizes
<Button variant="secondary" size="sm">Small</Button>
<Button variant="secondary" size="md">Medium</Button>
<Button variant="secondary" size="lg">Large</Button>

// Full width
<Button variant="primary" fullWidth>
  Full Width Button
</Button>

// Disabled
<Button variant="outline" disabled>
  Disabled
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost'` | `'primary'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Shows spinner and disables button |
| `disabled` | `boolean` | `false` | Disables the button |
| `fullWidth` | `boolean` | `false` | Makes button full width |
| `children` | `ReactNode` | - | Button content |
| `className` | `string` | `''` | Additional CSS classes |

All standard HTML button attributes are also supported (onClick, type, etc.)

## Variants

### Primary
- **Use for**: Main actions, primary CTAs
- **Style**: Blue background, white text, shadow
- **Hover**: Darker blue, larger shadow, slight scale

### Secondary
- **Use for**: Secondary actions, cancel buttons
- **Style**: White background, gray border, gray text
- **Hover**: Light gray background

### Outline
- **Use for**: Tertiary actions, alternative CTAs
- **Style**: Transparent background, blue border and text
- **Hover**: Light blue background

### Ghost
- **Use for**: Subtle actions, inline buttons
- **Style**: Transparent background, gray text
- **Hover**: Light gray background

## Sizes

- **Small (sm)**: 36px height, 16px horizontal padding, 14px font
- **Medium (md)**: 44px height, 24px horizontal padding, 16px font
- **Large (lg)**: 52px height, 32px horizontal padding, 18px font

## Loading State

When `loading={true}`:
- Spinner appears before button text
- Button is automatically disabled
- Opacity reduced to 50%
- Cursor changes to not-allowed

## Accessibility

- Proper focus indicators with ring
- Keyboard navigation support
- Disabled state properly communicated
- Loading state includes aria-label on spinner
- Meets WCAG AA contrast requirements

## Design Tokens

The button uses design tokens from the Tailwind config:
- Colors: `primary-*`, `gray-*`
- Spacing: Custom spacing scale
- Shadows: `shadow-md`, `shadow-lg`
- Border radius: `rounded-lg`
- Transitions: `duration-default`

## Examples

See `ButtonExample.tsx` for a comprehensive showcase of all button variants and states.
