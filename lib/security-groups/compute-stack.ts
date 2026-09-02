import { Stack, StackProps } from 'aws-cdk-lib';
import {
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface ComputeStackProps extends StackProps {
  readonly vpc: IVpc;
  readonly database: IDatabaseCluster;
  readonly databaseSg: SecurityGroup;
  readonly createConnectionInConsumer: boolean;
}

export class ComputeStack extends Stack {
  readonly service: FargateService;
  readonly serviceSg: SecurityGroup;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.serviceSg = new SecurityGroup(this, 'ServiceSg', {
      vpc: props.vpc,
      allowAllOutbound: false,
      description: 'ECS task security group',
    });
    this.serviceSg.addEgressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      'HTTPS for image pulls and AWS APIs',
    );
    this.serviceSg.addEgressRule(
      Peer.ipv4('10.42.0.2/32'),
      Port.udp(53),
      'DNS to the VPC resolver',
    );
    this.serviceSg.addEgressRule(
      Peer.ipv4('10.42.0.2/32'),
      Port.tcp(53),
      'TCP DNS to the VPC resolver',
    );

    const cluster = new Cluster(this, 'EcsCluster', { vpc: props.vpc });
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const container = taskDefinition.addContainer('Api', {
      image: ContainerImage.fromRegistry(
        'public.ecr.aws/docker/library/nginx:stable',
      ),
      environment: {
        // This token establishes ComputeStack -> DatabaseStack.
        DB_HOST: props.database.clusterEndpoint.hostname,
      },
    });
    container.addPortMappings({ containerPort: 80 });

    this.service = new FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      securityGroups: [this.serviceSg],
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
    });

    if (props.createConnectionInConsumer) {
      // Correct ownership: the already-dependent ComputeStack owns the rule.
      this.service.connections.allowTo(
        props.databaseSg,
        Port.tcp(5432),
        'ECS tasks to Aurora PostgreSQL',
      );
    }
  }
}
