import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { IVpc, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  DatabaseCluster,
  DatabaseClusterEngine,
} from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends StackProps {
  readonly vpc: IVpc;
}

export class DatabaseStack extends Stack {
  readonly cluster: DatabaseCluster;
  readonly databaseSg: SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    this.databaseSg = new SecurityGroup(this, 'DatabaseSg', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Aurora PostgreSQL security group',
    });

    this.cluster = new DatabaseCluster(this, 'Aurora', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_16_6,
      }),
      writer: ClusterInstance.serverlessV2('writer'),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.databaseSg],
      storageEncrypted: true,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
