#!/bin/bash

# Setup script for initializing git and preparing for GitHub push

set -e

echo "Setting up git repository..."

# Initialize git if needed
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
else
    echo "Git repository already initialized"
fi

# Add all files
echo "Staging files..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "No changes to commit"
else
    echo "Creating initial commit..."
    git commit -m "Initial commit: Video Editor app with prerequisites installer"
fi

# Check for existing remote
if git remote | grep -q origin; then
    echo ""
    echo "Remote 'origin' already exists:"
    git remote -v
    echo ""
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter GitHub repository URL (e.g., https://github.com/username/video-editor.git): " repo_url
        git remote set-url origin "$repo_url"
        echo "Remote updated to: $repo_url"
    fi
else
    echo ""
    echo "No remote repository configured."
    echo ""
    echo "To create a GitHub repository:"
    echo "1. Go to https://github.com/new"
    echo "2. Create a new repository (e.g., 'video-editor')"
    echo "3. Copy the repository URL"
    echo ""
    read -p "Enter GitHub repository URL (or press Enter to skip): " repo_url
    
    if [ -n "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo "Remote added: $repo_url"
    else
        echo "Skipping remote setup. You can add it later with:"
        echo "  git remote add origin <repository-url>"
    fi
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. If you haven't created a GitHub repo yet, create one at https://github.com/new"
echo "2. Push your code:"
echo "   git push -u origin main"
echo ""
echo "Or if your default branch is 'master':"
echo "   git branch -M main  # Rename to main if needed"
echo "   git push -u origin main"

