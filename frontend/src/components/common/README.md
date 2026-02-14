# Common Components - Animations & Loading States

This directory contains reusable components for animations and loading states that follow the modern UI design system.

## Components

### Spinner
A rotating spinner for loading states.

```tsx
import { Spinner } from './components/common';

// Basic usage
<Spinner />

// With custom size and color
<Spinner size="lg" color="text-blue-600" />

// Sizes: 'sm' | 'md' | 'lg'
```

### LoadingDots
Animated dots for subtle loading indicators.

```tsx
import { LoadingDots } from './components/common';

// Basic usage
<LoadingDots />

// With custom color
<LoadingDots color="text-primary-600" />
```

### ProgressBar
A progress bar with optional animations.

```tsx
import { ProgressBar } from './components/common';

// Determinate progress
<ProgressBar progress={75} />

// Indeterminate progress
<ProgressBar indeterminate />

// With custom styling
<ProgressBar 
  progress={50} 
  color="bg-green-500"
  height="h-3"
  animated
/>
```

### Skeleton
Skeleton loaders for content placeholders.

```tsx
import { Skeleton } from './components/common';

// Text skeleton
<Skeleton variant="text" />

// Title skeleton
<Skeleton variant="title" />

// Avatar skeleton
<Skeleton variant="avatar" />

// Multiple skeletons
<Skeleton variant="text" count={3} />

// Custom dimensions
<Skeleton variant="rectangular" width="200px" height="100px" />
```

## CSS Animation Classes

### Transitions (200ms ease)
All buttons, inputs, and interactive elements automatically have smooth transitions applied.

### Entrance Animations

#### Fade In
```tsx
<div className="entrance-fade">Content</div>
<div className="page-fade-in">Page content</div>
```

#### Slide In
```tsx
<div className="entrance-slide-up">Slides up</div>
<div className="entrance-slide-down">Slides down</div>
<div className="slide-in-left">Slides from left</div>
<div className="slide-in-right">Slides from right</div>
```

#### Scale In
```tsx
<div className="entrance-scale">Scales in</div>
<div className="dropdown-scale-in">Dropdown menu</div>
```

### Staggered Animations
For lists or grids where items should animate in sequence:

```tsx
<div className="stagger-item-1">First item</div>
<div className="stagger-item-2">Second item</div>
<div className="stagger-item-3">Third item</div>
// ... up to stagger-item-5
```

### Modal Animations
Modals automatically animate with slide-in effect:

```tsx
<div className="modal-backdrop">
  <div className="modal-container">
    Modal content
  </div>
</div>
```

### Loading States

#### Skeleton Loaders
```tsx
<div className="skeleton">Loading...</div>
<div className="skeleton-text">Text loading</div>
<div className="skeleton-title">Title loading</div>
<div className="skeleton-avatar">Avatar loading</div>
```

#### Spinners
```tsx
<div className="loading-spinner">Loading</div>
<div className="loading-spinner-sm">Small spinner</div>
<div className="loading-spinner-lg">Large spinner</div>
```

#### Button Loading State
```tsx
<button className="btn btn-primary btn-loading">
  <span className="btn-spinner"></span>
  Loading...
</button>
```

## Design Specifications

All animations follow these timing specifications:
- **Fast transitions**: 150ms ease
- **Default transitions**: 200ms ease (buttons, inputs)
- **Slow transitions**: 300ms ease (cards, modals)
- **Entrance animations**: 300-400ms cubic-bezier(0.4, 0, 0.2, 1)

### Accessibility
All animations respect the `prefers-reduced-motion` media query and will be significantly reduced or disabled for users who prefer reduced motion.

## Requirements Addressed
- **1.4**: Smooth transitions and animations for interactive elements
- **1.5**: Clear visual feedback with hover states and animations
