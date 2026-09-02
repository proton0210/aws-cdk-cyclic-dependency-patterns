import { Match, Template } from 'aws-cdk-lib/assertions';
import { TEST_ENV } from '../lib/common/environment';
import {
  buildConnectivitySolutionApp,
  buildSecurityGroupProblemApp,
  buildSecurityGroupSolutionApp,
} from '../lib/security-groups/apps';

describe('cross-stack security group cycle', () => {
  test('problem app reports the cyclic stack reference', () => {
    const { app } = buildSecurityGroupProblemApp(TEST_ENV);

    expect(() => app.synth()).toThrow(
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
        GroupId: Match.objectLike({ 'Fn::ImportValue': Match.anyValue() }),
        IpProtocol: 'tcp',
        FromPort: 5432,
        SourceSecurityGroupId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('ServiceSg')]),
        }),
        ToPort: 5432,
      },
    );
    Template.fromStack(compute).hasResourceProperties(
      'AWS::EC2::SecurityGroupEgress',
      {
        DestinationSecurityGroupId: Match.objectLike({
          'Fn::ImportValue': Match.anyValue(),
        }),
        GroupId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('ServiceSg')]),
        }),
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
      },
    );
  });

  test('connectivity solution keeps both rules in a downstream edge stack', () => {
    const { app, connectivity, database } =
      buildConnectivitySolutionApp(TEST_ENV);

    expect(connectivity).toBeDefined();
    Template.fromStack(connectivity!).hasResourceProperties(
      'AWS::EC2::SecurityGroupIngress',
      {
        GroupId: Match.objectLike({ 'Fn::ImportValue': Match.anyValue() }),
        IpProtocol: 'tcp',
        FromPort: 5432,
        SourceSecurityGroupId: Match.objectLike({
          'Fn::ImportValue': Match.anyValue(),
        }),
        ToPort: 5432,
      },
    );
    Template.fromStack(connectivity!).hasResourceProperties(
      'AWS::EC2::SecurityGroupEgress',
      {
        DestinationSecurityGroupId: Match.objectLike({
          'Fn::ImportValue': Match.anyValue(),
        }),
        GroupId: Match.objectLike({ 'Fn::ImportValue': Match.anyValue() }),
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
      },
    );
    Template.fromStack(database).resourceCountIs(
      'AWS::EC2::SecurityGroupIngress',
      0,
    );
    expect(() => app.synth()).not.toThrow();
  });
});
