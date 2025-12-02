#!/bin/bash

# Video Editor - Prerequisites Installation Script
# This script checks and installs required dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only."
    exit 1
fi

print_header "Video Editor - Prerequisites Installation"

# Check for Homebrew
print_info "Checking for Homebrew..."
if ! command -v brew &> /dev/null; then
    print_warning "Homebrew not found. Installing Homebrew..."
    echo ""
    print_info "This will install Homebrew, which requires administrator privileges."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Installation cancelled."
        exit 1
    fi
    
    # Install Homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    
    print_success "Homebrew installed successfully"
else
    print_success "Homebrew is already installed"
fi

# Check for ffmpeg
print_info "Checking for ffmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    print_warning "ffmpeg not found. Installing ffmpeg..."
    brew install ffmpeg
    print_success "ffmpeg installed successfully"
else
    # Check ffmpeg version
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1 | awk '{print $3}')
    print_success "ffmpeg is already installed (version: $FFMPEG_VERSION)"
fi

# Verify ffmpeg installation
print_info "Verifying ffmpeg installation..."
if command -v ffmpeg &> /dev/null && command -v ffprobe &> /dev/null; then
    print_success "ffmpeg and ffprobe are working correctly"
    
    # Show version info
    echo ""
    print_info "ffmpeg version:"
    ffmpeg -version | head -n 1
    
    echo ""
    print_info "ffprobe version:"
    ffprobe -version | head -n 1
else
    print_error "ffmpeg verification failed"
    exit 1
fi

# Check for Node.js (optional, for development)
print_info "Checking for Node.js (optional for development)..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js is installed (version: $NODE_VERSION)"
else
    print_warning "Node.js is not installed (optional for development only)"
    print_info "To install Node.js: brew install node"
fi

echo ""
print_header "Installation Complete!"
print_success "All prerequisites are installed and ready."
echo ""
print_info "You can now:"
echo "  1. Run the Video Editor app"
echo "  2. Or build it from source: npm install && npm run build"
echo ""

