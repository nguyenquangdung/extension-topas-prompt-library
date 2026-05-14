#!/bin/bash
#
# <Project Name> — new machine setup
#
# Idempotent: safe to run multiple times.
# Symlinks project skills into ~/.claude/skills/ và renders LaunchAgent từ brain template.
#
# Pre-requisite: brain repo cloned at ~/Documents/AI CEO/

set -e

WORKSHOP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRAIN="$HOME/Documents/AI CEO"
PROJECT_SLUG="topas-prompt-ext"           # ← EDIT: e.g., theng-nhan, topas-pbi, bds-broker
CRON_PLIST_NAME=""              # ← EDIT (optional): e.g., com.bruce.<slug>-weekly.plist (empty if no cron)

echo "Workshop: $WORKSHOP"
echo "Brain:    $BRAIN"

# Sanity check
if [ ! -d "$BRAIN" ]; then
  echo "ERROR: Brain vault not found at $BRAIN. Clone bruce-brain first."
  exit 1
fi

# --- 1. Symlink project skills via brain claude-skills ---
mkdir -p "$HOME/.claude"
if [ -L "$HOME/.claude/skills" ]; then
  for skill_dir in "$WORKSHOP"/.claude/skills/${PROJECT_SLUG}-*; do
    [ -d "$skill_dir" ] || continue
    name=$(basename "$skill_dir")
    target="$BRAIN/99-Meta/claude-skills/$name"
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$skill_dir" ]; then
      echo "✓ Skill symlink exists: $name"
    else
      ln -sfn "$skill_dir" "$target"
      echo "✓ Linked: $name → $skill_dir"
    fi
  done
else
  echo "WARN: ~/.claude/skills is not a symlink (expected after brain reorg). Skip."
fi

# --- 2. Install LaunchAgent from brain template (if project has cron) ---
if [ -n "$CRON_PLIST_NAME" ]; then
  TPL="$BRAIN/99-Meta/cron/${CRON_PLIST_NAME}.tpl"
  LA_DST="$HOME/Library/LaunchAgents/${CRON_PLIST_NAME}"

  if [ -f "$TPL" ]; then
    HOME_PATH="$HOME" envsubst < "$TPL" > "$LA_DST.new"
    if [ -f "$LA_DST" ] && cmp -s "$LA_DST" "$LA_DST.new"; then
      rm "$LA_DST.new"
      echo "✓ LaunchAgent up-to-date: $LA_DST"
    else
      if [ -f "$LA_DST" ]; then
        launchctl unload "$LA_DST" 2>/dev/null || true
      fi
      mv "$LA_DST.new" "$LA_DST"
      launchctl load "$LA_DST"
      echo "✓ LaunchAgent installed + loaded: $LA_DST"
    fi
  else
    echo "WARN: LaunchAgent template not found at $TPL — skip cron setup"
  fi
fi

# --- 3. .env check ---
if [ ! -f "$WORKSHOP/.env" ]; then
  echo "⚠ .env missing. Copy from .env.example và fill values:"
  echo "   cp .env.example .env && vim .env"
fi

# --- 4. Dependencies check ---
if [ -f "$WORKSHOP/package.json" ] && [ ! -d "$WORKSHOP/node_modules" ]; then
  echo "ℹ Run \`npm install\` for Node deps"
fi
if [ -f "$WORKSHOP/requirements.txt" ] && [ ! -d "$WORKSHOP/.venv" ]; then
  echo "ℹ Create Python venv: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
fi

echo ""
echo "Setup done."
echo "Next steps:"
echo "  1. Edit $WORKSHOP/.env from .env.example"
echo "  2. Test: <project-specific test command>"
