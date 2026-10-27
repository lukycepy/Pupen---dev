#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

find_repo_root() {
  local dir="$SCRIPT_DIR"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

REPO_ROOT="$(find_repo_root || true)"
if [[ -z "$REPO_ROOT" ]]; then
  echo "ERROR: Nepodarilo se najit root projektu (package.json)." >&2
  exit 1
fi

cd "$REPO_ROOT"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

load_env_file ".env"
load_env_file ".env.local"
load_env_file ".env.production"
load_env_file ".env.production.local"

WITH_DB=0
SKIP_BUILD=0
SKIP_INSTALL=0

for arg in "$@"; do
  case "$arg" in
    --with-db)
      WITH_DB=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-install)
      SKIP_INSTALL=1
      ;;
    *)
      echo "ERROR: Neznamy parametr: $arg" >&2
      echo "Pouziti: ./Ostatni/scripts/ops/deploy-from-git.sh [--with-db] [--skip-build] [--skip-install]" >&2
      exit 1
      ;;
  esac
done

echo "== Pupen deploy z Gitu =="
echo "Repo: $REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree neni cisty. Nejdriv commitni, stashni nebo odstran lokalni zmeny." >&2
  git status --short
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Branch: $CURRENT_BRANCH"

echo "-- git fetch"
git fetch --prune origin

echo "-- git pull"
git pull --ff-only origin "$CURRENT_BRANCH"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "-- npm ci"
  npm ci
fi

if [[ "$WITH_DB" -eq 1 ]]; then
  echo "-- db migrate prod"
  npm run db:migrate:prod
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "-- npm run build"
  npm run build
fi

echo "-- pm2 restart pupen-app --update-env"
pm2 restart pupen-app --update-env

echo "-- health check"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null && echo "OK: local health endpoint odpovida."
else
  echo "INFO: curl neni nainstalovany, health check preskocen."
fi

echo "== Hotovo =="
