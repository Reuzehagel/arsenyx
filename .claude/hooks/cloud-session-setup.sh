#!/usr/bin/env bash
# Cloud-session setup. Cloud sessions never show the workspace-trust dialog,
# so they ignore the marketplaces and plugins declared in .claude/settings.json;
# install them from the CLI instead. Local sessions get them from the trust
# prompt and bring their own `just`.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Commit as the repo owner, not as Claude: the image's global git config
# authors commits as "Claude <noreply@anthropic.com>", and GitHub turns those
# authors into a Co-authored-by trailer on the squash commit. Only replaces
# that default identity, so a session already set up as someone else keeps it.
# Signing stays off: the session's key isn't on the owner's GitHub account, so
# signed commits would show as Unverified (the squash commit GitHub makes on
# merge is signed by GitHub either way).
if [ "$(git config user.email)" = noreply@anthropic.com ]; then
  git config --local user.name Reuzehagel
  git config --local user.email 105865503+Reuzehagel@users.noreply.github.com
  git config --local commit.gpgsign false
fi
# .githooks/commit-msg strips Claude trailers from any message that still has them.
git config --local core.hooksPath .githooks

# `just check` is the repo's gate; the cloud image doesn't ship `just`.
command -v just >/dev/null || uv tool install rust-just >/dev/null 2>&1

command -v claude >/dev/null || exit 0
claude plugin marketplace add mattpocock/skills >/dev/null 2>&1
# --scope local writes the gitignored settings.local.json, so the tree stays clean.
claude plugin install mattpocock-skills@mattpocock --scope local >/dev/null 2>&1
exit 0
