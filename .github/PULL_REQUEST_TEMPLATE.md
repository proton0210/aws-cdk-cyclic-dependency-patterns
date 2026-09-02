## Summary

Describe the dependency problem, solution, or documentation change.

## Dependency graph

- What edge or resource ownership changes?
- Which stack or CloudFormation template owns the relationship before and after?

## Evidence

List the commands run and the relevant synthesized assertions or expected
failure message.

## Checklist

- [ ] `npm run build` passes.
- [ ] `npm test` passes.
- [ ] `npm run synth:all:valid` passes without AWS credentials.
- [ ] Intentional problem examples still fail for the documented reason.
- [ ] Scenario README, article text, and diagrams match the code change.
- [ ] No credentials, account-specific context, or generated `cdk.out` content is included.
- [ ] No deployment command was added to pull-request automation.
