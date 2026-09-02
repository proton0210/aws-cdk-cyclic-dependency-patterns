#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { environmentFromCli } from '../lib/common/environment';
import { S3LambdaProblemStack } from '../lib/s3-lambda/problem-stack';

const app = new App();
new S3LambdaProblemStack(app, 'Problem-S3LambdaCycle', {
  env: environmentFromCli(),
});
app.synth();
