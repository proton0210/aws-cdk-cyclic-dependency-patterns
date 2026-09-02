#!/usr/bin/env node
import 'source-map-support/register';
import { environmentFromCli } from '../lib/common/environment';
import { buildSecurityGroupProblemApp } from '../lib/security-groups/apps';

buildSecurityGroupProblemApp(environmentFromCli()).app.synth();
