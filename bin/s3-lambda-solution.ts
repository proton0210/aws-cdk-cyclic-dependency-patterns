#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { environmentFromCli } from '../lib/common/environment';
import { S3LambdaSolutionStack } from '../lib/s3-lambda/solution-stack';

const app = new App();
new S3LambdaSolutionStack(app, 'Solution-S3LambdaCycle', {
  env: environmentFromCli(),
});
app.synth();
