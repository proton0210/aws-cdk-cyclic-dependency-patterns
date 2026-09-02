#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

validation_profile="${AWS_PROFILE:-}"
profile_args=()
credential_source="the default AWS credential provider chain"

if [[ -n "$validation_profile" ]]; then
  profile_args=(--profile "$validation_profile")
  credential_source="AWS_PROFILE=$validation_profile"
fi

echo "Checking AWS authentication with $credential_source..."
aws sts get-caller-identity "${profile_args[@]}" >/dev/null

echo "Building and testing TypeScript..."
npm run build
npm test

total_validated=0
expected_total=16

# Validation must be repeatable and must not reuse obsolete synthesized files.
rm -rf \
  cdk.out/connectivity-solution \
  cdk.out/export-migration \
  cdk.out/problems/s3-lambda \
  cdk.out/problems/security-group \
  cdk.out/solutions \
  cdk.out/validation
mkdir -p cdk.out/validation

run_synth() {
  CDK_EXAMPLES_ENV_AGNOSTIC=1 npm run "$1"
}

validate_templates() {
  local template_root="$1"
  local expected="$2"
  local validated=0
  local template_file

  for template_file in "$template_root"/*.template.json; do
    [[ -f "$template_file" ]] || continue
    aws cloudformation validate-template \
      "${profile_args[@]}" \
      --template-body "file://$repo_root/$template_file" \
      >/dev/null
    echo "Validated: $template_file"
    validated=$((validated + 1))
    total_validated=$((total_validated + 1))
  done

  if [[ "$validated" -ne "$expected" ]]; then
    echo "Expected $expected templates under $template_root, found $validated." >&2
    return 1
  fi
}

echo "Synthesizing and validating all solution stacks..."
run_synth synth:solutions
validate_templates "cdk.out/solutions" 6

echo "Synthesizing and validating the downstream connectivity solution..."
run_synth synth:sg:connectivity
validate_templates "cdk.out/connectivity-solution" 4

echo "Confirming the S3/Lambda problem fails CloudFormation validation..."
run_synth synth:s3:problem \
  >cdk.out/validation/s3-problem-synth.out \
  2>cdk.out/validation/s3-problem-synth.err
if aws cloudformation validate-template \
  "${profile_args[@]}" \
  --template-body "file://$repo_root/cdk.out/problems/s3-lambda/Problem-S3LambdaCycle.template.json" \
  >cdk.out/validation/s3-problem.out \
  2>cdk.out/validation/s3-problem.err; then
  echo "Expected S3/Lambda problem template validation to fail." >&2
  exit 1
fi
rg -q 'Circular dependency between resources' cdk.out/validation/s3-problem.err
echo "Observed expected S3/Lambda circular dependency."

echo "Confirming the security-group problem fails CDK synthesis..."
if run_synth synth:sg:problem \
  >cdk.out/validation/security-group-problem.out \
  2>cdk.out/validation/security-group-problem.err; then
  echo "Expected security-group problem synthesis to fail." >&2
  exit 1
fi
rg -q 'would create a cyclic reference' \
  cdk.out/validation/security-group-problem.err \
  cdk.out/validation/security-group-problem.out
echo "Observed expected cross-stack cyclic reference."

for phase in strong both weak; do
  echo "Synthesizing export migration phase: $phase"
  run_synth "synth:export:$phase"
  validate_templates "cdk.out/export-migration/$phase" 2
done

if [[ "$total_validated" -ne "$expected_total" ]]; then
  echo "Expected $expected_total validated templates, found $total_validated." >&2
  exit 1
fi

echo "Validated $total_validated solution and migration templates."
echo "All expected failures and solution templates validated with $credential_source."
