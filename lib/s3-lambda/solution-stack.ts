import { App, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  EventType,
} from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

/**
 * Valid graph. The S3 L2 construct creates Custom::S3BucketNotifications,
 * which applies the notification only after the bucket, Lambda, and invoke
 * permission exist.
 */
export class S3LambdaSolutionStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'Uploads', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
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
  }
}

export function buildS3LambdaSolutionApp(props?: StackProps): App {
  const app = new App();
  new S3LambdaSolutionStack(app, 'Solution-S3LambdaCycle', props);
  return app;
}
