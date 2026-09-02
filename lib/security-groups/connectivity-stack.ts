import { Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnSecurityGroupEgress,
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

    // ServiceSg disables its default outbound rule. Keep both halves of the
    // connection in this downstream edge stack so neither endpoint stack
    // needs to import from the other.
    new CfnSecurityGroupEgress(this, 'ServiceToDatabase', {
      groupId: props.serviceSg.securityGroupId,
      destinationSecurityGroupId: props.databaseSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'ECS tasks to Aurora PostgreSQL',
    });
  }
}
