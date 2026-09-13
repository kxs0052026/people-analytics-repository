#!/bin/bash
# Loads nvm (if installed) so `npm`/`node` are on PATH even when this script
# is launched by a process manager that doesn't source ~/.zshrc, then starts
# the Vite dev server. Portable across machines/checkouts — no hardcoded
# node version or absolute paths.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  \. "$NVM_DIR/nvm.sh"
fi
cd "$(dirname "$0")/.."
exec npm run dev
