import { ReferenceStrength } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TEST_ENV } from '../lib/common/environment';
import { buildExportMigrationApp } from '../lib/export-deadlock/stacks';

type TemplateModel = Record<string, unknown>;

function countKey(value: unknown, key: string): number {
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countKey(item, key), 0);
  }

  if (value === null || typeof value !== 'object') {
    return 0;
  }

  const record = value as Record<string, unknown>;
  return (Object.hasOwn(record, key) ? 1 : 0)
    + Object.values(record).reduce<number>(
      (count, item) => count + countKey(item, key),
      0,
    );
}

function outputExportCount(template: TemplateModel): number {
  const outputs = template.Outputs;
  if (outputs === null || typeof outputs !== 'object') {
    return 0;
  }

  return Object.values(outputs).filter(
    (output) => output !== null
      && typeof output === 'object'
      && Object.hasOwn(output, 'Export'),
  ).length;
}

function synthesizedTemplates(strength: ReferenceStrength): {
  api: TemplateModel;
  data: TemplateModel;
} {
  const application = buildExportMigrationApp(strength, TEST_ENV);
  return {
    api: Template.fromStack(application.api).toJSON(),
    data: Template.fromStack(application.data).toJSON(),
  };
}

describe('cross-stack export deadlock migration', () => {
  test('strong phase uses Export and Fn::ImportValue', () => {
    const templates = synthesizedTemplates(ReferenceStrength.STRONG);
    expect(countKey(templates.api, 'Fn::ImportValue')).toBeGreaterThan(0);
    expect(countKey(templates.api, 'Fn::GetStackOutput')).toBe(0);
    expect(outputExportCount(templates.data)).toBeGreaterThan(0);
  });

  test('both phase preserves Export while consumer uses Fn::GetStackOutput', () => {
    const templates = synthesizedTemplates(ReferenceStrength.BOTH);
    expect(countKey(templates.api, 'Fn::GetStackOutput')).toBeGreaterThan(0);
    expect(countKey(templates.api, 'Fn::ImportValue')).toBe(0);
    expect(outputExportCount(templates.data)).toBeGreaterThan(0);
  });

  test('weak phase removes the export lock', () => {
    const templates = synthesizedTemplates(ReferenceStrength.WEAK);
    expect(countKey(templates.api, 'Fn::GetStackOutput')).toBeGreaterThan(0);
    expect(countKey(templates.api, 'Fn::ImportValue')).toBe(0);
    expect(outputExportCount(templates.data)).toBe(0);
  });
});
