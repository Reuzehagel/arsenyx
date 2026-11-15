#!/usr/bin/env bash
# Cloud sessions never show the workspace-trust dialog, so they ignore the
# marketplaces and plugins declared in .claude/settings.json. Install them
# from the CLI instead. Local sessions get them from the trust prompt.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
command -v claude >/dev/null || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

# ponytail's SessionStart hook otherwise asks Claude to set up its statusline
# badge in every fresh container; an existing nudge flag marks it as declined.
touch "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.ponytail-statusline-nudged"

claude plugin marketplace add mattpocock/skills >/dev/null 2>&1
claude plugin marketplace add DietrichGebert/ponytail >/dev/null 2>&1
# --scope local writes the gitignored settings.local.json, so the tree stays clean.
claude plugin install mattpocock-skills@mattpocock --scope local >/dev/null 2>&1
claude plugin install ponytail@ponytail --scope local >/dev/null 2>&1
exit 0
