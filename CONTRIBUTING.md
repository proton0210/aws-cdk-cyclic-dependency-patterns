# Contributing

Thank you for helping make these AWS CDK dependency examples more accurate,
reproducible, and useful.

Contributions are welcome for:

- new cyclic-dependency scenarios;
- corrections to existing problem or solution stacks;
- stronger graph and template assertions;
- clearer diagrams and documentation;
- compatibility updates for supported AWS CDK releases;
- accessibility, security, and developer-experience improvements.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) in every project space.

## Before starting

For a typo, small documentation correction, or focused test improvement, a pull
request can be opened directly.

For a new scenario, API redesign, dependency upgrade, or change that alters the
synthesized graph, first open a scenario proposal or start a GitHub Discussion.
This lets contributors agree on the failure being reproduced and the evidence
needed to prove the fix.

Do not include AWS account IDs, credentials, generated `cdk.context.json`
content, customer templates, or production resource names in an issue or pull
request.

## Development setup

Requirements are listed in the main [README](README.md#requirements).

```bash
git clone \
  https://github.com/proton0210/aws-cdk-cyclic-dependency-patterns.git

cd aws-cdk-cyclic-dependency-patterns
npm ci
npm run build
npm test
npm run synth:all:valid
```

The valid synthesis command does not require AWS credentials. Keep new tests and
entrypoints environment-agnostic so they run in pull-request CI.

## Working on a change

1. Fork the repository and create a focused branch.
2. Make the smallest change that demonstrates the problem and solution.
3. Add or update tests that inspect synthesized behavior.
4. Update the scenario README and diagrams when graph ownership changes.
5. Run all local checks.
6. Open a pull request using the repository template.

Avoid combining dependency upgrades, formatting rewrites, and a new scenario in
one pull request unless they are inseparable.

## Adding a dependency scenario

A new scenario should contain all of the following:

1. **A minimal problem implementation.** It must fail at the documented layer:
   CDK synthesis, CloudFormation template validation, or a modeled update
   transition.
2. **A production-relevant solution.** The solution must remove, defer, reverse,
   or externalize an edge rather than suppressing the symptom.
3. **A construct inventory.** Document the L1/L2/L3 constructs and important
   CloudFormation resources they generate.
4. **Two graphs.** Show the failing edge direction and the corrected acyclic
   direction. State that arrows mean “depends on.”
5. **Automated evidence.** Test both the expected problem and the corrected
   resource placement or reference mechanism.
6. **Entrypoints and commands.** Make the scenario independently reproducible.
7. **Safety notes.** Identify chargeable resources, destructive removal
   policies, and whether validation deploys anything.

Put scenario code and its README together under `lib/<scenario-name>/`. Add
entrypoints under `bin/` and tests under `test/`.

## Code and test expectations

- Use strict TypeScript and keep `npm run build` free of warnings and errors.
- Prefer L2 constructs for solutions unless an L1 resource is needed to control
  relationship ownership explicitly.
- Keep intentionally broken code isolated behind its own entrypoint.
- Do not weaken a security boundary merely to make synthesis pass.
- Assert generated CloudFormation resource types, properties, ownership, or
  reference mechanisms—not only that a constructor completed.
- Avoid AWS lookups in unit tests and CI synthesis.
- Do not commit `cdk.out`, `cdk.context.json`, credentials, or account-specific
  generated content.

## Diagrams and documentation

Scenario READMEs use Mermaid so dependency edges remain reviewable as text. The
article also uses static PNG versions from `docs/diagrams/` for publishing
platform compatibility.

When a graph changes:

1. update the Mermaid source in the relevant README;
2. update `docs/diagrams/generate_diagrams.py` if the article diagram changes;
3. regenerate the PNG files with Python 3 and Pillow;
4. confirm that each image is readable at 1600 × 900 and remains below 2 MB;
5. preserve meaningful alt text.

## AWS-backed validation

Maintainers run:

```bash
AWS_PROFILE=dev-academy npm run validate:aws
```

Contributors with a suitable test profile may run the same command. It calls STS
and CloudFormation `ValidateTemplate`; it must never bootstrap, deploy, update,
or delete stacks.

Do not add deployment commands to automated tests or pull-request workflows.

## Pull-request checklist

Before requesting review, confirm that:

- `npm run build` passes;
- `npm test` passes;
- `npm run synth:all:valid` passes without credentials;
- intentional problem commands still fail for the documented reason;
- documentation and diagrams match the synthesized graph;
- no secret, account-specific context, or generated output is included;
- the change is compatible with the MIT license.

By contributing, you agree that your contribution is licensed under the
repository's [MIT License](LICENSE).
