# Overcoming Cyclic Dependencies in AWS CDK with TypeScript

AWS CDK lets us describe infrastructure with familiar TypeScript objects and
method calls. That convenience can hide the artifact that ultimately matters:
the directed dependency graph AWS CloudFormation must create, update, and
delete.

When that graph contains `A → B → A`, there is no valid first node. The correct
response is not to “force the order.” It is to remove, defer, reverse, or
externalize one of the edges.

This article builds that mental model and applies it to three reproducible
scenarios:

1. An S3 bucket notification, Lambda function, execution role, and invocation
   permission form a resource cycle inside one CloudFormation template.
2. An ECS Fargate service consumes an Aurora endpoint while a database-owned
   security-group rule imports the service security group, creating a cycle
   between CDK stacks.
3. A valid DynamoDB-to-Lambda cross-stack reference becomes an update-time
   deadlock when CDK tries to remove an export that a deployed consumer still
   imports.

The complete TypeScript implementations, tests, diagrams, and validation script
are available in the public repository:
[aws-cdk-cyclic-dependency-patterns](https://github.com/proton0210/aws-cdk-cyclic-dependency-patterns).

The examples were compiled against `aws-cdk-lib` 2.267.0. On September 2, 2026,
the repository passed eight tests, credential-free synthesis, CloudFormation
validation for sixteen valid templates, and both expected negative checks using
an isolated test identity. The validation path did not deploy any AWS resources,
and the repository stores neither a profile name nor credentials.

![Flow from CDK constructs to a CloudFormation dependency graph](https://raw.githubusercontent.com/proton0210/aws-cdk-cyclic-dependency-patterns/main/docs/diagrams/cdk-to-cloudformation-flow.png)

---

## 1. The deployment model behind a CDK application

A CDK application contains two related structures:

- a **construct tree**, built while the TypeScript program runs; and
- one or more **CloudFormation resource graphs**, generated during synthesis.

The construct tree describes composition and ownership. The CloudFormation
graphs determine deployment ordering.

Consider an ordinary property reference:

```ts
new lambda.Function(this, 'Worker', {
  environment: {
    QUEUE_URL: queue.queueUrl,
  },
});
```

During TypeScript execution, `queue.queueUrl` is usually a token rather than the
final URL. When the function and queue are in the same stack, CDK turns that
token into `Ref`, `Fn::GetAtt`, `Fn::Join`, or a related intrinsic. If the
consumer and producer are in different stacks, CDK also needs a cross-stack
reference mechanism.

The [CloudFormation `DependsOn` documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html)
describes both explicit and implicit dependencies:

| Template expression in resource A | Meaning |
|---|---|
| `Ref` to resource B | A depends on B |
| `Fn::GetAtt` from B | A depends on B |
| Resource-dependent `Fn::Sub` | A depends on every referenced resource |
| `DependsOn: B` | A explicitly depends on B |
| `Fn::ImportValue` | The consumer stack strongly references an export from the producer |
| `Fn::GetStackOutput` | The value is looked up from another stack without creating an export deletion lock |

CloudFormation creates independent nodes in parallel. It orders only the nodes
connected by these edges. The same rule is reversed for deletion: the consumer
must be removed before the producer it references.

### A data dependency is not merely an ordering dependency

These operations solve different problems:

```ts
// Transfers a value. CDK must synthesize a cross-stack mechanism.
new CfnOutput(consumerStack, 'QueueArn', {
  value: queue.queueArn,
});

// Adds deployment ordering only. No value is transferred.
consumerStack.addStackDependency(producerStack);
```

If a consumer needs a value that does not exist until a producer deploys,
`addStackDependency()` cannot manufacture that value. If two value references
already form `A → B → A`, another ordering edge cannot make the graph acyclic.

### Runtime flow and deployment flow are different

An S3 bucket can invoke a Lambda function while the function reads from the same
bucket at runtime. An ECS task can connect to a database that returns query
results. Bidirectional runtime behavior is normal.

The deployment graph asks a different question: which resource definition
contains the identifier of which other resource, and which template owns the
relationship resource?

This distinction prevents a common debugging mistake: trying to redesign the
application's runtime request path when only CloudFormation resource ownership
needs to change.

---

## 2. “Cyclic dependency” can refer to different failures

Before changing code, identify the layer that reported the error.

| Failure | Detection point | Typical evidence | Correct response |
|---|---|---|---|
| TypeScript module cycle | Compile, bundle, or runtime | Partially initialized import or `undefined` | Refactor modules or move composition to an entrypoint |
| CDK stack cycle | `cdk synth` | `would create a cyclic reference` | Change cross-stack reference direction or relationship ownership |
| CloudFormation resource cycle | Template validation or deployment | `Circular dependency between resources` | Split or defer an inline relationship |
| Cross-stack export deadlock | Stack update or deletion | `Export ... cannot be deleted as it is in use by ...` | Migrate the consumer mechanism before removing the export |
| Runtime event loop | After deployment | Recursion, event storm, or repeated invocation | Add filtering, idempotency, or change the event design |

The repository demonstrates the middle three. They require different fixes even
though teams often describe all of them as “a CDK circular dependency.”

---

## 3. Scenario one: S3 notifications and Lambda permissions

### Requirement

An uploads bucket must invoke a processor Lambda function for object-created
events. The function also needs `s3:GetObject` permission on the uploads bucket.

### The intentionally broken L1 implementation

The problem stack uses L1 constructs so the CloudFormation edges remain
visible. The essential code from
[`problem-stack.ts`](https://github.com/proton0210/aws-cdk-cyclic-dependency-patterns/blob/main/lib/s3-lambda/problem-stack.ts)
is:

```ts
const bucket = new CfnBucket(this, 'Uploads');

const role = new CfnRole(this, 'ProcessorRole', {
  assumeRolePolicyDocument: new PolicyDocument({
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('lambda.amazonaws.com')],
        actions: ['sts:AssumeRole'],
      }),
    ],
  }),
  policies: [
    {
      policyName: 'ReadUploads',
      policyDocument: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [`${bucket.attrArn}/*`], // Role → Bucket
          }),
        ],
      }),
    },
  ],
});

const handler = new CfnFunction(this, 'Processor', {
  runtime: 'nodejs22.x',
  handler: 'index.handler',
  role: role.attrArn, // Function → Role
  code: {
    zipFile: 'exports.handler = async () => undefined;',
  },
});

const permission = new CfnPermission(this, 'InvokeFromS3', {
  action: 'lambda:InvokeFunction',
  functionName: handler.attrArn, // Permission → Function
  principal: 's3.amazonaws.com',
  sourceArn: bucket.attrArn,     // Permission → Bucket
  sourceAccount: Aws.ACCOUNT_ID,
});

bucket.notificationConfiguration = {
  lambdaConfigurations: [
    {
      event: 's3:ObjectCreated:*',
      function: handler.attrArn, // Bucket → Function
    },
  ],
};

// S3 validates destination permission when notification configuration is set.
bucket.addResourceDependency(permission); // Bucket → Permission
```

The most important edges are:

| Consumer | Producer | Why |
|---|---|---|
| S3 bucket | Lambda function | The bucket's create-time notification configuration contains the function ARN |
| Lambda function | IAM role | The function's `Role` property contains the role ARN |
| IAM role | S3 bucket | The inline role policy contains the bucket ARN |
| Lambda permission | Function and bucket | The permission scopes invocation to both resources |
| S3 bucket | Lambda permission | The explicit dependency waits for permission before applying notifications |

The shortest closed path is `Bucket → Function → Role → Bucket`.

![S3 and Lambda dependency cycle and deferred-notification solution](https://raw.githubusercontent.com/proton0210/aws-cdk-cyclic-dependency-patterns/main/docs/diagrams/s3-lambda-cycle-and-solution.png)

The stack can synthesize because CDK is able to emit the L1 resources.
CloudFormation rejects the resulting template:

```bash
npm run synth:s3:problem

aws cloudformation validate-template \
  --template-body \
  file://"$PWD/cdk.out/problems/s3-lambda/Problem-S3LambdaCycle.template.json"
```

Expected result:

```text
Circular dependency between resources: [...]
```

### Why another `DependsOn` does not help

`DependsOn` adds an edge. It can express a prerequisite that CloudFormation
cannot infer, but it does not remove any existing reference. The bucket already
depends on the function, the function depends on the role, and the role depends
on the bucket. Adding an edge from the bucket to the permission only adds
another path.

### Solution: defer notification mutation with L2 constructs

The solution stack uses `Bucket`, `Function`, `LambdaDestination`, and
`addEventNotification()`:

```ts
const bucket = new Bucket(this, 'Uploads', {
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

const handler = new LambdaFunction(this, 'Processor', {
  runtime: Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: Code.fromInline(
    'exports.handler = async (event) => console.log(JSON.stringify(event));',
  ),
});

bucket.grantRead(handler);
bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(handler),
);
```

This is not simply shorter syntax. It changes the resource graph.

`bucket.grantRead(handler)` produces a standalone IAM policy that can depend on
both the bucket and the execution role. The role itself no longer needs an
inline property that points back to the bucket.

`bucket.addEventNotification()` produces `Custom::S3BucketNotifications`. The
bucket can be created without an inline Lambda target, and the custom resource
applies the notification after the bucket, function, and invocation permission
exist.

The important synthesized relationships are therefore:

```text
Lambda function → execution role
Standalone read policy → bucket and execution role
Lambda permission → function and bucket
Notification custom resource → bucket, function, and permission
```

There is no create-time `Bucket → Function` property, so the old closed path no
longer exists.

```bash
npm run synth:s3:solution
```

The repository test verifies both architectural outcomes:

```ts
test('solution defers notifications to a custom resource', () => {
  const app = buildS3LambdaSolutionApp({ env: TEST_ENV });
  const stack = app.node.findChild('Solution-S3LambdaCycle') as Stack;
  const template = Template.fromStack(stack);

  template.resourceCountIs('Custom::S3BucketNotifications', 1);
  expect(findResourceCycles(template.toJSON())).toEqual([]);
});
```

### Production notes

- Review the custom resource provider's IAM policy. It must update the bucket's
  notification configuration.
- Coordinate all writers to the bucket notification document. A CDK-managed
  custom resource and an external process can overwrite each other's settings.
- A synthesis-time physical bucket name can remove some attribute dependencies,
  but global S3 name uniqueness and replacement constraints turn that name into
  a long-lived contract.
- The repository uses destructive removal settings only because it is a
  disposable example. Production data retention requires an explicit decision.

The lesson is broader than S3: when a relationship cannot exist until both
endpoints exist, model the relationship as a second-phase resource or custom
operation instead of embedding it in an endpoint's create-time properties.

---

## 4. Scenario two: ECS, Aurora, and cross-stack security groups

This scenario demonstrates why construct ownership matters even when the source
code looks reasonable.

### Stack and construct layout

The repository declares:

| Stack | Important CDK constructs |
|---|---|
| `NetworkStack` | `Vpc`, public subnets, isolated subnets |
| `DatabaseStack` | `SecurityGroup`, Aurora PostgreSQL `DatabaseCluster`, serverless v2 writer |
| `ComputeStack` | `SecurityGroup`, ECS `Cluster`, `FargateTaskDefinition`, `FargateService` |
| `ConnectivityStack` | Standalone `CfnSecurityGroupIngress` and `CfnSecurityGroupEgress` |

`DatabaseStack` and `ComputeStack` both consume VPC attributes from
`NetworkStack`.

`ComputeStack` also injects the Aurora endpoint into the container environment:

```ts
const container = taskDefinition.addContainer('Api', {
  image: ContainerImage.fromRegistry(
    'public.ecr.aws/docker/library/nginx:stable',
  ),
  environment: {
    // This token establishes ComputeStack → DatabaseStack.
    DB_HOST: props.database.clusterEndpoint.hostname,
  },
});
```

At this point the graph is valid:

```text
ComputeStack → DatabaseStack → NetworkStack
ComputeStack ─────────────────→ NetworkStack
```

### The method call that closes the graph

The problem application then calls:

```ts
database.databaseSg.addIngressRule(
  compute.serviceSg,
  Port.tcp(5432),
  'Incorrect cross-stack rule ownership',
);
```

The receiver, `databaseSg`, belongs to `DatabaseStack`. With the default
`remoteRule` behavior, CDK creates the standalone ingress resource under the
current security group. That resource needs the ID of `ServiceSg`, which belongs
to `ComputeStack`.

The new edge is therefore `DatabaseStack → ComputeStack`. Together with the
existing endpoint reference, the stack graph becomes:

```text
ComputeStack → DatabaseStack → ComputeStack
```

![Security-group stack cycle and two ownership solutions](https://raw.githubusercontent.com/proton0210/aws-cdk-cyclic-dependency-patterns/main/docs/diagrams/security-group-cycle-and-solutions.png)

The failure appears during CDK synthesis:

```bash
npm run synth:sg:problem
```

Expected evidence includes:

```text
would create a cyclic reference
```

The exact paths in the message can be verbose. Reduce them to the two stack
directions:

1. Which property makes compute consume database?
2. Which generated rule makes database consume compute?

### Solution A: create the connection from the already-dependent stack

The most direct fix is to let `ComputeStack` own the connection:

```ts
if (props.createConnectionInConsumer) {
  this.service.connections.allowTo(
    props.databaseSg,
    Port.tcp(5432),
    'ECS tasks to Aurora PostgreSQL',
  );
}
```

The [AWS CDK EC2 cross-stack connections documentation](https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_ec2/README.html#cross-stack-connections)
specifically recommends making a connection in the stack that already depends
on the other stack. A call through the caller's `connections` object creates
both ingress and egress security-group rules in the caller's stack.

That last detail matters in this repository because `ServiceSg` is created with:

```ts
this.serviceSg = new SecurityGroup(this, 'ServiceSg', {
  vpc: props.vpc,
  allowAllOutbound: false,
});
```

The service therefore needs an explicit TCP 5432 egress rule as well as an
ingress rule on the database group. The test asserts that both resources are in
`ComputeStack`.

The fixed graph remains one-directional:

```text
ComputeStack, including the relationship rules → DatabaseStack → NetworkStack
```

```bash
npm run synth:sg:solution
```

### Solution B: use a downstream connectivity stack

Sometimes database and compute teams should remain peer owners while a platform
team controls connectivity. In that case, put the relationship in a third stack
that imports both security-group IDs.

Because the service group denies default outbound traffic, the edge stack owns
both halves of the connection:

```ts
export class ConnectivityStack extends Stack {
  constructor(scope: Construct, id: string, props: ConnectivityStackProps) {
    super(scope, id, props);

    new CfnSecurityGroupIngress(this, 'DatabaseFromService', {
      groupId: props.databaseSg.securityGroupId,
      sourceSecurityGroupId: props.serviceSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'ECS tasks to Aurora PostgreSQL',
    });

    new CfnSecurityGroupEgress(this, 'ServiceToDatabase', {
      groupId: props.serviceSg.securityGroupId,
      destinationSecurityGroupId: props.databaseSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'ECS tasks to Aurora PostgreSQL',
    });
  }
}
```

The resulting directions are:

```text
ConnectivityStack → DatabaseStack → NetworkStack
ConnectivityStack → ComputeStack ──→ NetworkStack
```

Neither endpoint stack imports from the connectivity stack. That constraint is
essential: if the edge stack exports a value back to either endpoint, the cycle
can reappear.

```bash
npm run synth:sg:connectivity
```

### What about `remoteRule: true`?

`SecurityGroup.addIngressRule()` and `addEgressRule()` accept a `remoteRule`
argument. If the peer is another security group in a different stack,
`remoteRule: true` places the rule under the peer instead of the current group.

This can redirect the edge without changing the apparent call direction:

```ts
database.databaseSg.addIngressRule(
  compute.serviceSg,
  Port.tcp(5432),
  'PostgreSQL from ECS',
  true,
);
```

It is valid, but `service.connections.allowTo(databaseSg, port)` more clearly
communicates that compute is the consumer and owns the relationship. Whichever
API you choose, test the template containing the rule. Method names describe
intent; construct scope determines CloudFormation ownership.

### Choosing between the solutions

| Situation | Preferred default |
|---|---|
| Compute already imports the database endpoint, secret, or SG | Let `ComputeStack` call `service.connections.allowTo(...)` |
| Neither endpoint should own network policy | Use a downstream `ConnectivityStack` |
| Existing code must call from the database group | Use `remoteRule` deliberately and document it |
| Resources always deploy and change together | Put them in one stack and model the capability as a higher-level construct |

AWS CDK's [best-practices guide](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
recommends modeling logical capabilities with constructs and splitting stacks
according to deployment requirements. “One AWS service per stack” is rarely a
useful boundary by itself.

---

## 5. Scenario three: the export deadlock during an update

The first two scenarios are graph cycles. The third is different: both the
current deployment and the desired final deployment can be valid, while the
direct transition between them is blocked.

### Initial strong reference

`DataStack` owns a DynamoDB table:

```ts
export class DataStack extends Stack {
  readonly table: Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.table = new Table(this, 'Orders', {
      partitionKey: {
        name: 'orderId',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    CrossStackReferences.of(this.table).produce(
      props.referenceStrength,
    );
  }
}
```

`ApiStack` consumes the table name and ARN:

```ts
const handler = new LambdaFunction(this, 'Handler', {
  runtime: Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: Code.fromInline('exports.handler = async () => undefined;'),
  environment: {
    TABLE_NAME: props.table.tableName,
  },
});

props.table.grantWriteData(handler);
```

With `ReferenceStrength.STRONG`, the producer template contains CloudFormation
outputs with `Export`, and the consumer contains `Fn::ImportValue`.

This is useful referential integrity. As the
[`Fn::ImportValue` documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-importvalue.html)
states, an exported value cannot be modified or deleted while any deployed
stack imports it.

### How removal becomes a deadlock

Suppose one code change removes the consumer's table use and also causes CDK to
remove the producer's automatically generated export. If CDK attempts the
producer update first, the old deployed `ApiStack` still imports the export.
CloudFormation rejects the update:

```text
Export ... cannot be deleted as it is in use by ExportMigration-Api
```

The final templates may contain no reference at all, but CloudFormation cannot
jump directly to that final state without a safe intermediate deployment.

### Current CDK migration: `STRONG → BOTH → WEAK`

Current AWS CDK versions expose three reference strengths:

| Strength | Producer | Consumer | CloudFormation lifetime coupling |
|---|---|---|---|
| `STRONG` | Output with `Export` | `Fn::ImportValue` | Producer export cannot disappear while imported |
| `BOTH` | Keeps the export and a plain output | `Fn::GetStackOutput` | Transitional bridge; old strong consumers remain safe while new consumers move |
| `WEAK` | Plain output without export lock | `Fn::GetStackOutput` | Producer can be deleted independently of consumers |

The [`ReferenceStrength` API](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.ReferenceStrength.html)
and [CDK resource guide](https://docs.aws.amazon.com/cdk/v2/guide/resources.html)
describe these mechanisms.

![Strong, both, weak, and removal deployment phases](https://raw.githubusercontent.com/proton0210/aws-cdk-cyclic-dependency-patterns/main/docs/diagrams/cross-stack-reference-migration.png)

The repository has a separate entrypoint for each state while deliberately
keeping the same CloudFormation stack names.

#### Deployment 1: switch to `BOTH`

```ts
CrossStackReferences.of(this.table).produce(
  ReferenceStrength.BOTH,
);
```

Deploy both stacks. The producer keeps the export, while the consumer switches
from `Fn::ImportValue` to `Fn::GetStackOutput`.

#### Deployment 2: switch to `WEAK`

```ts
CrossStackReferences.of(this.table).produce(
  ReferenceStrength.WEAK,
);
```

Deploy again. The consumer no longer imports the export, so the producer can
remove the strong-side artifact safely.

#### Deployment 3: remove the reference or resource

Only after the weak phase has deployed should you remove the consumer usage,
producer output, table, or stack.

For a real environment, every phase should have its own review and deployment:

```bash
npm run synth:export:strong
npm run synth:export:both
npm run synth:export:weak
```

Do not edit the code through all three states and deploy only the final commit.
The intermediate deployed state is the solution.

### Weak references are a trade-off, not a free upgrade

CloudFormation's
[`Fn::GetStackOutput`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getstackoutput.html)
resolves an output when the consumer stack is created or updated. It avoids the
export deletion lock and can support cross-Region or cross-account references
with the appropriate role.

That flexibility deliberately weakens referential integrity:

- deleting the producer does not automatically update consumers;
- a later consumer update fails if the producer stack or output is missing;
- changing the producer output does not automatically redeploy consumers;
- cross-account access requires a narrowly scoped role that can describe the
  producer stack;
- current `Fn::GetStackOutput` expression-placement limitations still apply.

CDK can still retain deployment ordering in the cloud assembly so a first
deployment creates the producer before the consumer. “Weak” means there is no
CloudFormation export lifetime lock; it does not mean that the consumer can
resolve a missing output.

### Compatibility fallback for older CDK versions

If a project does not support reference strengths, use a two-deployment bridge:

1. Remove the consumer's use, but preserve the producer's automatic export with
   `stack.exportValue(resourceAttribute)`. Deploy the consumer change while the
   export still exists.
2. Confirm that no deployed stack imports the export. Then remove the retained
   export and resource.

```ts
// Temporary producer-side migration bridge.
this.exportValue(table.tableArn);
```

Do not guess CDK's generated export name. `exportValue()` retains the export for
the referenced token and is designed for this migration.

---

## 6. Why common “fixes” fail

### “Add an explicit dependency”

An explicit dependency is appropriate when ordering matters but no resource
property expresses it—for example, when a consumer reads a stable name from an
external registry.

It cannot resolve a value cycle. If `A → B` and `B → A` already exist, every
additional dependency preserves or worsens the cycle.

### “Pass the entire producer stack in props”

Passing constructs through typed props is idiomatic CDK. Passing an entire
stack, however, makes it easy for a consumer to mutate producer-owned constructs
and hide the intended direction.

Prefer the narrowest interfaces:

```ts
interface ComputeStackProps extends StackProps {
  readonly vpc: ec2.IVpc;
  readonly database: rds.IDatabaseCluster;
  readonly databaseSg: ec2.ISecurityGroup;
}
```

Narrow props do not change the graph automatically, but they expose which
values cross the boundary and reduce accidental reverse references.

### “Create one stack for every AWS service”

Service-by-service splitting creates many edge resources and reference paths.
Split by deployment lifecycle, ownership, blast radius, protection policy,
account, Region, or CloudFormation limits.

Keep resources together when they always deploy and change as one capability.
Use higher-level constructs to model reusable capabilities, and stacks to model
deployment units.

### “Write outputs and imports manually”

Manually creating `CfnOutput` and `Fn.importValue()` reproduces the same strong
CloudFormation coupling CDK normally generates. It may make the contract more
visible, but it does not remove a cycle or export lock.

### “Hard-code the ARN”

A stable physical name can intentionally decouple independently deployed
systems. It also gives up existence checks, complicates replacement, and creates
a naming/versioning contract.

Use stable names, SSM Parameter Store, DNS, or another registry when independent
deployment is a real requirement. Do not use them merely to hide an accidental
cycle inside one CDK application.

---

## 7. A repeatable diagnostic workflow

### Step 1: identify the failing phase

- TypeScript compile or runtime: inspect module imports.
- `cdk synth`: inspect construct and stack edges.
- CloudFormation validation/create: inspect one template's resources.
- CloudFormation update/delete: inspect deployed exports and imports.

### Step 2: synthesize the smallest entrypoint

```bash
npm run build
npm test
npm run synth:sg:problem
```

Reducing the app to the smallest failing graph makes the edge direction easier
to see than synthesizing an entire platform.

### Step 3: inspect the cloud assembly stack graph

```bash
jq '
  .artifacts
  | to_entries[]
  | select(.value.type == "aws:cloudformation:stack")
  | {
      stack: .key,
      dependencies: (.value.dependencies // [])
    }
' cdk.out/manifest.json
```

Look for two artifacts that list or imply one another, or for an integration
stack that has accidentally become an upstream producer.

### Step 4: locate reference and relationship resources

```bash
rg -n \
  'Fn::ImportValue|Fn::GetStackOutput|Export|DependsOn|Fn::GetAtt|"Ref"' \
  cdk.out

rg -n \
  'AWS::EC2::SecurityGroup(Ingress|Egress)' \
  cdk.out
```

For security groups, the template containing the standalone rule is often the
decisive evidence.

### Step 5: inspect deployed exports for update failures

```bash
aws cloudformation list-exports

aws cloudformation list-imports \
  --export-name 'the-exact-export-name'
```

Do not remove an export until every deployed import is gone or has migrated to a
weak mechanism.

### Step 6: draw the smallest closed path

Create one node for each resource or stack mentioned by the error. Add an arrow
from consumer to producer for each:

- `Ref`;
- `Fn::GetAtt`;
- resource-dependent `Fn::Sub`;
- `Fn::ImportValue`;
- explicit `DependsOn`;
- CDK method that creates or mutates a resource in another stack.

Find the shortest path that returns to its starting node. A working fix must
change at least one edge on that path.

### Step 7: verify the synthesized graph, not only the source refactor

After changing the code, confirm that:

- the relationship resource moved to the intended template;
- the reverse `Fn::ImportValue` disappeared;
- only one inter-stack dependency direction remains;
- expected ingress and egress rules both exist;
- `cdk diff` does not replace a protected stateful resource;
- migration phases preserve the contracts required by currently deployed
  consumers.

---

## 8. Test dependency direction as architecture

The repository treats graph behavior as testable output.

### Detect the intentional same-template cycle

[`dependency-graph.ts`](https://github.com/proton0210/aws-cdk-cyclic-dependency-patterns/blob/main/lib/testing/dependency-graph.ts)
collects `Ref`, `Fn::GetAtt`, resource-dependent `Fn::Sub`, and `DependsOn`
relationships, then performs a depth-first search for closed paths.

```ts
const assembly = app.synth();
const template = assembly.getStackArtifact(stack.artifactId).template;

expect(findResourceCycles(template).length).toBeGreaterThan(0);
```

### Assert security-group rule ownership

```ts
Template.fromStack(database).resourceCountIs(
  'AWS::EC2::SecurityGroupIngress',
  0,
);

Template.fromStack(compute).hasResourceProperties(
  'AWS::EC2::SecurityGroupIngress',
  {
    IpProtocol: 'tcp',
    FromPort: 5432,
    ToPort: 5432,
  },
);

Template.fromStack(compute).hasResourceProperties(
  'AWS::EC2::SecurityGroupEgress',
  {
    IpProtocol: 'tcp',
    FromPort: 5432,
    ToPort: 5432,
  },
);
```

The dedicated connectivity test makes the equivalent assertions against
`ConnectivityStack` and then synthesizes the entire app.

### Assert the migration mechanism

```ts
expect(both.api).toContain('Fn::GetStackOutput');
expect(both.api).not.toContain('Fn::ImportValue');
expect(both.data).toContain('"Export"');

expect(weak.api).toContain('Fn::GetStackOutput');
expect(weak.data).not.toContain('"Export"');
```

This matters because the intermediate `BOTH` template is part of the solution.
Testing only the final weak template would not prove that the deployed strong
consumer can migrate safely.

---

## 9. Design rules that prevent most cycles

### Choose one direction before wiring stacks

A conventional service might use:

```text
DatabaseStack → NetworkStack
ComputeStack  → DatabaseStack and NetworkStack
Connectivity/ObservabilityStack → every stack it connects or observes
```

The arrows mean “depends on.” Lower-level stacks should not import values back
from their consumers.

### Treat relationship resources as first-class architecture

Security-group rules, Lambda permissions, event notifications, subscriptions,
listener rules, routes, and resource-policy statements connect resource owners.
Choose an owner explicitly:

- an existing downstream consumer;
- a dedicated downstream edge stack; or
- the same cohesive stack as both endpoints.

Do not let the convenience of a method receiver make this decision accidentally.

### Review mutating construct methods

Methods such as `grant*`, `addIngressRule`, `addEventNotification`, `addTarget`,
and `addToResourcePolicy` can create resources or policy statements. Determine:

1. which stack owns the new object or mutation;
2. which resource tokens it contains; and
3. whether those references add a new stack direction.

### Plan removal as a migration

Adding a cross-stack reference is usually easy. Removing one can require
intermediate deployed states. Before moving or deleting a shared resource:

- list deployed imports;
- preserve or weaken the producer contract;
- update consumers first;
- remove the producer artifact only after strong imports are gone.

### Document intentional loose coupling

If independently deployed stacks discover one another through a physical name,
SSM parameter, DNS name, Secrets Manager value, or another registry, document:

- contract owner and name;
- schema and version;
- initial deployment order;
- behavior when the producer is missing;
- how consumers refresh when the value changes; and
- deprecation and replacement policy.

Loose coupling moves responsibility from CloudFormation referential integrity
to your platform contract.

---

## 10. Decision guide

| Symptom or requirement | Likely cause | Preferred response |
|---|---|---|
| `Circular dependency between resources` in one template | Inline properties form a resource loop | Extract or defer the relationship; use an L2/custom resource when appropriate |
| `would create a cyclic reference` during synthesis | Two CDK stacks consume one another | Move the relationship downstream, merge cohesive resources, or add a downstream edge stack |
| A security-group method closes a stack loop | The rule was parented under the upstream group | Call through `connections` from the existing consumer or use `remoteRule` intentionally |
| `Export ... cannot be deleted` | A deployed consumer still uses `Fn::ImportValue` | Deploy `BOTH`, then `WEAK`, then remove; or preserve the export temporarily |
| Teams need independent release cycles | Strong construct references create excessive lifecycle coupling | Publish a versioned stable identifier or use weak references with explicit ownership controls |
| Ordering matters but no token links stacks | An external lookup hides producer order from CDK | Add an explicit stack dependency and enforce pipeline order |
| Stack boundaries mirror AWS services | Deployment units are too granular | Regroup by lifecycle and capability |

---

## 11. Reproduce the validation safely

Clone the repository and install the exact dependency lock:

```bash
git clone \
  https://github.com/proton0210/aws-cdk-cyclic-dependency-patterns.git

cd aws-cdk-cyclic-dependency-patterns
npm ci
```

Run local checks without AWS credentials:

```bash
npm run build
npm test
npm run synth:all:valid
```

Run AWS-backed template validation:

```bash
npm run validate:aws

# Optional: select any locally configured profile.
AWS_PROFILE=my-test-profile npm run validate:aws
```

The script calls only:

- STS `GetCallerIdentity`;
- CDK synthesis;
- CloudFormation `ValidateTemplate`.

It does not bootstrap, deploy, update, or delete a stack. The positive path
validates six aggregate solution templates, four downstream-connectivity
templates, and six export-migration templates. The
negative path confirms that the S3/Lambda template and security-group stack
graph fail for the intended reasons.

If you manually deploy the examples, review `cdk diff` first. Aurora Serverless
v2 and ECS Fargate can incur charges, and the lab uses destructive lifecycle
settings that are not production defaults.

---

## Conclusion

AWS CDK dependency errors become much less mysterious when the synthesized
infrastructure is treated as a directed graph.

The workflow is consistent:

1. Identify whether the failure occurs in TypeScript, CDK synthesis,
   CloudFormation creation, or a deployed update transition.
2. Inspect generated templates and the cloud assembly.
3. Find the shortest closed dependency path.
4. Remove, defer, reverse, or externalize one edge.
5. Verify the new graph and protect it with tests.

For S3 and Lambda, the decisive change is to apply notification configuration
after the endpoints and permission exist. For ECS and Aurora, it is to put the
security-group relationship in the stack already downstream—or in a third stack
that remains downstream of both. For an export deadlock, it is to migrate the
consumer mechanism before removing the producer-side export.

A maintainable CDK application does not have zero dependencies. It has a small,
intentional, observable, and acyclic set of dependencies.

---

## References

### Primary AWS documentation

- [AWS CDK resources and cross-stack references](https://docs.aws.amazon.com/cdk/v2/guide/resources.html)
- [AWS CDK `ReferenceStrength`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.ReferenceStrength.html)
- [AWS CDK best practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [AWS CDK EC2 cross-stack connections](https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_ec2/README.html#cross-stack-connections)
- [AWS CDK `SecurityGroup` and `remoteRule`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SecurityGroup.html)
- [CloudFormation `DependsOn`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html)
- [CloudFormation `Fn::ImportValue`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-importvalue.html)
- [CloudFormation `Fn::GetStackOutput`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getstackoutput.html)
- [Handling circular dependency errors in CloudFormation](https://aws.amazon.com/blogs/infrastructure-and-automation/handling-circular-dependency-errors-in-aws-cloudformation/)
- [Resolving S3/Lambda notification circular dependencies](https://aws.amazon.com/blogs/mt/resolving-circular-dependency-in-provisioning-of-amazon-s3-buckets-with-aws-lambda-event-notifications/)

### Community references used for problem discovery

- Lynn Nguyen, [Effective Methods to Resolve AWS CDK Cycling Reference Errors](https://medium.com/@lynnnguyen960114/effective-methods-to-resolve-aws-cdk-cycling-reference-errors-47cf9bc25b37)
- Dakota Lewallen, [CDK Dependency Strategies](https://dev.to/therealdakotal/cdk-dependency-strategies-4e7g)
- Serverless Advocate, [AWS CDK Stack Dependencies](https://blog.serverlessadvocate.com/aws-cdk-stack-dependencies-1d42a18aaec2)

The article's explanations, examples, diagrams, tests, and validation workflow
were independently written around the companion repository rather than copied
from those community posts.
