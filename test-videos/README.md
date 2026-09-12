# Test videos (GoPro naming)

These clips are meant to merge into **one** output when selected together.

GoPro groups by the **last four digits** of the filename (session ID). The two characters after `GX` are the **chapter** (01, 02, 03, …).

| File        | Chapter | Session |
|-------------|---------|---------|
| GX010001.MP4 | 01      | 0001    |
| GX020001.MP4 | 02      | 0001    |
| GX030001.MP4 | 03      | 0001    |

**Prepare Merge** should show one group (`PROCESSED0001.MP4`) with three files.

Names like `GX010002.MP4` / `GX010003.MP4` are **different sessions** (0002, 0003), so the app correctly produces separate outputs.
