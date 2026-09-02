#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "Checking whitespace errors..."
git diff --check

echo "Checking for prohibited tracked output..."
if git ls-files | rg -q '(^|/)(cdk\.out|node_modules|coverage|dist)(/|$)|(^|/)cdk\.context\.json$'; then
  git ls-files | rg '(^|/)(cdk\.out|node_modules|coverage|dist)(/|$)|(^|/)cdk\.context\.json$' >&2
  echo "Generated output or account-specific CDK context is tracked." >&2
  exit 1
fi

echo "Checking for common credential patterns..."
credential_pattern='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_'"access_key_id"'|aws_'"secret_access_key"'|-----BEGIN [A-Z ]*PRIVATE '"KEY"'-----)'
if rg -n \
  "$credential_pattern" \
  --hidden \
  -g '!node_modules/**' \
  -g '!cdk.out/**' \
  -g '!.git/**' \
  .; then
  echo "A potential credential or private key pattern was found." >&2
  exit 1
fi

echo "Checking diagram publishing limits..."
diagram_count=0
while IFS= read -r diagram; do
  size="$(wc -c <"$diagram" | tr -d ' ')"
  if [[ "$size" -gt 2097152 ]]; then
    echo "$diagram exceeds the 2 MB publishing limit." >&2
    exit 1
  fi
  diagram_count=$((diagram_count + 1))
done < <(rg --files docs/diagrams -g '*.png' | sort)

if [[ "$diagram_count" -ne 4 ]]; then
  echo "Expected 4 committed article diagrams, found $diagram_count." >&2
  exit 1
fi

echo "Checking article diagram references..."
article_diagram_count="$(
  rg -o 'https://raw\.githubusercontent\.com/[^ )]+/docs/diagrams/[^ )]+\.png' \
    docs/article.md \
    | wc -l \
    | tr -d ' '
)"

if [[ "$article_diagram_count" -ne 4 ]]; then
  echo "Expected 4 public diagram references in docs/article.md, found $article_diagram_count." >&2
  exit 1
fi

echo "Repository policy checks passed."
