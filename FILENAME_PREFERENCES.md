# Filename Preferences Feature

This document explains the new filename preferences feature that helps you rename files more efficiently.

## Overview

The Video Merger now remembers your filename patterns and preferences, making it easier to rename files consistently. It supports:

1. **Recent Pattern Suggestions** - Previously used filename patterns are remembered
2. **Date Token Support** - Use tokens like `{date}`, `{year}`, `{month}`, `{day}` in filenames
3. **Automatic Date Formatting** - Dates are formatted according to your preferences

## Using Recent Patterns

When you enter the "Preview Merge" screen:

1. Click on the filename input field
2. Start typing to see your recent patterns as suggestions
3. Select a pattern from the dropdown to auto-fill

Recent patterns are automatically saved when you:
- Complete editing a filename (on blur)
- Successfully merge videos with custom filenames

The system remembers your last 10 filename patterns.

## Using Date Tokens

You can use special date tokens in your filenames that will be automatically replaced with actual dates:

### Available Tokens

- `{date}` - Full date in your preferred format (default: YYYY-MM-DD)
- `{year}` - Four-digit year (e.g., 2024)
- `{month}` - Two-digit month (e.g., 01 for January)
- `{day}` - Two-digit day (e.g., 15)

### Examples

| Pattern | Output (for Jan 15, 2024) |
|---------|---------------------------|
| `GoPro_{date}` | `GoPro_2024-01-15` |
| `Adventure_{year}_{month}` | `Adventure_2024_01` |
| `Video_{year}` | `Video_2024` |
| `Session_{month}_{day}` | `Session_01_15` |

### How It Works

1. Type a filename with date tokens (e.g., `GoPro_{date}`)
2. When you finish editing (blur the field), tokens are automatically replaced
3. The replaced filename is saved to your recent patterns

## Date Formats

The application supports multiple date formats:

- **ISO (YYYY-MM-DD)** - International standard format (default)
- **US (MM-DD-YYYY)** - Month-day-year format
- **European (DD-MM-YYYY)** - Day-month-year format
- **Compact (YYYYMMDD)** - No separators

Your preferred date format is automatically saved and used for the `{date}` token.

## Preferences Storage

Preferences are stored locally on your computer in:
- macOS: `~/Library/Application Support/video-editor/preferences.json`

The preferences file contains:
- Recent filename patterns (up to 10)
- Preferred date format
- Last used pattern

## Tips

1. **Common Patterns**: Create reusable patterns like:
   - `GoPro_{date}` for date-stamped videos
   - `Adventure_{year}` for yearly adventures
   - `Session_{month}_{day}` for daily sessions

2. **Combining Tokens**: You can combine multiple tokens:
   - `Video_{year}_{month}_{day}` → `Video_2024_01_15`

3. **Invalid Characters**: The system automatically replaces invalid filename characters with underscores

4. **Pattern Suggestions**: Start typing to see recently used patterns - no need to remember exact patterns

## Example Workflow

1. Load GoPro videos into the app
2. Click "Prepare Merge"
3. In the filename field, type: `GoPro_Mountain_{date}`
4. Tab out of the field (blur)
5. The filename automatically becomes: `GoPro_Mountain_2024-01-15`
6. Next time, start typing "GoPro" to see this pattern as a suggestion

## Privacy

All preferences are stored locally on your computer. No data is sent to external servers.
