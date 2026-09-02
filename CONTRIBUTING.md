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

## How to read these rules

`MUST`, `MUST NOT`, `REQUIRED`, and `PROHIBITED` describe acceptance gates. A
pull request that does not meet them is not mergeable. `SHOULD` describes the
default expectation; deviations need a concrete explanation in the pull
request.

Maintainers may close a pull request that repeatedly ignores review feedback,
changes scope without agreement, weakens a security boundary, or cannot provide
reproducible evidence.

## Before starting

For a typo, small documentation correction, or focused test improvement, a pull
request can be opened directly.

For a new scenario, API redesign, dependency upgrade, or change that alters the
synthesized graph, first open a scenario proposal or start a GitHub Discussion.
This lets contributors agree on the failure being reproduced and the evidence
needed to prove the fix.

The following changes **require an accepted issue or scenario proposal before
code is submitted**:

- a new AWS service or dependency scenario;
- a new production dependency or CDK feature flag;
- a change to stack boundaries or cross-stack reference strength;
- a change to security-group, IAM, encryption, or network behavior;
- a breaking command, file-layout, or test-contract change;
- an automated deployment or any workflow permission increase.

Pull requests opened without the required proposal may be closed so design
discussion does not happen inside an implementation review.

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

### Branch names

Branches **must** use one of these prefixes and a short lowercase slug:

```text
scenario/s3-eventbridge-cycle
fix/connectivity-egress
docs/export-migration
test/stack-ownership
refactor/graph-detector
chore/cdk-upgrade
ci/policy-check
```

Allowed prefixes are `scenario/`, `fix/`, `docs/`, `test/`, `refactor/`,
`chore/`, and `ci/`. Dependabot's generated `dependabot/` branches are also
allowed. Pull-request CI enforces this rule.

### Pull-request titles

Pull-request titles **must** use Conventional Commit form because squash merges
use the pull-request title:

```text
feat(s3): add EventBridge cycle scenario
fix(network): create the missing database egress rule
docs(exports): clarify the BOTH migration phase
test(sg): assert relationship-resource ownership
chore(deps): update aws-cdk-lib
```

Allowed types are `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`,
`build`, `perf`, and `revert`. The optional scope must contain lowercase letters,
digits, or hyphens. The summary must be specific and must not end with a period.

### Scope limits

- One pull request must address one reviewable concern.
- Generated images and lockfiles aside, a pull request over roughly 500 changed
  lines should be split unless the accepted proposal explains why it cannot be.
- Unrelated renames, formatting, dependency upgrades, and generated-file churn
  are prohibited.
- Force-pushing after review should be avoided. If history must be rewritten,
  notify reviewers because stale approvals are dismissed.

## Mandatory acceptance gates

| Gate | Required evidence |
|---|---|
| Linked context | Issue or discussion for every change that requires prior design review |
| Reproduction | Exact sanitized command and expected failure for a problem scenario |
| Graph | Before-and-after edges with arrows defined as consumer → producer |
| Construct ownership | L1/L2/L3 construct inventory and the template owning each relationship resource |
| Automated proof | Tests that fail without the correction and inspect synthesized behavior |
| Local policy | `npm run check:repository` passes |
| Build | `npm run build` passes under the supported Node.js version |
| Tests | `npm test` passes with no skipped replacement for relevant assertions |
| Synthesis | `npm run synth:all:valid` succeeds without credentials or cached context |
| Documentation | Scenario README, article, Mermaid, and PNG assets agree with the code |
| Security | No secret, real account ID, customer data, privilege expansion, or undocumented destructive setting |
| Review | CI green, every conversation resolved, and one code-owner approval |

Screenshots alone are not sufficient evidence for generated infrastructure.
Include template assertions, manifest edges, or sanitized synthesized snippets.

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
- Keep dependency versions exact and commit the corresponding lockfile update.
- A new dependency requires a reason in the pull request and must not duplicate
  capability already available in the repository or Node.js standard library.
- New GitHub Actions must be first-party or explicitly justified, use the
  minimum permissions, and be pinned to a reviewed major version or immutable
  commit.
- Tests must not make deploy, update, delete, bootstrap, or other mutating AWS
  calls.
- A solution must not gain synthesis success by opening network access,
  broadening IAM to `*`, disabling encryption, or removing a required
  permission boundary.

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

## Review and merge policy

`main` is protected. Contributor changes must be submitted through a pull
request and satisfy all of the following:

1. the `validate` status check passes on the latest commit;
2. the branch is up to date with `main`;
3. at least one code owner approves;
4. stale approvals are replaced after material changes;
5. all review conversations are resolved;
6. no unresolved security or correctness concern remains.

The repository uses squash merging so each pull request creates one focused
commit on `main`. Merge commits and rebase merges are disabled. Maintainers may
request additional review for IAM, networking, custom resources, cross-account
references, or changes to validation safety.

An approval means the reviewer has checked the generated graph and evidence; it
is not merely an acknowledgement that the source code looks reasonable.

See [GOVERNANCE.md](GOVERNANCE.md) for roles, decision making, and the narrow
conditions under which a maintainer may use an administrative bypass.

## Pull-request checklist

Before requesting review, confirm that:

- the branch name and pull-request title follow the required formats;
- a required design issue or scenario proposal is linked;
- `npm run check:repository` passes;
- `npm run build` passes;
- `npm test` passes;
- `npm run synth:all:valid` passes without credentials;
- intentional problem commands still fail for the documented reason;
- documentation and diagrams match the synthesized graph;
- no secret, account-specific context, or generated output is included;
- dependency and workflow changes are justified and minimally permissioned;
- the change is compatible with the MIT license.

By contributing, you agree that your contribution is licensed under the
repository's [MIT License](LICENSE).
