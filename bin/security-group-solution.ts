#!/usr/bin/env node
import 'source-map-support/register';
import { environmentFromCli } from '../lib/common/environment';
import { buildSecurityGroupSolutionApp } from '../lib/security-groups/apps';

buildSecurityGroupSolutionApp(environmentFromCli()).app.synth();
