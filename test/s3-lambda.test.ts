import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TEST_ENV } from '../lib/common/environment';
import { buildS3LambdaProblemApp } from '../lib/s3-lambda/problem-stack';
import { buildS3LambdaSolutionApp } from '../lib/s3-lambda/solution-stack';
import { findResourceCycles } from '../lib/testing/dependency-graph';

describe('S3 to Lambda notification cycle', () => {
  test('problem template contains a resource cycle', () => {
    const app = buildS3LambdaProblemApp({ env: TEST_ENV });
    const stack = app.node.findChild('Problem-S3LambdaCycle') as Stack;
    const assembly = app.synth();
    const template = assembly.getStackArtifact(stack.artifactId).template;

    expect(findResourceCycles(template).length).toBeGreaterThan(0);
    expect(() => Template.fromStack(stack)).toThrow(
      /resources have a dependency cycle/,
    );
  });

  test('solution defers notifications to a custom resource', () => {
    const app = buildS3LambdaSolutionApp({ env: TEST_ENV });
    const stack = app.node.findChild('Solution-S3LambdaCycle') as Stack;
    const template = Template.fromStack(stack);

    template.resourceCountIs('Custom::S3BucketNotifications', 1);
    expect(findResourceCycles(template.toJSON())).toEqual([]);
  });
});
