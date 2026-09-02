import { Environment } from 'aws-cdk-lib';

export const TEST_ENV: Environment = {
  account: '111111111111',
  region: 'ap-south-1',
};

/**
 * CDK CLI populates CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION from the
 * selected AWS profile. Without credentials (for example, in CI), returning
 * undefined keeps the stacks environment-agnostic and avoids context lookups.
 */
export function environmentFromCli(): Environment | undefined {
  const account = process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_DEFAULT_REGION;

  return account && region ? { account, region } : undefined;
}
