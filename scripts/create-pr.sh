#!/bin/bash
# Quick wrapper for creating pull requests

if [ $# -lt 2 ]; then
    echo "Usage: $0 <title> <head-branch> [base-branch] [body]"
    echo ""
    echo "Examples:"
    echo "  $0 \"Fix bug\" feature-branch"
    echo "  $0 \"Add feature\" feature-branch main \"Description here\""
    exit 1
fi

TITLE="$1"
HEAD="$2"
BASE="${3:-main}"
BODY="${4:-}"

node scripts/github-cli.js pr create \
    --title "$TITLE" \
    --head "$HEAD" \
    --base "$BASE" \
    ${BODY:+--body "$BODY"}


