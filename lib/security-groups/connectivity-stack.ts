import { Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnSecurityGroupIngress,
  ISecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ConnectivityStackProps extends StackProps {
  readonly databaseSg: ISecurityGroup;
  readonly serviceSg: ISecurityGroup;
}

/** A downstream stack that owns only the relationship between two peers. */
export class ConnectivityStack extends Stack {
  constructor(scope: Construct, id: string, props: ConnectivityStackProps) {
    super(scope, id, props);

    new CfnSecurityGroupIngress(this, 'DatabaseFromService', {
      groupId: props.databaseSg.securityGroupId,
      sourceSecurityGroupId: props.serviceSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'ECS tasks to Aurora PostgreSQL',
    });
  }
}
