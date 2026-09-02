#!/usr/bin/env node
import 'source-map-support/register';
import { environmentFromCli } from '../lib/common/environment';
import { buildConnectivitySolutionApp } from '../lib/security-groups/apps';

buildConnectivitySolutionApp(environmentFromCli()).app.synth();
