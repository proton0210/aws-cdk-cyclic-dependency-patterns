#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "Checking whitespace errors..."
git diff --check
if grep -RInIE \
  '[[:blank:]]+$' \
  --exclude='*.png' \
  --exclude-dir=node_modules \
  --exclude-dir=cdk.out \
  --exclude-dir=coverage \
  --exclude-dir=dist \
  --exclude-dir=.git \
  .; then
  echo "Text files contain trailing whitespace." >&2
  exit 1
fi

echo "Checking for prohibited tracked output..."
if git ls-files | grep -Eq '(^|/)(cdk\.out|node_modules|coverage|dist)(/|$)|(^|/)cdk\.context\.json$'; then
  git ls-files | grep -E '(^|/)(cdk\.out|node_modules|coverage|dist)(/|$)|(^|/)cdk\.context\.json$' >&2
  echo "Generated output or account-specific CDK context is tracked." >&2
  exit 1
fi

echo "Checking for common credential patterns..."
credential_pattern='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_'"access_key_id"'|aws_'"secret_access_key"'|aws_'"session_token"'|g'"h[pousr]_"'[A-Za-z0-9_]{20,}|github_'"pat_"'[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE '"KEY"'-----)'
if grep -RInIE \
  "$credential_pattern" \
  --exclude-dir=node_modules \
  --exclude-dir=cdk.out \
  --exclude-dir=.git \
  .; then
  echo "A potential credential or private key pattern was found." >&2
  exit 1
fi

echo "Checking for local profile names..."
local_profile='dev-'"academy"
if rg -n \
  --hidden \
  --glob '!node_modules/**' \
  --glob '!cdk.out/**' \
  --glob '!.git/**' \
  "$local_profile" \
  .; then
  echo "A local AWS profile name was found. Use a neutral placeholder." >&2
  exit 1
fi

echo "Checking local Markdown links..."
broken_links=0
while IFS=: read -r source_file line_number markdown_match; do
  target="$(
    printf '%s' "$markdown_match" \
      | sed -e 's/^](//' -e 's/)$//' -e 's/#.*$//'
  )"

  case "$target" in
    ''|http://*|https://*|mailto:*) continue ;;
  esac

  if [[ "$target" = /* ]]; then
    resolved_target=".${target}"
  else
    resolved_target="$(dirname "$source_file")/$target"
  fi

  if [[ ! -e "$resolved_target" ]]; then
    echo "$source_file:$line_number links to missing path: $target" >&2
    broken_links=$((broken_links + 1))
  fi
done < <(rg -n -o '\]\([^)]+\)' --glob '*.md')

if [[ "$broken_links" -ne 0 ]]; then
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
done < <(find docs/diagrams -type f -name '*.png' -print | sort)

if [[ "$diagram_count" -ne 4 ]]; then
  echo "Expected 4 committed article diagrams, found $diagram_count." >&2
  exit 1
fi

echo "Checking article diagram references..."
article_diagram_count="$(
  grep -Eo 'https://raw\.githubusercontent\.com/[^ )]+/docs/diagrams/[^ )]+\.png' \
    docs/article.md \
    | wc -l \
    | tr -d ' '
)"

if [[ "$article_diagram_count" -ne 4 ]]; then
  echo "Expected 4 public diagram references in docs/article.md, found $article_diagram_count." >&2
  exit 1
fi

echo "Repository policy checks passed."
