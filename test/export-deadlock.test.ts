import { ReferenceStrength } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TEST_ENV } from '../lib/common/environment';
import { buildExportMigrationApp } from '../lib/export-deadlock/stacks';

function serializedTemplates(strength: ReferenceStrength): {
  api: string;
  data: string;
} {
  const application = buildExportMigrationApp(strength, TEST_ENV);
  return {
    api: JSON.stringify(Template.fromStack(application.api).toJSON()),
    data: JSON.stringify(Template.fromStack(application.data).toJSON()),
  };
}

describe('cross-stack export deadlock migration', () => {
  test('strong phase uses Export and Fn::ImportValue', () => {
    const templates = serializedTemplates(ReferenceStrength.STRONG);
    expect(templates.api).toContain('Fn::ImportValue');
    expect(templates.data).toContain('"Export"');
  });

  test('both phase preserves Export while consumer uses Fn::GetStackOutput', () => {
    const templates = serializedTemplates(ReferenceStrength.BOTH);
    expect(templates.api).toContain('Fn::GetStackOutput');
    expect(templates.api).not.toContain('Fn::ImportValue');
    expect(templates.data).toContain('"Export"');
  });

  test('weak phase removes the export lock', () => {
    const templates = serializedTemplates(ReferenceStrength.WEAK);
    expect(templates.api).toContain('Fn::GetStackOutput');
    expect(templates.api).not.toContain('Fn::ImportValue');
    expect(templates.data).not.toContain('"Export"');
  });
});
