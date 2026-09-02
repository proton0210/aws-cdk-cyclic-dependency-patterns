# Security policy

## Supported code

This repository contains educational infrastructure examples rather than a
published runtime package. Security fixes target the latest commit on `main`.

## Reporting a vulnerability

Do not disclose a vulnerability, credential, AWS account identifier, or
customer infrastructure detail in a public issue or discussion.

Use GitHub's private vulnerability reporting form:

https://github.com/proton0210/aws-cdk-cyclic-dependency-patterns/security/advisories/new

Include:

- the affected file, construct, or synthesized resource;
- the security impact and realistic attack path;
- minimal reproduction steps that contain no secrets;
- the AWS CDK and Node.js versions used;
- a suggested remediation, if known.

Maintainers will acknowledge the report through the private advisory, evaluate
the impact, coordinate a correction, and publish credit if the reporter wants
to be named.

## Example-code boundary

The repository validation path synthesizes templates and calls CloudFormation
`ValidateTemplate`; it does not deploy resources. Example lifecycle settings,
network placement, and inline Lambda handlers are designed for reproducibility
and must be reviewed before production use.
