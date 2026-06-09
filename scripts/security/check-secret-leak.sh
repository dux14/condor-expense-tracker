#!/usr/bin/env bash
# Fails (exit 1) if any server-only secret pattern leaks into the client bundle.
set -euo pipefail
BUNDLE_DIRS=(".next/static" ".next/server/app" "out")
PATTERNS='sb_secret_|SUPABASE_SECRET_KEY|service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.'
found=0
for d in "${BUNDLE_DIRS[@]}"; do
  [ -d "$d" ] || continue
  if grep -rEl "$PATTERNS" "$d" 2>/dev/null; then
    echo "LEAK: secret-like string found above in $d"
    found=1
  fi
done
if [ "$found" -ne 0 ]; then
  echo "FAIL: server secret material present in client bundle"; exit 1
fi
echo "OK: no server secret in client bundle"
