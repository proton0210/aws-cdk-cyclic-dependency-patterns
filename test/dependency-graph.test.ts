import { findResourceCycles } from '../lib/testing/dependency-graph';

describe('CloudFormation resource dependency graph', () => {
  test('detects a resource reference embedded in Fn::Sub', () => {
    const template = {
      Resources: {
        Consumer: {
          Type: 'Custom::Consumer',
          Properties: {
            Target: { 'Fn::Sub': '${Producer.Arn}' },
          },
        },
        Producer: {
          Type: 'Custom::Producer',
          DependsOn: 'Consumer',
        },
      },
    };

    expect(findResourceCycles(template)).toEqual([
      ['Consumer', 'Producer', 'Consumer'],
    ]);
  });

  test('does not treat a mapped Fn::Sub variable as a resource reference', () => {
    const template = {
      Resources: {
        Consumer: {
          Type: 'Custom::Consumer',
          Properties: {
            Target: {
              'Fn::Sub': ['${Producer}', { Producer: 'literal-value' }],
            },
          },
        },
        Producer: {
          Type: 'Custom::Producer',
          DependsOn: 'Consumer',
        },
      },
    };

    expect(findResourceCycles(template)).toEqual([]);
  });

  test('detects references inside an Fn::Sub variable map', () => {
    const template = {
      Resources: {
        Consumer: {
          Type: 'Custom::Consumer',
          Properties: {
            Target: {
              'Fn::Sub': [
                '${TargetArn}',
                { TargetArn: { 'Fn::GetAtt': ['Producer', 'Arn'] } },
              ],
            },
          },
        },
        Producer: {
          Type: 'Custom::Producer',
          DependsOn: 'Consumer',
        },
      },
    };

    expect(findResourceCycles(template)).toEqual([
      ['Consumer', 'Producer', 'Consumer'],
    ]);
  });
});
