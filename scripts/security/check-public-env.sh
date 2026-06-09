#!/usr/bin/env bash
set -euo pipefail
if grep -rEn "NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PRIVATE)" app lib middleware.ts 2>/dev/null; then
  echo "FAIL: a secret is exposed under a NEXT_PUBLIC_ name"; exit 1
fi
if grep -rEn "NEXT_PUBLIC_SUPABASE_SECRET" . --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules; then
  echo "FAIL: NEXT_PUBLIC_SUPABASE_SECRET referenced"; exit 1
fi
if [ -f .env.example ] && grep -qE "sb_secret_|service_role" .env.example; then
  echo "FAIL: .env.example contains a secret value"; exit 1
fi
echo "OK: no secret exposed under NEXT_PUBLIC_"
