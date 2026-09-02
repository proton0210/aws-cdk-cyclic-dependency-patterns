import { App, Environment } from 'aws-cdk-lib';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { ComputeStack } from './compute-stack';
import { ConnectivityStack } from './connectivity-stack';
import { DatabaseStack } from './database-stack';
import { NetworkStack } from './network-stack';

export interface SecurityGroupApplication {
  readonly app: App;
  readonly compute: ComputeStack;
  readonly database: DatabaseStack;
  readonly network: NetworkStack;
  readonly connectivity?: ConnectivityStack;
}

export function buildSecurityGroupProblemApp(
  env: Environment,
): SecurityGroupApplication {
  const app = new App();
  const network = new NetworkStack(app, 'Problem-Network', { env });
  const database = new DatabaseStack(app, 'Problem-Database', {
    env,
    vpc: network.vpc,
  });
  const compute = new ComputeStack(app, 'Problem-Compute', {
    env,
    vpc: network.vpc,
    database: database.cluster,
    databaseSg: database.databaseSg,
    createConnectionInConsumer: false,
  });

  // Intentionally wrong. The rule is parented in DatabaseStack and references
  // ServiceSg, adding DatabaseStack -> ComputeStack. ComputeStack already
  // depends on DatabaseStack through DB_HOST, so this closes the cycle.
  database.databaseSg.addIngressRule(
    compute.serviceSg,
    Port.tcp(5432),
    'Incorrect cross-stack rule ownership',
  );

  return { app, compute, database, network };
}

export function buildSecurityGroupSolutionApp(
  env: Environment,
): SecurityGroupApplication {
  const app = new App();
  const network = new NetworkStack(app, 'Solution-Network', { env });
  const database = new DatabaseStack(app, 'Solution-Database', {
    env,
    vpc: network.vpc,
  });
  const compute = new ComputeStack(app, 'Solution-Compute', {
    env,
    vpc: network.vpc,
    database: database.cluster,
    databaseSg: database.databaseSg,
    createConnectionInConsumer: true,
  });

  return { app, compute, database, network };
}

export function buildConnectivitySolutionApp(
  env: Environment,
): SecurityGroupApplication {
  const app = new App();
  const network = new NetworkStack(app, 'Connectivity-Network', { env });
  const database = new DatabaseStack(app, 'Connectivity-Database', {
    env,
    vpc: network.vpc,
  });
  const compute = new ComputeStack(app, 'Connectivity-Compute', {
    env,
    vpc: network.vpc,
    database: database.cluster,
    databaseSg: database.databaseSg,
    createConnectionInConsumer: false,
  });
  const connectivity = new ConnectivityStack(app, 'Connectivity-Edges', {
    env,
    databaseSg: database.databaseSg,
    serviceSg: compute.serviceSg,
  });

  return { app, compute, connectivity, database, network };
}
