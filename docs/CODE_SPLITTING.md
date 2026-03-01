# Code Splitting Implementation

## Overview

This document describes the code splitting implementation for the Video Merger application to reduce initial bundle size and improve startup performance.

## Implementation Details

### Modules Split

The application now uses dynamic imports to lazy-load heavy modules that are not needed at startup:

1. **splitVideo.js** (7.2KB) - Loaded when user clicks a split video button
2. **prerequisites.js** (4.7KB) - Loaded when prerequisites-missing event is received

### Initial Bundle

Modules loaded at startup (always loaded):
- **renderer.js** (4.4KB) - Main entry point with lazy loading logic
- **fileHandling.js** (4.2KB) - File selection and drag-drop
- **mergeWorkflow.js** (19.3KB) - Video merge workflow
- **utils.js** (1.4KB) - Utility functions

**Total initial bundle: ~29.4KB** (down from ~41.3KB, ~29% reduction)

### Lazy-Loaded Bundle

Modules loaded on demand:
- **splitVideo.js** (7.2KB) - Split video functionality
- **prerequisites.js** (4.7KB) - Prerequisites checking/installation

**Total lazy-loaded: ~11.9KB**

## Benefits

1. **Faster Initial Load**: 29% smaller initial bundle means faster parsing and execution
2. **Better User Experience**: App becomes interactive sooner
3. **Optimized Resource Usage**: Code only loaded when needed
4. **No Breaking Changes**: Functionality remains identical

## Technical Approach

### Dynamic Imports

```javascript
// Before: Static import (loaded at startup)
import { initializeSplitVideo } from './splitVideo.js';

// After: Dynamic import (loaded on demand)
async function loadSplitVideoModule() {
  if (!splitVideoModule) {
    const module = await import('./splitVideo.js');
    splitVideoModule = module.initializeSplitVideo(domElements, state);
  }
  return splitVideoModule;
}
```

### Lazy Loading Triggers

1. **Split Video**: Loaded when user clicks any split video button in the preview screen
2. **Prerequisites**: Loaded when the app receives a prerequisites-missing event from main process

### Module Caching

Each lazy-loaded module is cached after first load, so subsequent uses don't require re-loading:

```javascript
let splitVideoModule = null; // Cache for split video module

async function loadSplitVideoModule() {
  if (!splitVideoModule) { // Only load if not cached
    const module = await import('./splitVideo.js');
    splitVideoModule = module.initializeSplitVideo(domElements, state);
  }
  return splitVideoModule;
}
```

## Testing

All existing tests pass without modification:
- ✅ preferences.test.js
- ✅ video-grouping.test.js

The lazy loading is transparent to the application logic and doesn't affect functionality.

## Future Enhancements

Potential future improvements:
1. Add bundle size monitoring to CI/CD
2. Consider bundler (Vite/webpack) for additional optimizations:
   - Minification
   - Tree shaking
   - Code splitting at dependency level
3. Lazy load mergeWorkflow.js preview screen (could save ~19KB on initial load)
4. Preload modules in the background after initial render

## Performance Impact

Expected improvements:
- **Initial Parse Time**: Reduced by ~29%
- **Time to Interactive**: Faster (exact timing depends on device)
- **Memory Usage**: Lower at startup (modules loaded on demand)

## Browser Compatibility

Dynamic imports are supported in:
- Chrome 63+
- Edge 79+
- Firefox 67+
- Safari 11.1+
- Electron (all recent versions)

The Video Merger app uses Electron, which fully supports dynamic imports.
