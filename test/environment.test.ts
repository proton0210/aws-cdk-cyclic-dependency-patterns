import { environmentFromCli } from '../lib/common/environment';

const ENVIRONMENT_KEYS = [
  'CDK_DEFAULT_ACCOUNT',
  'CDK_DEFAULT_REGION',
  'CDK_EXAMPLES_ENV_AGNOSTIC',
] as const;

describe('CDK CLI environment selection', () => {
  const originalEnvironment = Object.fromEntries(
    ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of ENVIRONMENT_KEYS) {
      const originalValue = originalEnvironment[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  test('uses the account and Region supplied by the CDK CLI', () => {
    process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
    process.env.CDK_DEFAULT_REGION = 'us-east-1';
    delete process.env.CDK_EXAMPLES_ENV_AGNOSTIC;

    expect(environmentFromCli()).toEqual({
      account: '111111111111',
      region: 'us-east-1',
    });
  });

  test('stays environment-agnostic when either CLI value is absent', () => {
    process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
    delete process.env.CDK_DEFAULT_REGION;
    delete process.env.CDK_EXAMPLES_ENV_AGNOSTIC;

    expect(environmentFromCli()).toBeUndefined();
  });

  test('forces environment-agnostic synthesis for validation', () => {
    process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
    process.env.CDK_DEFAULT_REGION = 'us-east-1';
    process.env.CDK_EXAMPLES_ENV_AGNOSTIC = '1';

    expect(environmentFromCli()).toBeUndefined();
  });
});
