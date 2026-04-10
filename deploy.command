#!/bin/bash
# ─────────────────────────────────────────
#  jacobbudnitz.com — one-click deploy
#  Double-click this file in Finder to run
# ─────────────────────────────────────────

cd "$(dirname "$0")"

echo ""
echo "  jacobbudnitz.com — deploy"
echo "  ─────────────────────────"
echo ""

# ── Check git remote ──────────────────────────────────
REMOTE=$(git remote get-url origin 2>/dev/null)

if [ -z "$REMOTE" ]; then
  echo "  First-time setup: no GitHub remote configured."
  echo ""
  echo "  Enter your GitHub repo URL"
  echo "  (e.g. https://github.com/yourusername/yourusername.github.io.git)"
  echo "  or press Enter to open GitHub to find it:"
  echo ""
  read -p "  Repo URL: " REPO_URL

  if [ -z "$REPO_URL" ]; then
    open "https://github.com"
    echo ""
    echo "  Re-run this script after copying your repo URL."
    read -p "  Press Enter to exit..."
    exit 0
  fi

  git remote add origin "$REPO_URL"
  echo ""
  echo "  Remote set to: $REPO_URL"
  echo ""
fi

# ── Stage & commit ────────────────────────────────────
git add -A
CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

if [ "$CHANGED" = "0" ]; then
  echo "  Nothing changed — already up to date."
  echo ""
  read -p "  Press Enter to close..."
  exit 0
fi

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
git commit -m "Deploy $TIMESTAMP"

# ── Push ─────────────────────────────────────────────
echo ""
echo "  Pushing $CHANGED changed file(s) to GitHub..."
echo ""

git push -u origin main 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo "  ✓ Deployed successfully!"
  echo "  Live at: https://jacobbudnitz.com"
  echo ""
  open "https://jacobbudnitz.com"
else
  echo ""
  echo "  ✗ Push failed. You may need to authenticate."
  echo ""
  echo "  Run this once in Terminal to log in:"
  echo "  gh auth login"
  echo ""
  echo "  Or set up an SSH key:"
  echo "  https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
  echo ""
fi

read -p "  Press Enter to close..."
