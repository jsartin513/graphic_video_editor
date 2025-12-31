#!/bin/bash
# Quick wrapper for listing issues

STATE="${1:-open}"

node scripts/github-cli.js issue list --state "$STATE"

