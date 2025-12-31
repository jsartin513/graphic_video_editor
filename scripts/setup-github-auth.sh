#!/bin/bash
# Setup script for GitHub authentication

set -e

echo "🔐 GitHub Authentication Setup"
echo "=============================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping .env setup"
        exit 0
    fi
fi

# Check if .env.example exists
if [ ! -f .env.example ]; then
    echo "❌ .env.example not found. Please create it first."
    exit 1
fi

# Copy .env.example to .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
fi

echo ""
echo "📝 GitHub Personal Access Token Setup"
echo ""
echo "To create a token:"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token' → 'Generate new token (classic)'"
echo "3. Give it a name (e.g., 'Video Merger Automation')"
echo "4. Select scopes:"
echo "   ✅ repo (Full control of private repositories)"
echo "   ✅ workflow (Update GitHub Action workflows)"
echo "5. Click 'Generate token'"
echo "6. Copy the token (you won't see it again!)"
echo ""

read -p "Enter your GitHub Personal Access Token: " -s token
echo ""

if [ -z "$token" ]; then
    echo "❌ Token cannot be empty"
    exit 1
fi

# Update .env file
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$token/" .env
else
    # Linux
    sed -i "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$token/" .env
fi

echo "✅ Token saved to .env file"
echo ""

# Optional: Set repository
read -p "Enter repository (owner/repo) or press Enter to auto-detect from git: " repo
if [ -n "$repo" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/GITHUB_REPO=.*/GITHUB_REPO=$repo/" .env
    else
        sed -i "s/GITHUB_REPO=.*/GITHUB_REPO=$repo/" .env
    fi
    echo "✅ Repository set to: $repo"
else
    echo "ℹ️  Repository will be auto-detected from git remote"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Test your setup:"
echo "  node scripts/github-cli.js repo info"
echo ""

