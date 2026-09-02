import { Environment } from 'aws-cdk-lib';

export const TEST_ENV: Environment = {
  account: '111111111111',
  region: 'ap-south-1',
};

/**
 * CDK CLI populates CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION from its
 * selected credential source. Without those values (for example, in CI),
 * returning undefined keeps stacks environment-agnostic and avoids context
 * lookups. Validation explicitly sets CDK_EXAMPLES_ENV_AGNOSTIC so AWS-backed
 * template checks never create account-specific context.
 */
export function environmentFromCli(): Environment | undefined {
  if (process.env.CDK_EXAMPLES_ENV_AGNOSTIC === '1') {
    return undefined;
  }

  const account = process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_DEFAULT_REGION;

  return account && region ? { account, region } : undefined;
}
