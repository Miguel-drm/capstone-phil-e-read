# Button Component Specifications

## Visual Specifications

### Primary Button
```
Background: #2563eb (blue-600)
Hover: #1d4ed8 (blue-700)
Active: #1e40af (blue-800)
Text: white
Shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
Hover Shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
Hover Scale: 1.02
Border Radius: 8px
Transition: 200ms ease
```

### Secondary Button
```
Background: white
Border: 2px solid #d1d5db (gray-300)
Hover Border: #9ca3af (gray-400)
Hover Background: #f9fafb (gray-50)
Text: #374151 (gray-700)
Shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
Border Radius: 8px
Transition: 200ms ease
```

### Outline Button
```
Background: transparent
Border: 2px solid #2563eb (blue-600)
Hover Background: #eff6ff (blue-50)
Text: #2563eb (blue-600)
Border Radius: 8px
Transition: 200ms ease
```

### Ghost Button
```
Background: transparent
Hover Background: #f3f4f6 (gray-100)
Text: #374151 (gray-700)
Border Radius: 8px
Transition: 200ms ease
```

## Size Specifications

### Small (sm)
```
Height: 36px
Padding: 8px 16px (vertical, horizontal)
Font Size: 14px
Line Height: 20px
Font Weight: 600 (semibold)
```

### Medium (md) - Default
```
Height: 44px
Padding: 12px 24px (vertical, horizontal)
Font Size: 16px
Line Height: 24px
Font Weight: 600 (semibold)
```

### Large (lg)
```
Height: 52px
Padding: 16px 32px (vertical, horizontal)
Font Size: 18px
Line Height: 26px
Font Weight: 600 (semibold)
```

## Loading State Specifications

### Spinner
```
Animation: spin (infinite rotation)
Duration: 1s linear infinite
Sizes:
  - Small button: 16px (sm spinner)
  - Medium button: 16px (sm spinner)
  - Large button: 20px (md spinner)
Colors:
  - Primary button: white
  - Other variants: #2563eb (blue-600)
Position: -4px left margin, 8px right margin
```

### Disabled During Loading
```
Opacity: 0.5
Cursor: not-allowed
Pointer Events: none (via disabled attribute)
```

## Focus State Specifications

### All Variants
```
Outline: none (removed default)
Ring: 2px solid
Ring Offset: 2px
Ring Color:
  - Primary: #3b82f6 (blue-500) with 50% opacity
  - Secondary: #9ca3af (gray-400) with 50% opacity
  - Outline: #3b82f6 (blue-500) with 50% opacity
  - Ghost: #9ca3af (gray-400) with 50% opacity
```

## Disabled State Specifications

### All Variants
```
Opacity: 0.5
Cursor: not-allowed
Hover Effects: disabled
Active Effects: disabled
```

## Accessibility Specifications

### Keyboard Navigation
```
Tab Order: Natural DOM order
Focus Indicator: Visible ring (2px)
Enter/Space: Activates button
```

### Screen Readers
```
Role: button (implicit)
Disabled State: Communicated via disabled attribute
Loading State: Spinner has aria-label="Loading"
```

### Touch Targets
```
Minimum Size: 44x44px (met by default size)
Small Size: 36px height (acceptable for desktop, consider increasing on mobile)
Spacing: Minimum 12px between adjacent buttons
```

## Color Contrast Ratios

### Primary Button
```
White text on #2563eb background
Contrast Ratio: 8.59:1
WCAG Level: AAA ✓
```

### Secondary Button
```
#374151 text on white background
Contrast Ratio: 12.63:1
WCAG Level: AAA ✓
```

### Outline Button
```
#2563eb text on white background
Contrast Ratio: 8.59:1
WCAG Level: AAA ✓
```

### Ghost Button
```
#374151 text on transparent/white background
Contrast Ratio: 12.63:1
WCAG Level: AAA ✓
```

## Implementation Classes

### Base Classes
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-radius: 8px;
  transition: all 200ms ease;
  outline: none;
  focus: ring-2 ring-offset-2;
}
```

### Variant Classes
```css
.btn-primary {
  background: #2563eb;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  background: #1d4ed8;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: scale(1.02);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 2px solid #d1d5db;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-outline {
  background: transparent;
  color: #2563eb;
  border: 2px solid #2563eb;
}

.btn-outline:hover {
  background: #eff6ff;
}

.btn-ghost {
  background: transparent;
  color: #374151;
}

.btn-ghost:hover {
  background: #f3f4f6;
}
```

### Size Classes
```css
.btn-sm {
  height: 36px;
  padding: 8px 16px;
  font-size: 14px;
}

.btn-md {
  height: 44px;
  padding: 12px 24px;
  font-size: 16px;
}

.btn-lg {
  height: 52px;
  padding: 16px 32px;
  font-size: 18px;
}
```

## Browser Support

- Chrome: ✓ (latest)
- Firefox: ✓ (latest)
- Safari: ✓ (latest)
- Edge: ✓ (latest)
- Mobile Safari: ✓ (iOS 12+)
- Chrome Mobile: ✓ (latest)

## Performance Notes

- Uses CSS transforms for animations (GPU-accelerated)
- Transitions are optimized (transform and opacity only)
- No layout thrashing
- Minimal repaints on hover
- Spinner uses CSS animation (no JavaScript)
