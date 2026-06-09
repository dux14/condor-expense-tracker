#!/usr/bin/env bash
set -euo pipefail
ALLOW='^lib/(data|fx|auth|lock)/'
APIALLOW='^app/api/'
fail=0
scan() {
  matches=$(grep -rEln "$2" app components lib --include='*.ts' --include='*.tsx' 2>/dev/null \
    | grep -vE "$ALLOW" | grep -vE "$APIALLOW" || true)
  if [ -n "$matches" ]; then
    echo "INVARIANT VIOLATION ($1) in:"; echo "$matches"; fail=1
  fi
}
scan "supabase-js import"   "from ['\"]@supabase/"
scan "raw fetch call"       "(^|[^.A-Za-z])fetch\("
scan "localStorage access"  "(^|[^.A-Za-z])localStorage"
if [ "$fail" -ne 0 ]; then
  echo "FAIL: UI/non-edge code touches network or storage directly"; exit 1
fi
echo "OK: UI never touches network/storage directly"
