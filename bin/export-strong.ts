#!/usr/bin/env node
import 'source-map-support/register';
import { ReferenceStrength } from 'aws-cdk-lib';
import { environmentFromCli } from '../lib/common/environment';
import { buildExportMigrationApp } from '../lib/export-deadlock/stacks';

buildExportMigrationApp(
  ReferenceStrength.STRONG,
  environmentFromCli(),
).app.synth();
