export interface CloudFormationTemplate {
  readonly Resources?: Record<string, Record<string, unknown>>;
}

function collectReferences(value: unknown, references: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferences(item, references));
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.Ref === 'string') {
    references.add(record.Ref);
  }

  const getAtt = record['Fn::GetAtt'];
  if (Array.isArray(getAtt) && typeof getAtt[0] === 'string') {
    references.add(getAtt[0]);
  }

  const sub = record['Fn::Sub'];
  const subTemplate = typeof sub === 'string'
    ? sub
    : Array.isArray(sub) && typeof sub[0] === 'string'
      ? sub[0]
      : undefined;
  const subVariables = Array.isArray(sub)
    && sub.length > 1
    && sub[1] !== null
    && typeof sub[1] === 'object'
    && !Array.isArray(sub[1])
    ? new Set(Object.keys(sub[1] as Record<string, unknown>))
    : new Set<string>();

  if (subTemplate !== undefined) {
    for (const match of subTemplate.matchAll(/\$\{([A-Za-z0-9]+)(?:\.[^}]+)?\}/g)) {
      // A variable supplied by Fn::Sub's second argument is not an implicit
      // resource reference. References inside the variable value are still
      // found by the recursive traversal below.
      if (!subVariables.has(match[1])) {
        references.add(match[1]);
      }
    }
  }

  Object.values(record).forEach((item) => collectReferences(item, references));
}

/** Finds cycles between resources in a synthesized CloudFormation template. */
export function findResourceCycles(
  template: CloudFormationTemplate,
): string[][] {
  const resources = template.Resources ?? {};
  const resourceIds = new Set(Object.keys(resources));
  const graph = new Map<string, Set<string>>();

  for (const [logicalId, resource] of Object.entries(resources)) {
    const dependencies = new Set<string>();
    collectReferences(resource, dependencies);

    const dependsOn = resource.DependsOn;
    if (typeof dependsOn === 'string') {
      dependencies.add(dependsOn);
    } else if (Array.isArray(dependsOn)) {
      dependsOn
        .filter((item): item is string => typeof item === 'string')
        .forEach((item) => dependencies.add(item));
    }

    graph.set(
      logicalId,
      new Set([...dependencies].filter((dependency) => resourceIds.has(dependency))),
    );
  }

  const state = new Map<string, 'active' | 'done'>();
  const path: string[] = [];
  const cycles: string[][] = [];

  const visit = (node: string): void => {
    state.set(node, 'active');
    path.push(node);

    for (const dependency of graph.get(node) ?? []) {
      if (state.get(dependency) === 'active') {
        const start = path.indexOf(dependency);
        cycles.push([...path.slice(start), dependency]);
      } else if (state.get(dependency) !== 'done') {
        visit(dependency);
      }
    }

    path.pop();
    state.set(node, 'done');
  };

  for (const node of graph.keys()) {
    if (state.get(node) === undefined) {
      visit(node);
    }
  }

  return cycles;
}
