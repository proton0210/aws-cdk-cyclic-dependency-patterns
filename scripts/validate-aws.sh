#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

validation_profile="${AWS_PROFILE:-dev-academy}"
export AWS_PROFILE="$validation_profile"

echo "Checking AWS profile authentication..."
aws sts get-caller-identity --profile "$validation_profile" >/dev/null

echo "Building and testing TypeScript..."
npm run build
npm test

total_validated=0

validate_templates() {
  local template_root="$1"
  local validated=0
  local template_file

  for template_file in "$template_root"/*.template.json; do
    [[ -f "$template_file" ]] || continue
    aws cloudformation validate-template \
      --profile "$validation_profile" \
      --template-body "file://$repo_root/$template_file" \
      >/dev/null
    echo "Validated: $template_file"
    validated=$((validated + 1))
    total_validated=$((total_validated + 1))
  done

  if [[ "$validated" -eq 0 ]]; then
    echo "No templates found under $template_root" >&2
    return 1
  fi
}

echo "Synthesizing and validating all solution stacks..."
npm run synth:solutions -- --profile "$validation_profile"
validate_templates "cdk.out/solutions"

echo "Synthesizing and validating the downstream connectivity solution..."
npm run synth:sg:connectivity -- --profile "$validation_profile"
validate_templates "cdk.out/connectivity-solution"

echo "Confirming the S3/Lambda problem fails CloudFormation validation..."
npm run synth:s3:problem -- --profile "$validation_profile"
mkdir -p cdk.out/validation
if aws cloudformation validate-template \
  --profile "$validation_profile" \
  --template-body "file://$repo_root/cdk.out/problems/s3-lambda/Problem-S3LambdaCycle.template.json" \
  >cdk.out/validation/s3-problem.out \
  2>cdk.out/validation/s3-problem.err; then
  echo "Expected S3/Lambda problem template validation to fail." >&2
  exit 1
fi
rg -q 'Circular dependency between resources' cdk.out/validation/s3-problem.err
echo "Observed expected S3/Lambda circular dependency."

echo "Confirming the security-group problem fails CDK synthesis..."
if npm run synth:sg:problem -- --profile "$validation_profile" \
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
  npm run "synth:export:$phase" -- --profile "$validation_profile"
  validate_templates "cdk.out/export-migration/$phase"
done

echo "Validated $total_validated solution and migration templates."
echo "All expected failures and solution templates validated with AWS_PROFILE=$validation_profile."
