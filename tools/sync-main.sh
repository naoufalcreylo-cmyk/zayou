#!/usr/bin/env bash
# Update the `main` branch (Shopify GitHub integration + Vercel demo) from this project.
#   main = theme/ at the root + the preview harness and deploy/vercel/* (Shopify ignores non-theme files).
# Usage: tools/sync-main.sh <path to a worktree of main>   (git worktree add ../zayou-main main)
# Commit theme editor changes pulled from main back into theme/ first, or the merge will conflict.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); WT=${1:?worktree of main}
SPLIT=$(git -C "$ROOT" subtree split --prefix=theme)
git -C "$WT" merge --no-edit "$SPLIT"
mkdir -p "$WT/api" "$WT/tools/preview" "$WT/data"
cp "$ROOT"/deploy/vercel/{vercel.json,package.json,.gitignore} "$WT/"
cp "$ROOT/deploy/vercel/api/index.js" "$WT/api/"
cp "$ROOT"/tools/preview/{server,engine,drops}.js "$WT/tools/preview/"
cp "$ROOT"/data/{catalog,articles}.json "$WT/data/"
git -C "$WT" add -A
git -C "$WT" diff --cached --quiet || git -C "$WT" commit -m "Vercel demo: preview harness sync"
echo "main updated in $WT — push with: git -C \"$WT\" push origin main"
