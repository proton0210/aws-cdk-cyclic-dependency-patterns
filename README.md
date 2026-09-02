# AWS CDK cyclic dependency patterns in TypeScript

This repository turns three common “cyclic dependency” failures into
reproducible AWS CDK examples. Each scenario contains an intentionally broken
implementation, a corrected dependency graph, construct-level documentation,
and tests that inspect the synthesized CloudFormation behavior.

The examples accompany the article **Overcoming Cyclic Dependencies in AWS CDK
with TypeScript**. They were compiled against `aws-cdk-lib` 2.267.0 and
validated with the `dev-academy` AWS profile without deploying resources.

> A cycle is a graph problem. Fix it by removing, deferring, reversing, or
> externalizing an edge. `addDependency()` only adds another edge.

![Flow from CDK constructs to the CloudFormation dependency graph](docs/diagrams/cdk-to-cloudformation-flow.png)

## What is reproduced

| Scenario | Failure layer | Intentionally broken graph | Validated solution |
|---|---|---|---|
| [S3 notification and Lambda](lib/s3-lambda/) | One CloudFormation template | Bucket notification, function role, and bucket ARN close a resource loop | S3 and Lambda L2 constructs defer notification mutation with `Custom::S3BucketNotifications` |
| [ECS, Aurora, and security groups](lib/security-groups/) | CDK stack synthesis | Compute imports the DB endpoint while a DB-owned ingress rule imports `ServiceSg` | Put both connection rules in the already-dependent compute stack or a downstream connectivity stack |
| [Cross-stack export removal](lib/export-deadlock/) | CloudFormation update | A deployed consumer still imports an export that the producer update removes | Deploy `STRONG → BOTH → WEAK`, then remove the consumer reference or producer resource |

The scenarios are deliberately different. The first is a resource cycle inside
one template, the second is a cycle between CDK stacks, and the third is a
transition deadlock between two otherwise valid deployed states.

## The dependency model

An arrow in the documentation means **depends on**. If `ComputeStack` embeds the
Aurora endpoint from `DatabaseStack`, the direction is:

```mermaid
flowchart LR
  Compute[ComputeStack] -->|DB_HOST: Fn::ImportValue| Database[DatabaseStack]
  Database -->|VPC reference| Network[NetworkStack]
  Compute -->|VPC reference| Network
```

This is a directed acyclic graph. The failing security-group method call adds
the reverse edge:

```mermaid
flowchart LR
  Compute[ComputeStack] -->|database endpoint| Database[DatabaseStack]
  Database -->|DB-owned ingress imports ServiceSg| Compute
```

Runtime traffic arrows can point in both directions without causing a deployment
cycle. What matters is the generated CloudFormation ownership and references.

## Repository map

```text
.
├── bin/                         # One CDK entrypoint per problem or solution
├── docs/
│   ├── article.md               # Repository-aligned long-form article
│   └── diagrams/                # Static PNG diagrams and their generator
├── lib/
│   ├── common/                  # CLI environment helper
│   ├── export-deadlock/         # DataStack and ApiStack migration phases
│   ├── s3-lambda/               # Same-template resource cycle
│   ├── security-groups/         # Network, database, compute, and edge stacks
│   └── testing/                 # CloudFormation resource-cycle detector
├── scripts/validate-aws.sh      # Read-only AWS validation
└── test/                        # CDK assertion and graph tests
```

Every scenario directory has its own README with:

- the runtime requirement;
- the CDK constructs and generated CloudFormation resources;
- the exact failing dependency edges;
- the corrected graph and code location;
- commands and expected results.

## Requirements

- Node.js 20 or newer; CI uses Node.js 22
- npm
- AWS CLI v2 for AWS-backed template validation
- `rg` (ripgrep), used by the validation script
- an AWS profile with permission for `sts:GetCallerIdentity` and
  `cloudformation:ValidateTemplate`

The exact package versions are locked in `package-lock.json`:

- `aws-cdk-lib` 2.267.0
- `aws-cdk` CLI 2.1139.0
- TypeScript 5.9.2

## Install and run local checks

```bash
npm ci
npm run build
npm test
npm run synth:all:valid
```

The solution synthesis is credential-independent. Without an AWS profile, the
entrypoints create environment-agnostic stacks so CI does not depend on a local
`cdk.context.json` file. When `--profile` is supplied, the CDK CLI provides the
selected account and Region at the application boundary.

## Validate with an AWS profile

```bash
AWS_PROFILE=dev-academy npm run validate:aws
```

The script performs the following checks:

1. Calls STS `GetCallerIdentity` to confirm the profile works.
2. Compiles the TypeScript and runs all tests.
3. Synthesizes every solution stack.
4. Calls CloudFormation `ValidateTemplate` for each valid template.
5. Confirms that the S3/Lambda problem fails with `Circular dependency between
   resources`.
6. Confirms that the security-group problem fails synthesis with `would create
   a cyclic reference`.
7. Synthesizes and validates the strong, both, and weak export phases.

### Safety boundary

`validate:aws` does **not** bootstrap, deploy, update, or delete stacks. It only
uses STS and CloudFormation template validation.

The examples include resources that incur charges if manually deployed,
including Aurora Serverless v2 and ECS Fargate. The stateful example resources
also use destructive removal policies to make a disposable lab easier to clean
up. Do not copy those lifecycle settings into production without an explicit
data-retention decision.

## Commands by scenario

### S3 and Lambda

```bash
AWS_PROFILE=dev-academy npm run synth:s3:problem
AWS_PROFILE=dev-academy npm run synth:s3:solution
```

The problem synthesizes a template, but CloudFormation validation rejects that
template. See [the S3/Lambda walkthrough](lib/s3-lambda/).

### Cross-stack security groups

```bash
# Expected CDK synthesis failure.
AWS_PROFILE=dev-academy npm run synth:sg:problem

# ComputeStack owns ingress and egress relationship resources.
AWS_PROFILE=dev-academy npm run synth:sg:solution

# A downstream ConnectivityStack owns both relationship resources.
AWS_PROFILE=dev-academy npm run synth:sg:connectivity
```

See [the ECS/Aurora walkthrough](lib/security-groups/).

### Export migration

```bash
AWS_PROFILE=dev-academy npm run synth:export:strong
AWS_PROFILE=dev-academy npm run synth:export:both
AWS_PROFILE=dev-academy npm run synth:export:weak
```

All three entrypoints use the same CloudFormation stack names so the templates
model updates to one deployed application. The repository does not deploy the
migration automatically. See [the export walkthrough](lib/export-deadlock/).

## Tests as architectural guardrails

The tests verify generated behavior rather than only checking that constructors
return successfully:

- the L1 S3 template contains a detectable resource cycle;
- the L2 S3 solution contains one `Custom::S3BucketNotifications` resource and
  no resource cycle;
- the security-group problem exposes CDK's cyclic-reference annotation;
- the consumer-owned solution emits PostgreSQL ingress and egress rules in
  `ComputeStack`, not `DatabaseStack`;
- the connectivity solution emits both rules in `ConnectivityStack` and
  synthesizes without a stack cycle;
- strong references contain `Export` and `Fn::ImportValue`;
- `BOTH` retains the export while the consumer uses `Fn::GetStackOutput`;
- `WEAK` removes the export lock.

## Design rules demonstrated

1. Inspect the synthesized resource and stack graph, not only TypeScript call
   order.
2. Keep cohesive resources in one construct or stack unless deployment
   lifecycle requires a split.
3. Treat permissions, notifications, subscriptions, routes, and security-group
   rules as relationship resources with explicit owners.
4. Put a cross-stack relationship in the stack already downstream of the
   referenced resource.
5. If neither endpoint should own the relationship, use a third stack that
   remains downstream of both.
6. Treat removal of a strong export as a multi-deployment migration.
7. Assert reference mechanisms and resource placement in tests.

## Primary references

- [AWS CDK resources and cross-stack reference strength](https://docs.aws.amazon.com/cdk/v2/guide/resources.html)
- [AWS CDK best practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [AWS CDK EC2 cross-stack connections](https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_ec2/README.html#cross-stack-connections)
- [CloudFormation `DependsOn`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html)
- [CloudFormation `Fn::ImportValue`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-importvalue.html)
- [CloudFormation `Fn::GetStackOutput`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getstackoutput.html)
- [AWS guidance for CloudFormation circular dependencies](https://aws.amazon.com/blogs/infrastructure-and-automation/handling-circular-dependency-errors-in-aws-cloudformation/)

## License

MIT
