#!/bin/bash
# Quick wrapper for assigning issues

if [ $# -lt 2 ]; then
    echo "Usage: $0 <issue-number> <assignee1> [assignee2...]"
    echo ""
    echo "Examples:"
    echo "  $0 123 jsartin513"
    echo "  $0 123 jsartin513 collaborator"
    exit 1
fi

ISSUE_NUM="$1"
shift
ASSIGNEES="$@"

node scripts/github-cli.js issue assign "$ISSUE_NUM" $ASSIGNEES

