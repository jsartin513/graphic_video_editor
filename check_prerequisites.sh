#!/bin/bash

# Quick prerequisite check script (non-installing)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking prerequisites for Video Editor..."
echo ""

# Check ffmpeg
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1 | awk '{print $3}')
    echo -e "${GREEN}✓${NC} ffmpeg installed (version: $FFMPEG_VERSION)"
else
    echo -e "${RED}✗${NC} ffmpeg not found"
    echo "   Run: ./install_prerequisites.sh to install"
fi

# Check ffprobe
if command -v ffprobe &> /dev/null; then
    echo -e "${GREEN}✓${NC} ffprobe installed"
else
    echo -e "${RED}✗${NC} ffprobe not found"
fi

# Check Homebrew
if command -v brew &> /dev/null; then
    echo -e "${GREEN}✓${NC} Homebrew installed"
else
    echo -e "${YELLOW}⚠${NC} Homebrew not found (needed to install ffmpeg)"
fi

echo ""
echo "All checks complete!"

