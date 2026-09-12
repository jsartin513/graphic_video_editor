# Video Merger — User Guide

This guide is for **anyone using Video Merger on a Mac**. You do not need programming tools, Terminal, or technical background.

Video Merger helps you **combine GoPro and other camera clips into one file**, with sensible names and optional quality settings. It is especially handy when you copy footage off an SD card and want one video per recording session.

---

## What you need

- A **Mac** running **macOS 10.15 (Catalina)** or newer
- **Intel** or **Apple Silicon** (M1/M2/M3, etc.) — use the installer that matches your Mac (see below)
- Video files in common formats: **MP4, MOV, AVI, MKV, M4V**

You **do not** need to install Node.js, Homebrew, or FFmpeg if you use the recommended **“fat”** download (FFmpeg is included inside the app).

---

## Download the app

1. Open the latest release in your browser:  
   [https://github.com/jsartin513/graphic_video_editor/releases/latest](https://github.com/jsartin513/graphic_video_editor/releases/latest)
2. Pick **one** installer file — a **`.dmg`** whose name includes **`fat`**:
   - **Apple Silicon Mac** (About This Mac → **Chip** shows M1, M2, M3, …):  
     `Video-Merger-<version>-arm64-fat.dmg`
   - **Intel Mac** (About This Mac → **Processor** shows Intel):  
     `Video-Merger-<version>-x64-fat.dmg`

**Tip:** If you are unsure, open **Apple menu → About This Mac**. Look for **Chip** (Apple) vs **Processor** (Intel).

Do **not** download files labeled **`lite`** unless someone technical has already set up FFmpeg on your Mac.

---

## Install on your Mac

1. Open the downloaded **`.dmg`** file (usually in **Downloads**).
2. Drag **Video Merger** into the **Applications** folder.
3. Eject the disk image if macOS leaves it on the desktop.
4. Open **Video Merger** from **Applications** (or Spotlight: press ⌘ Space, type *Video Merger*).

### If macOS says the app “can’t be opened” or is “damaged”

Official signed builds should open normally. If you still see a warning:

1. **Right-click** (or Control-click) **Video Merger** in Applications.
2. Choose **Open**, then click **Open** again in the dialog.

For more detail, see [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md).

---

## Quick start: merge videos

### 1. Add your clips

On the first screen you can:

- Click **Choose Files** to pick individual videos, or  
- Click **Choose Folder** to load every video in a folder (including subfolders), or  
- **Drag and drop** files or a folder onto the window.

**Recent Folders** appears after you have used the app — click a folder to open it again quickly.

### 2. Review the list

You will see **Selected Videos** with size, date, and duration. You can:

- **Remove** a clip you do not want (use the remove control on that row).
- **Reorder** clips by dragging them (order matters for the final movie).
- **Undo** / **Redo** recent list changes (buttons at the top of the list).

When you are happy with the list, click **Continue to Merge**.

### 3. Set names and options

On the **Merge** screen:

- Each **group** of clips (often one GoPro “session”) gets its own output name. Click a name to edit it.
- Use **Naming** templates and **Week number** if you use patterns like league or event filenames.
- Open **More options** only if you need them:
  - **Video quality** — *Copy* is fastest and keeps original quality; other choices re-encode (slower, different file size).
  - **Normalize audio** — makes volume more consistent across clips.
  - **Export format** — **MP4** is best for sharing; leave as-is unless you know you need MOV/MKV/etc.

At the bottom, **Change folder** picks where merged files are saved. If you do not change it, merged files go into a folder named **`merged_videos`** **next to your original video files** (same parent folder as the clips).

### 4. Merge

Click **Merge**. A progress screen shows status. When finished, open the output folder from the success message or use **Finder** → your **`merged_videos`** folder.

A small log file **`merge_log.jsonl`** may appear in that folder after successful merges (useful for records; you can ignore it if you do not need it).

---

## GoPro SD card

When you plug in a GoPro SD card, Video Merger may show a banner: **GoPro SD Card Detected**.

- **Open Folder** — opens the card in Finder.  
- **Load Videos** — loads videos from the card into the app.  
- **✕** — dismisses the banner for now.

You can still use **Choose Folder** manually if the banner does not appear.

---

## Split one long video

Use **Split video…** on the first screen (under **Add videos**) to cut a single file into shorter segments (for example, 20 minutes each).

1. Choose the video file.  
2. Set **Duration per segment** (minutes).  
3. Optionally set a **filename pattern** (e.g. `{gameNumber}` for part numbers).  
4. Run the split; new files are saved in a folder next to the original (or as shown when you confirm).

---

## Compare two videos

If you select **exactly two** videos in the list, **Compare Videos** appears. Use it to view metadata side by side (resolution, frame rate, codec, etc.) before merging — helpful when clips look similar but might not match.

---

## Settings

Click **Settings** (top right), or press **⌘ ,** (Command + comma).

| Section | What it does |
|--------|----------------|
| **Date format** | How `{date}` appears in filenames (e.g. 2026-03-15 vs 03-15-2026). |
| **Updates** | Shows your version; **Check for updates** looks for a newer release. |
| **Naming templates** | Save reusable name patterns (e.g. `BDL Open Gym {date}`) for events. |

Preferences are stored on your Mac only (not in the cloud).

---

## Staying up to date

- **New installs (recommended fat DMG):** After the first install from a recent release, the app can often **download and install updates** from Settings → **Check for updates**, or when prompted at startup.
- **Very old installs:** If Settings says updates are not available in-app, download the latest **fat** `.dmg` once from [Releases](https://github.com/jsartin513/graphic_video_editor/releases/latest), replace the app in Applications, then future updates can usually happen inside the app.

---

## Keyboard shortcuts (optional)

| Action | Shortcut |
|--------|----------|
| Choose files | ⌘ O |
| Choose folder | ⌘ D |
| Split video | ⌘ ⇧ S |
| Continue to merge (from list) | ⌘ M or Enter |
| Start merge (on Merge screen) | Enter |
| Undo / Redo | ⌘ Z / ⌘ ⇧ Z |
| Settings | ⌘ , |
| Back from Merge screen | Esc |

---

## Tips for smooth merges

1. **Keep clips from one session together** — GoPro files with the same session ID are grouped automatically; different sessions become separate output files.
2. **Watch for warnings** — Yellow highlights mean resolution, frame rate, or codec may not match; merging can still work but quality or sync may suffer.
3. **Use Copy quality** when all clips are alike — fastest and no quality loss.
4. **Free disk space** — Merging needs room for the full output file; leave extra space on the drive where `merged_videos` will be created.
5. **Leave the SD card plugged in** until copying and merging finish if your files still live on the card.

---

## When something goes wrong

| Problem | What to try |
|--------|-------------|
| App will not open | [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md) |
| “Permission” or cannot see a folder | System **Settings → Privacy & Security** — allow **Files and Folders** (and if needed **Full Disk Access**) for Video Merger, then restart the app |
| Merge failed | Use **View Failed Operations** on the home screen if shown; retry after fixing the listed issue |
| Clip will not play in the app | Open it in **QuickTime** or **VLC**; if it fails there, re-copy or re-export the clip |
| Slow merge | Use **Copy** quality; merge fewer clips at once; close heavy apps |

More detail: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Getting help

Share your **app version** (Settings → Updates), what you were trying to do, and whether the files are on the internal drive or an SD card. Screenshots of any error message help.

---

## For developers

Building, releasing, and CI are documented separately: [README.md](README.md), [RELEASE.md](RELEASE.md), [DISTRIBUTION_GUIDE.md](DISTRIBUTION_GUIDE.md).
