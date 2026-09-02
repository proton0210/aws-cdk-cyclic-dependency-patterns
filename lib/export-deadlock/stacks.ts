import {
  App,
  CrossStackReferences,
  Environment,
  ReferenceStrength,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  AttributeType,
  ITable,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface DataStackProps extends StackProps {
  readonly referenceStrength: ReferenceStrength;
}

export class DataStack extends Stack {
  readonly table: Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.table = new Table(this, 'Orders', {
      partitionKey: { name: 'orderId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    CrossStackReferences.of(this.table).produce(props.referenceStrength);
  }
}

export interface ApiStackProps extends StackProps {
  readonly table: ITable;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const handler = new LambdaFunction(this, 'Handler', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = async () => undefined;'),
      environment: { TABLE_NAME: props.table.tableName },
    });

    props.table.grantWriteData(handler);
  }
}

export interface ExportMigrationApplication {
  readonly app: App;
  readonly api: ApiStack;
  readonly data: DataStack;
}

/**
 * Stack names intentionally remain identical in every phase so the synthesized
 * templates model updates to the same deployed stacks.
 */
export function buildExportMigrationApp(
  referenceStrength: ReferenceStrength,
  env?: Environment,
): ExportMigrationApplication {
  const app = new App();
  const data = new DataStack(app, 'ExportMigration-Data', {
    env,
    referenceStrength,
  });
  const api = new ApiStack(app, 'ExportMigration-Api', {
    env,
    table: data.table,
  });

  return { app, api, data };
}
