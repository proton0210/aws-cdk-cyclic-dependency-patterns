#!/usr/bin/env node
import 'source-map-support/register';
import { App, ReferenceStrength } from 'aws-cdk-lib';
import { environmentFromCli } from '../lib/common/environment';
import { ApiStack, DataStack } from '../lib/export-deadlock/stacks';
import { ComputeStack } from '../lib/security-groups/compute-stack';
import { DatabaseStack } from '../lib/security-groups/database-stack';
import { NetworkStack } from '../lib/security-groups/network-stack';
import { S3LambdaSolutionStack } from '../lib/s3-lambda/solution-stack';

const app = new App();
const env = environmentFromCli();

new S3LambdaSolutionStack(app, 'Solution-S3LambdaCycle', { env });

const network = new NetworkStack(app, 'Solution-Network', { env });
const database = new DatabaseStack(app, 'Solution-Database', {
  env,
  vpc: network.vpc,
});
new ComputeStack(app, 'Solution-Compute', {
  env,
  vpc: network.vpc,
  database: database.cluster,
  databaseSg: database.databaseSg,
  createConnectionInConsumer: true,
});

const data = new DataStack(app, 'Solution-WeakReferenceData', {
  env,
  referenceStrength: ReferenceStrength.WEAK,
});
new ApiStack(app, 'Solution-WeakReferenceApi', {
  env,
  table: data.table,
});

app.synth();
