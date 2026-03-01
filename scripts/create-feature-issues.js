#!/usr/bin/env node
/**
 * Script to create GitHub issues for all feature ideas
 */

const { getOctokit, getRepoInfo } = require('./github-api');

const features = [
  {
    title: "Real-Time Progress Indicators for Video Merging",
    body: `## Problem
Current progress bar doesn't show detailed FFmpeg progress - users don't know if merge is actually progressing or stuck.

## Solution
Parse FFmpeg stderr output to extract real-time encoding progress and update the progress bar accordingly.

## Implementation Details
- Parse \`time=00:00:05.00\` from FFmpeg output
- Update progress bar with actual encoding progress
- Show ETA based on encoding speed
- Display current time position vs total duration

## Benefits
- Users know merge is actually progressing
- Better visibility into operation status
- Improved user confidence during long operations

**Priority**: Phase 1 - High Priority`,
    labels: ["enhancement", "high-priority", "user-experience"]
  },
  {
    title: "Cancel Operations Mid-Way",
    body: `## Problem
Can't stop a merge once started - users must wait for completion even if they selected wrong files.

## Solution
Add cancel button that kills FFmpeg process and cleans up temporary files.

## Implementation Details
- Store process reference from \`spawn()\`
- Add cancel button to progress screen
- Kill process using \`process.kill()\`
- Clean up temp files on cancel
- Show confirmation dialog before canceling

## Benefits
- Don't waste time on wrong merges
- Better control over operations
- Improved user experience

**Priority**: Phase 1 - High Priority`,
    labels: ["enhancement", "high-priority", "user-experience"]
  },
  {
    title: "File Size Estimation Before Merge",
    body: `## Problem
Users don't know final file size before merging, making it hard to plan disk space.

## Solution
Estimate output size based on input files and display in preview screen.

## Implementation Details
- Sum input file sizes for rough estimate
- Optionally account for codec/quality settings
- Display estimated size in preview screen
- Show size comparison (input vs estimated output)

## Benefits
- Plan disk space requirements
- Make informed decisions before merging
- Better resource management

**Priority**: Phase 1 - High Priority`,
    labels: ["enhancement", "high-priority", "user-experience"]
  },
  {
    title: "Video Preview/Thumbnails",
    body: `## Problem
Users can't see what videos they're merging before starting - no visual confirmation.

## Solution
Generate thumbnail previews for each video file and display them in the UI.

## Implementation Details
- Use \`ffmpeg -ss\` to extract frame at 1 second mark
- Display thumbnails in file list and preview screen
- Cache thumbnails for performance
- Use Web Workers for parallel generation
- Lazy load thumbnails as user scrolls

## Benefits
- Better confidence in file selection
- Visual verification of content
- Improved user experience

**Priority**: Phase 2`,
    labels: ["enhancement", "medium-priority", "user-experience"]
  },
  {
    title: "Batch Merge Multiple Groups",
    body: `## Problem
Can only merge one group at a time - inefficient for processing entire SD cards.

## Solution
Allow selecting multiple groups to merge in sequence automatically.

## Implementation Details
- Checkboxes for each group in preview screen
- "Merge All Selected" button
- Queue system for sequential processing
- Progress indicator for batch operations
- Option to stop batch on error or continue

## Benefits
- Process entire SD card worth of videos efficiently
- Save time on repetitive operations
- Better workflow for bulk processing

**Priority**: Phase 2`,
    labels: ["enhancement", "medium-priority", "user-experience"]
  },
  {
    title: "Video Quality/Compression Options",
    body: `## Problem
No control over output quality/file size - always uses same settings.

## Solution
Add quality presets (High/Medium/Low) with configurable compression.

## Implementation Details
- Add quality selector in preview screen
- Pass \`-crf\` or \`-preset\` to FFmpeg based on selection
- Save preference for default quality
- Show estimated file size for each quality setting
- Option to set custom CRF value for advanced users

## Benefits
- Balance quality vs file size
- Control over output based on needs
- Better flexibility

**Priority**: Phase 3`,
    labels: ["enhancement", "medium-priority", "functionality"]
  },
  {
    title: "Keyboard Shortcuts",
    body: `## Problem
Mouse-heavy workflow slows down power users.

## Solution
Add common keyboard shortcuts for frequently used actions.

## Implementation Details
- \`Cmd+O\` - Open files dialog
- \`Cmd+D\` - Open folder dialog
- \`Enter\` - Start merge/prepare merge
- \`Esc\` - Cancel/go back
- \`Cmd+M\` - Prepare merge
- \`Cmd+S\` - Save preferences
- Add keyboard shortcut hints in UI

## Benefits
- Faster workflow for power users
- Better accessibility
- Improved efficiency

**Priority**: Phase 2`,
    labels: ["enhancement", "medium-priority", "accessibility"]
  },
  {
    title: "Export Settings Persistence",
    body: `## Problem
Quality/output directory reset each time - need to reconfigure repeatedly.

## Solution
Remember last used settings and load them on app start.

## Implementation Details
- Extend preferences module
- Save last output directory, quality setting
- Load on app start
- Option to reset to defaults
- Per-folder settings support (optional)

## Benefits
- Faster repeated workflows
- Less repetitive configuration
- Better user experience

**Priority**: Phase 3`,
    labels: ["enhancement", "medium-priority", "functionality"]
  },
  {
    title: "Video Metadata Viewing",
    body: `## Problem
Limited file info displayed - hard to understand what videos contain.

## Solution
Show detailed video properties using ffprobe.

## Implementation Details
- Use \`ffprobe\` to get resolution, framerate, codec, bitrate
- Expandable metadata section in file list
- Highlight videos with mismatched properties
- Show warnings for incompatible videos
- Display duration, file size, creation date

## Benefits
- Better understanding of files being merged
- Identify potential issues early
- Make informed decisions

**Priority**: Medium`,
    labels: ["enhancement", "medium-priority", "functionality"]
  },
  {
    title: "Error Recovery/Resume",
    body: `## Problem
Failed merges require starting over - lose progress on crashes.

## Solution
Save merge state and allow resuming interrupted operations.

## Implementation Details
- Save progress to temporary file
- Detect incomplete merges on restart
- "Resume" option for interrupted merges
- Auto-cleanup old incomplete merges
- Show resume prompt on app start if incomplete merge detected

## Benefits
- Don't lose progress on crashes
- Better reliability
- Improved user experience

**Priority**: Medium`,
    labels: ["enhancement", "medium-priority", "reliability"]
  },
  {
    title: "Video Trimming",
    body: `## Problem
Sometimes need to cut out unwanted sections before merging.

## Solution
Add trim/cut functionality with time pickers.

## Implementation Details
- Time pickers for start/end times
- Preview trimmed section
- Apply trim before or after merge
- Visual timeline scrubber
- Support for multiple trim points

## Benefits
- More editing capabilities
- Better control over output
- Remove unwanted content

**Priority**: Lower Priority`,
    labels: ["enhancement", "low-priority", "functionality"]
  },
  {
    title: "Export to Different Formats",
    body: `## Problem
Currently only outputs MP4 - need support for other formats.

## Solution
Support MOV, MKV, and other common formats.

## Implementation Details
- Format selector in preview
- Map formats to appropriate codecs
- Preserve quality settings across formats
- Show format-specific options if needed
- Default to MP4 with option to change

## Benefits
- Compatibility with different workflows
- More flexibility
- Better interoperability

**Priority**: Lower Priority`,
    labels: ["enhancement", "low-priority", "functionality"]
  },
  {
    title: "Audio Level Normalization",
    body: `## Problem
Volume varies between video clips - inconsistent audio in merged video.

## Solution
Option to normalize audio levels during merge.

## Implementation Details
- Add \`-af loudnorm\` or \`-af volume\` to FFmpeg
- Analyze audio levels first
- Normalize during merge
- Option to enable/disable
- Show normalization progress

## Benefits
- Consistent audio across merged video
- Better viewing experience
- Professional output

**Priority**: Lower Priority`,
    labels: ["enhancement", "low-priority", "functionality"]
  },
  {
    title: "Undo/Redo",
    body: `## Problem
Can't undo merge operations - mistakes are permanent.

## Solution
Track operations and allow undo/redo.

## Implementation Details
- Command pattern for operations
- Store undo stack
- Restore original files on undo
- Limit undo stack size
- Show undo/redo buttons in UI

## Benefits
- Safety net for mistakes
- Better user confidence
- Professional editing experience

**Priority**: Lower Priority`,
    labels: ["enhancement", "low-priority", "functionality"]
  },
  {
    title: "Drag-to-Reorder Files",
    body: `## Problem
Files merge in fixed order - no control over sequence.

## Solution
Allow reordering files in preview screen via drag-and-drop.

## Implementation Details
- Drag-and-drop reordering
- Update file list order visually
- Maintain order in merge
- Visual feedback during drag
- Numbered indicators for order

## Benefits
- Control over video sequence
- Better creative control
- Improved workflow

**Priority**: Lower Priority`,
    labels: ["enhancement", "low-priority", "user-experience"]
  },
  {
    title: "Better Error Messages",
    body: `## Problem
Technical FFmpeg errors shown to users - not user-friendly.

## Solution
Show user-friendly error messages with actionable suggestions.

## Implementation Details
- Map FFmpeg errors to user-friendly messages
- Link to troubleshooting guide
- Suggest common fixes
- Show error codes for advanced users (collapsible)
- Provide "Get Help" button

## Benefits
- Better user experience
- Faster problem resolution
- Reduced support burden

**Priority**: Quality of Life`,
    labels: ["enhancement", "quality-of-life", "documentation"]
  },
  {
    title: "Recent Projects/Files",
    body: `## Problem
Need to navigate to same folders repeatedly.

## Solution
Remember recently opened folders/files for quick access.

## Implementation Details
- Track recently opened directories
- Show in menu or sidebar
- Quick access to common directories
- Session persistence across app restarts
- Option to pin favorites

## Benefits
- Faster repeated workflows
- Better productivity
- Improved user experience

**Priority**: Quality of Life`,
    labels: ["enhancement", "quality-of-life", "user-experience"]
  },
  {
    title: "Video Comparison Tool",
    body: `## Problem
Hard to compare clips side-by-side before merging.

## Solution
Side-by-side comparison view for video clips.

## Implementation Details
- Split screen view
- Before/after preview for merged video
- A/B testing different merge settings
- Synchronized playback
- Export comparison view

## Benefits
- Better decision making
- Visual verification
- Quality control

**Priority**: Quality of Life`,
    labels: ["enhancement", "quality-of-life", "user-experience"]
  },
  {
    title: "Auto-Detect SD Cards",
    body: `## Problem
Manual navigation to SD card directories every time.

## Solution
Automatically detect GoPro SD cards when inserted.

## Implementation Details
- Monitor for SD card mounts
- Auto-detect GoPro directory structure
- Suggest opening that directory
- Remember SD card paths
- Show notification when detected

## Benefits
- Faster workflow
- Less manual navigation
- Better user experience

**Priority**: Quality of Life`,
    labels: ["enhancement", "quality-of-life", "user-experience"]
  },
  {
    title: "Export History",
    body: `## Problem
Can't easily see or re-use previous merge settings.

## Solution
Track successfully merged videos with settings and timestamps.

## Implementation Details
- Save merge history to preferences
- Show merge history with timestamps
- Quick re-merge with same settings
- Export history to file
- Clear history option

## Benefits
- Reuse successful settings
- Track work done
- Better workflow management

**Priority**: Quality of Life`,
    labels: ["enhancement", "quality-of-life", "functionality"]
  },
  {
    title: "Performance Optimizations",
    body: `## Problem
App can be slow with large file lists or many thumbnails.

## Solution
Optimize performance with Web Workers and lazy loading.

## Implementation Details
- Use Web Workers for thumbnail generation
- Parallel processing for multiple operations
- Lazy loading of large file lists
- Virtual scrolling for performance
- Debounce expensive operations

## Benefits
- Faster app performance
- Better responsiveness
- Improved user experience

**Priority**: Technical`,
    labels: ["enhancement", "technical", "performance"]
  },
  {
    title: "Better Logging",
    body: `## Problem
Limited logging makes troubleshooting difficult.

## Solution
Comprehensive logging system with export capabilities.

## Implementation Details
- Export detailed operation logs
- Error logging to file
- Debug mode for troubleshooting
- Log viewer in app
- Auto-upload logs on error (opt-in)

## Benefits
- Easier troubleshooting
- Better debugging
- Improved support

**Priority**: Technical`,
    labels: ["enhancement", "technical", "debugging"]
  },
  {
    title: "Unit Test Coverage",
    body: `## Problem
Limited test coverage - bugs can slip through.

## Solution
Comprehensive test suite with good coverage.

## Implementation Details
- More comprehensive test suite
- Integration tests for merge workflow
- Mock FFmpeg for faster tests
- UI component tests
- E2E tests for critical paths

## Benefits
- Catch bugs early
- Safer refactoring
- Better code quality

**Priority**: Technical`,
    labels: ["enhancement", "technical", "testing"]
  },
  {
    title: "Code Splitting",
    body: `## Problem
Large bundle size slows down app startup.

## Solution
Lazy load heavy modules and split code appropriately.

## Implementation Details
- Lazy load heavy modules
- Reduce initial bundle size
- Faster app startup
- Dynamic imports where appropriate
- Analyze bundle size

## Benefits
- Faster startup time
- Better performance
- Improved user experience

**Priority**: Technical`,
    labels: ["enhancement", "technical", "performance"]
  }
];

async function createIssues() {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  console.log(`Creating ${features.length} issues...\n`);

  const createdIssues = [];

  for (const feature of features) {
    try {
      const { data: issue } = await octokit.rest.issues.create({
        owner,
        repo,
        title: feature.title,
        body: feature.body,
        labels: feature.labels,
      });

      console.log(`✅ Created issue #${issue.number}: ${feature.title}`);
      createdIssues.push(issue);
      
      // Rate limit: GitHub allows 5000 requests/hour, but be nice
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Failed to create issue "${feature.title}":`, error.message);
      if (error.response?.data) {
        console.error('Details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  console.log(`\n✅ Created ${createdIssues.length}/${features.length} issues`);
  return createdIssues;
}

if (require.main === module) {
  createIssues().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { createIssues, features };

