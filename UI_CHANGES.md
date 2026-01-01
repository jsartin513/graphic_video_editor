## UI Changes - Filename Preferences Feature

### Before (Original UI)
```
┌─────────────────────────────────────────────┐
│ Session 0001                                │
│ 3 files • 00:05:30                          │
│                                             │
│ Output Filename:                            │
│ [PROCESSED0001                    ] .MP4    │
│                                             │
│ Input Files:                                │
│ • GX010001.MP4                              │
│ • GX020001.MP4                              │
│ • GX030001.MP4                              │
└─────────────────────────────────────────────┘
```

### After (With Preferences Feature)
```
┌─────────────────────────────────────────────┐
│ Session 0001                                │
│ 3 files • 00:05:30                          │
│                                             │
│ Output Filename:                            │
│ [GoPro_Mountain_{date}            ] .MP4    │
│  ↓ Recent patterns dropdown appears         │
│  • GoPro_{year}                             │
│  • Adventure_{date}                         │
│  • GoPro_Mountain_{date}                    │
│  • Session_{year}_{month}                   │
│                                             │
│ 💡 Use date tokens: {date}, {year}, {month} │
│                                             │
│ Input Files:                                │
│ • GX010001.MP4                              │
│ • GX020001.MP4                              │
│ • GX030001.MP4                              │
└─────────────────────────────────────────────┘
```

### Key UI Improvements

1. **Autocomplete Dropdown**
   - Shows recent patterns as you type
   - Uses HTML5 datalist for native dropdown
   - Patterns appear in most-recent-first order

2. **Date Token Hints**
   - Blue info box below input
   - Shows available date tokens
   - Visible at all times for easy reference

3. **Smart Token Replacement**
   - Tokens like `{date}` automatically replaced on blur
   - Uses user's preferred date format
   - Original pattern (with tokens) saved for reuse

### User Flow Example

1. User types "GoPro" in the filename field
   → Dropdown shows: "GoPro_{year}", "GoPro_Mountain_{date}"

2. User selects "GoPro_Mountain_{date}" or types it manually
   
3. User tabs out of the field (blur event)
   → `{date}` is replaced with "2024-01-15" (using ISO format)
   → Final filename: "GoPro_Mountain_2024-01-15.MP4"

4. Pattern "GoPro_Mountain_{date}" is saved to preferences
   → Next time, it appears in the suggestions

### Technical Details

- Patterns stored in: `~/Library/Application Support/video-editor/preferences.json`
- Maximum 10 recent patterns
- Date formats: ISO (YYYY-MM-DD), US (MM-DD-YYYY), European (DD-MM-YYYY), Compact (YYYYMMDD)
- Sanitization preserves hyphens and underscores for date formatting
