# Project governance

## Roles

### Contributor

Anyone who opens an issue, joins a discussion, reviews documentation, or submits
a pull request is a contributor. Contributors do not receive direct write access
by default.

### Reviewer

A reviewer evaluates correctness, dependency direction, evidence, safety, and
documentation. A review must identify blocking concerns clearly and distinguish
them from optional suggestions.

### Maintainer

Maintainers triage reports, approve proposals, review and merge pull requests,
manage releases and repository settings, and enforce the Code of Conduct.
Maintainer status is granted by the repository owner based on sustained,
high-quality participation and demonstrated judgment around AWS safety.

The current code owner is declared in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Decisions

- Small corrections are decided through pull-request review.
- New scenarios and architectural changes require an accepted issue or GitHub
  Discussion before implementation.
- Security-sensitive decisions prioritize least privilege, isolation, and
  reproducible evidence over convenience.
- When reasonable alternatives remain, maintainers document the chosen trade-off
  in the issue or pull request.
- The repository owner makes the final decision when consensus cannot be
  reached.

## Merge authority

Only maintainers merge pull requests. A pull request is eligible only after the
mandatory gates in [CONTRIBUTING.md](CONTRIBUTING.md#mandatory-acceptance-gates)
are satisfied.

The normal merge method is squash merge. The pull-request title becomes the
commit subject and therefore must follow the required Conventional Commit form.

## Administrative bypass

Branch-protection administrators are technically able to bypass some rules. A
bypass is permitted only for:

- an urgent security fix being coordinated privately;
- recovery from a broken repository rule or CI configuration that prevents all
  pull requests from completing; or
- reverting a change that is actively causing repository or supply-chain harm.

The maintainer must document the reason immediately afterward in an issue,
discussion, commit, or security advisory. Administrative bypass must not be used
to avoid ordinary review, tests, or disagreement.

## Changes to governance

Changes to contribution gates, branch protection, code ownership, security
reporting, or this governance document require a dedicated pull request. The
pull request must explain how contributor access, maintainer authority, and
repository safety change.
