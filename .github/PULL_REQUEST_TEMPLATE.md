## Summary

Describe the dependency problem, solution, or documentation change.

## Linked issue or discussion

Required for new scenarios, graph changes, dependencies, security behavior, and
workflow permission changes. Use `Closes #123` when applicable.

## Failure layer and reproduction

- Detection phase: TypeScript / CDK synthesis / CloudFormation validation / CloudFormation update
- Sanitized reproduction command:
- Expected problem error:

## Dependency graph before and after

- Before, using consumer → producer arrows:
- After, using consumer → producer arrows:
- Relationship-resource owner before:
- Relationship-resource owner after:

## Evidence

List the tests, synthesized resources, manifest edges, and commands that prove
the problem and solution. Screenshots alone are not sufficient.

## Security and operational impact

Describe changes to IAM, networking, encryption, lifecycle policies, GitHub
workflow permissions, chargeable resources, and deployment behavior. Write
`None` only after checking each category.

## Checklist

- [ ] My branch name and pull-request title follow `CONTRIBUTING.md`.
- [ ] I linked the required accepted issue or discussion.
- [ ] `npm run check:repository` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:coverage` passes and meets the configured thresholds.
- [ ] `npm run synth:all:valid` passes without AWS credentials.
- [ ] Intentional problem examples still fail for the documented reason.
- [ ] Scenario README, article text, and diagrams match the code change.
- [ ] New behavior has assertions against synthesized resources or references.
- [ ] Dependency or workflow changes are justified and minimally permissioned.
- [ ] The change does not broaden IAM or network access merely to make synthesis pass.
- [ ] No credentials, account-specific context, or generated `cdk.out` content is included.
- [ ] No deployment command was added to pull-request automation.
- [ ] I agree that this contribution is licensed under the MIT License.
