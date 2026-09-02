import { Environment } from 'aws-cdk-lib';

export const TEST_ENV: Environment = {
  account: '111111111111',
  region: 'ap-south-1',
};

/**
 * CDK CLI populates CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION from the
 * selected AWS profile. The fallback makes local synthesis deterministic.
 */
export function environmentFromCli(): Environment {
  return {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? TEST_ENV.account,
    region: process.env.CDK_DEFAULT_REGION ?? TEST_ENV.region,
  };
}
