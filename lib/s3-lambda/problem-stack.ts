import { App, Aws, Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnRole,
  Effect,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { CfnFunction, CfnPermission } from 'aws-cdk-lib/aws-lambda';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Intentionally invalid CloudFormation graph:
 * Bucket -> Function -> Role -> Bucket.
 *
 * This stack synthesizes because the cycle is a CloudFormation-level problem.
 * `aws cloudformation validate-template` rejects the emitted template.
 */
export class S3LambdaProblemStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
                resources: [`${bucket.attrArn}/*`],
              }),
            ],
          }),
        },
      ],
    });

    const handler = new CfnFunction(this, 'Processor', {
      runtime: 'nodejs22.x',
      handler: 'index.handler',
      role: role.attrArn,
      code: {
        zipFile: 'exports.handler = async () => undefined;',
      },
    });

    const permission = new CfnPermission(this, 'InvokeFromS3', {
      action: 'lambda:InvokeFunction',
      functionName: handler.attrArn,
      principal: 's3.amazonaws.com',
      sourceArn: bucket.attrArn,
      sourceAccount: Aws.ACCOUNT_ID,
    });

    bucket.notificationConfiguration = {
      lambdaConfigurations: [
        {
          event: 's3:ObjectCreated:*',
          function: handler.attrArn,
        },
      ],
    };

    bucket.addResourceDependency(permission);
  }
}

export function buildS3LambdaProblemApp(props?: StackProps): App {
  const app = new App();
  new S3LambdaProblemStack(app, 'Problem-S3LambdaCycle', props);
  return app;
}
