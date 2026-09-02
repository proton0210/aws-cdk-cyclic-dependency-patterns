import { Annotations, Template } from 'aws-cdk-lib/assertions';
import { TEST_ENV } from '../lib/common/environment';
import {
  buildConnectivitySolutionApp,
  buildSecurityGroupProblemApp,
  buildSecurityGroupSolutionApp,
} from '../lib/security-groups/apps';

describe('cross-stack security group cycle', () => {
  test('problem app reports the cyclic stack reference', () => {
    const { compute } = buildSecurityGroupProblemApp(TEST_ENV);

    expect(() => Annotations.fromStack(compute)).toThrow(
      /would create a cyclic reference/,
    );
  });

  test('consumer-owned solution places the ingress rule in ComputeStack', () => {
    const { compute, database } = buildSecurityGroupSolutionApp(TEST_ENV);

    Template.fromStack(database).resourceCountIs(
      'AWS::EC2::SecurityGroupIngress',
      0,
    );
    Template.fromStack(compute).hasResourceProperties(
      'AWS::EC2::SecurityGroupIngress',
      {
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
      },
    );
  });

  test('connectivity solution keeps the rule in a downstream edge stack', () => {
    const { connectivity } = buildConnectivitySolutionApp(TEST_ENV);

    expect(connectivity).toBeDefined();
    Template.fromStack(connectivity!).hasResourceProperties(
      'AWS::EC2::SecurityGroupIngress',
      {
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
      },
    );
  });
});
