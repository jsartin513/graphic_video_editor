# Testing Guide

This document describes the testing approach and patterns used in the Video Editor project.

## Overview

The project uses **Jest** as the testing framework with comprehensive unit and integration tests covering core functionality.

### Test Statistics

- **Total Tests**: 112
- **Test Suites**: 5
- **Overall Coverage**: 84%+ across all metrics
  - Statements: 84.07%
  - Branches: 85.71%
  - Functions: 84.21%
  - Lines: 83.49%

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory and displayed in the terminal.

## Test Structure

Tests are organized in the `__tests__/` directory with the following structure:

```
__tests__/
├── preferences.test.js          # User preferences (40 tests)
├── video-grouping.test.js       # GoPro video grouping (40 tests)
├── utils.test.js                # Utility functions (51 tests)
├── main-utils.test.js           # Main process utilities (9 tests)
└── workflow-integration.test.js # Integration tests (12 tests)
```

## Test Coverage by Module

### 1. Preferences Module (`src/preferences.js`)
- **Tests**: 40
- **Coverage**: Comprehensive
- **Key Areas**:
  - Pattern management (adding, limiting, deduplication)
  - Date formatting with multiple formats
  - Token replacement ({date}, {year}, {month}, {day})
  - Edge cases (empty patterns, null values)

### 2. Video Grouping Module (`src/video-grouping.js`)
- **Tests**: 40
- **Coverage**: Comprehensive
- **Key Areas**:
  - GoPro filename pattern recognition (GX, GP, GOPR)
  - Session ID extraction
  - Directory-based grouping
  - File sorting within groups
  - Edge cases (non-GoPro files, empty inputs)

### 3. Utility Functions (`src/utils.js`)
- **Tests**: 51
- **Coverage**: Comprehensive
- **Key Areas**:
  - File path parsing (`getFileName`, `getDirectoryName`)
  - XSS prevention (`escapeHtml`)
  - Date and time formatting
  - Edge cases (null, undefined, special characters)

### 4. Main Process Utilities (`src/main-utils.js`)
- **Tests**: 9
- **Coverage**: Complete
- **Key Areas**:
  - File size formatting (bytes to KB/MB/GB)
  - Precision and rounding

### 5. Integration Tests (`__tests__/workflow-integration.test.js`)
- **Tests**: 12
- **Coverage**: End-to-end workflows
- **Key Areas**:
  - Video grouping + preferences integration
  - Complete merge workflow simulation
  - Error handling across modules
  - Complex multi-directory scenarios

## Testing Patterns

### Unit Tests

Unit tests focus on individual functions in isolation:

```javascript
describe('formatDuration', () => {
  test('formats duration with hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  test('handles null duration', () => {
    expect(formatDuration(null)).toBe('Unknown');
  });
});
```

### Integration Tests

Integration tests verify that multiple modules work together:

```javascript
test('complete workflow: group videos, apply preferences, generate filename', () => {
  // Step 1: Group videos
  const groups = analyzeAndGroupVideos(files);
  
  // Step 2: Load preferences
  let prefs = addRecentPattern(prefs, 'Trip_{date}_Session{sessionId}');
  
  // Step 3: Apply pattern
  let filename = applyDateTokens(pattern, date);
  
  // Step 4: Verify final result
  expect(filename).toContain('Trip_2024-01-15');
});
```

### Security Testing

Tests include security-focused checks, particularly for XSS prevention:

```javascript
test('prevents XSS attack with script tag', () => {
  const malicious = '<script>alert("XSS")</script>';
  const escaped = escapeHtml(malicious);
  expect(escaped).not.toContain('<script>');
  expect(escaped).toContain('&lt;script&gt;');
});
```

### Edge Case Testing

All modules include extensive edge case testing:

```javascript
test('handles empty string', () => {
  expect(getDirectoryName('')).toBe('root');
});

test('handles null', () => {
  expect(getDirectoryName(null)).toBe('root');
});

test('handles undefined', () => {
  expect(getDirectoryName(undefined)).toBe('root');
});
```

## Test Data Patterns

### GoPro Filenames
Tests use realistic GoPro filename patterns:
- `GX010001.MP4` - GoPro Hero 7+ format
- `GP020001.MP4` - Alternative GoPro format
- `GOPR0001.MP4` - GoPro initial file format

### File Paths
Tests include cross-platform path handling:
- Unix: `/videos/folder1/video.mp4`
- Windows: `C:\\Users\\Videos\\video.mp4`
- Mixed: `/path\\to/file.mp4`

### Date Formats
Multiple date format patterns are tested:
- `YYYY-MM-DD` (ISO format)
- `MM-DD-YYYY` (US format)
- `DD-MM-YYYY` (European format)
- `YYYYMMDD` (Compact format)

## Adding New Tests

When adding new functionality:

1. **Create test file** in `__tests__/` with `.test.js` suffix
2. **Follow existing patterns** - see similar tests for examples
3. **Include edge cases** - null, undefined, empty, invalid inputs
4. **Test error paths** - verify graceful error handling
5. **Run tests** - ensure all pass before committing

### Example Test Template

```javascript
const { myFunction } = require('../src/my-module');

describe('myFunction', () => {
  test('handles normal input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  test('handles edge case', () => {
    expect(myFunction(null)).toBe('default');
  });

  test('handles error condition', () => {
    expect(() => myFunction('invalid')).toThrow();
  });
});
```

## Continuous Integration

Tests run automatically on:
- Every commit
- Pull requests
- Before builds

Minimum coverage thresholds are enforced:
- **Lines**: 70%
- **Branches**: 70%
- **Functions**: 70%
- **Statements**: 70%

## Future Testing Goals

Based on issue #55, planned enhancements include:

1. **FFmpeg Mocking** - Mock child_process.spawn for faster tests
2. **UI Component Tests** - Test renderer components
3. **E2E Tests** - Critical path end-to-end testing
4. **Performance Tests** - Test with large file sets

## Troubleshooting

### Tests Fail to Run

```bash
# Reinstall dependencies
npm install

# Clear Jest cache
npm test -- --clearCache
```

### Coverage Reports Not Generated

```bash
# Ensure coverage directory is writable
rm -rf coverage/
npm run test:coverage
```

### Module Not Found Errors

Ensure files use the correct module format for each part of the application:
- Main/src (Node/Electron main process) files: CommonJS (`require`, `module.exports`)
- Renderer files (e.g., `renderer/*.js`): ES modules (`import` / `export`)
- Test files: match the module system of the code under test (e.g., renderer tests as ESM, main/src tests as CommonJS)

## Best Practices

1. **One assertion per test** (when possible)
2. **Descriptive test names** - explain what is being tested
3. **Arrange-Act-Assert** pattern
4. **Mock external dependencies** (file system, network, etc.)
5. **Test both success and failure paths**
6. **Keep tests independent** - no shared state

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
