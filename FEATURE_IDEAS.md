# Feature Ideas & Improvements

This document captures ideas for future enhancements to the Video Merger app.

## 🎯 High Priority (User Experience)

### 1. **Video Preview/Thumbnails**
- **Problem**: Users can't see what videos they're merging before starting
- **Solution**: Generate thumbnail previews for each video file
- **Implementation**: 
  - Use `ffmpeg -ss` to extract frame at 1 second mark
  - Display thumbnails in file list and preview screen
  - Cache thumbnails for performance
- **Benefit**: Better confidence in file selection

### 2. **Real-Time Progress Indicators**
- **Problem**: Current progress bar doesn't show detailed FFmpeg progress
- **Solution**: Parse FFmpeg stderr for frame/time progress
- **Implementation**:
  - Parse `time=00:00:05.00` from FFmpeg output
  - Update progress bar with actual encoding progress
  - Show ETA based on encoding speed
- **Benefit**: Users know merge is actually progressing

### 3. **Cancel Operations**
- **Problem**: Can't stop a merge once started
- **Solution**: Add cancel button that kills FFmpeg process
- **Implementation**:
  - Store process reference from `spawn()`
  - Add cancel button to progress screen
  - Kill process and clean up temp files on cancel
- **Benefit**: Don't waste time on wrong merges

### 4. **File Size Estimation**
- **Problem**: Users don't know final file size before merging
- **Solution**: Estimate output size based on input files
- **Implementation**:
  - Sum input file sizes for rough estimate
  - Optionally account for codec/quality settings
  - Display estimated size in preview screen
- **Benefit**: Plan disk space requirements

### 5. **Batch Merge Multiple Groups**
- **Problem**: Can only merge one group at a time
- **Solution**: Allow selecting multiple groups to merge in sequence
- **Implementation**:
  - Checkboxes for each group in preview screen
  - "Merge All Selected" button
  - Queue system for sequential processing
- **Benefit**: Process entire SD card worth of videos efficiently

## 🔧 Medium Priority (Functionality)

### 6. **Video Quality/Compression Options**
- **Problem**: No control over output quality/file size
- **Solution**: Add quality presets (High/Medium/Low)
- **Implementation**:
  - Add quality selector in preview screen
  - Pass `-crf` or `-preset` to FFmpeg
  - Save preference for default quality
- **Benefit**: Balance quality vs. file size

### 7. **Keyboard Shortcuts**
- **Problem**: Mouse-heavy workflow
- **Solution**: Add common keyboard shortcuts
- **Implementation**:
  - `Cmd+O` - Open files
  - `Cmd+D` - Open folder
  - `Enter` - Start merge
  - `Esc` - Cancel/go back
  - `Cmd+M` - Prepare merge
- **Benefit**: Faster workflow for power users

### 8. **Export Settings Persistence**
- **Problem**: Quality/output directory reset each time
- **Solution**: Remember last used settings
- **Implementation**:
  - Extend preferences module
  - Save last output directory, quality setting
  - Load on app start
- **Benefit**: Faster repeated workflows

### 9. **Video Metadata Viewing**
- **Problem**: Limited file info displayed
- **Solution**: Show detailed video properties
- **Implementation**:
  - Use `ffprobe` to get resolution, framerate, codec, bitrate
  - Expandable metadata section in file list
  - Highlight videos with mismatched properties
- **Benefit**: Better understanding of files being merged

### 10. **Error Recovery/Resume**
- **Problem**: Failed merges require starting over
- **Solution**: Save merge state, allow resuming
- **Implementation**:
  - Save progress to temporary file
  - Detect incomplete merges on restart
  - "Resume" option for interrupted merges
- **Benefit**: Don't lose progress on crashes

## 🎨 Lower Priority (Nice to Have)

### 11. **Video Trimming**
- **Problem**: Sometimes need to cut out unwanted sections
- **Solution**: Add trim/cut functionality
- **Implementation**:
  - Time pickers for start/end times
  - Preview trimmed section
  - Apply trim before or after merge
- **Benefit**: More editing capabilities

### 12. **Export to Different Formats**
- **Problem**: Currently only outputs MP4
- **Solution**: Support MOV, MKV, etc.
- **Implementation**:
  - Format selector in preview
  - Map formats to appropriate codecs
  - Preserve quality settings
- **Benefit**: Compatibility with different workflows

### 13. **Audio Level Normalization**
- **Problem**: Volume varies between video clips
- **Solution**: Option to normalize audio levels
- **Implementation**:
  - Add `-af loudnorm` or `-af volume` to FFmpeg
  - Analyze audio levels first
  - Normalize during merge
- **Benefit**: Consistent audio across merged video

### 14. **Undo/Redo**
- **Problem**: Can't undo merge operations
- **Solution**: Track operations, allow undo
- **Implementation**:
  - Command pattern for operations
  - Store undo stack
  - Restore original files on undo
- **Benefit**: Safety net for mistakes

### 15. **Drag-to-Reorder Files**
- **Problem**: Files merge in fixed order
- **Solution**: Allow reordering in preview screen
- **Implementation**:
  - Drag-and-drop reordering
  - Update file list order
  - Maintain order in merge
- **Benefit**: Control over video sequence

## 🐛 Quality of Life Improvements

### 16. **Better Error Messages**
- Show user-friendly error messages instead of technical FFmpeg errors
- Link to troubleshooting guide
- Suggest common fixes

### 17. **Recent Projects/Files**
- Remember recently opened folders/files
- Quick access to common directories
- Session persistence

### 18. **Video Comparison Tool**
- Side-by-side comparison of clips
- Before/after preview for merged video
- A/B testing different merge settings

### 19. **Auto-Detect SD Cards**
- Automatically detect GoPro SD cards when inserted
- Suggest opening that directory
- Remember SD card paths

### 20. **Export History**
- Track successfully merged videos
- Show merge history with timestamps
- Quick re-merge with same settings

## 📊 Technical Improvements

### 21. **Performance Optimizations**
- Use Web Workers for thumbnail generation
- Parallel processing for multiple operations
- Lazy loading of large file lists

### 22. **Better Logging**
- Export detailed operation logs
- Error logging to file
- Debug mode for troubleshooting

### 23. **Unit Test Coverage**
- More comprehensive test suite
- Integration tests for merge workflow
- Mock FFmpeg for faster tests

### 24. **Code Splitting**
- Lazy load heavy modules
- Reduce initial bundle size
- Faster app startup

## 🎯 Recommended Priority Order

**Phase 1** (Next 2-3 features):
1. Real-Time Progress Indicators (#2)
2. Cancel Operations (#3)
3. File Size Estimation (#4)

**Phase 2** (User experience):
4. Video Preview/Thumbnails (#1)
5. Batch Merge Multiple Groups (#5)
6. Keyboard Shortcuts (#7)

**Phase 3** (Advanced features):
7. Video Quality Options (#6)
8. Video Trimming (#11)
9. Export Settings Persistence (#8)

---

## Contribution

Feel free to:
- Add new ideas
- Prioritize existing items
- Provide implementation details
- Vote on what to build next

