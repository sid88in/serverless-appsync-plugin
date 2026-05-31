/**
 * Tier A (cheapest, no deploy): pure live AppSync evaluate calls.
 *
 *   - `appsync evaluate --template ...` -> EvaluateMappingTemplateCommand
 *   - `appsync evaluate --type/--field` -> EvaluateCodeCommand
 *
 * Neither command needs a deployed API, so this tier creates no AWS resources
 * and requires no teardown. It only needs resolvable credentials + a region,
 * which also makes it the smallest possible exercise of the v3 client +
 * provider credential/region resolution introduced in #686.
 */
import * as fs from 'fs';
import * as path from 'path';
import { integrationDescribe, integrationConfig } from './helpers/gate';
import { generateRunId } from './helpers/run-id';
import { prepareProject, PreparedProject } from './helpers/project';
import { appsync } from './helpers/sls';

integrationDescribe('integration / Tier A — evaluate (no deploy)', () => {
  let project: PreparedProject;
  const context = JSON.stringify({ arguments: { name: 'integration' } });

  beforeAll(() => {
    project = prepareProject({
      runId: generateRunId(),
      region: integrationConfig.region,
    });
  });

  afterAll(() => {
    project?.cleanup();
  });

  it('evaluates a VTL mapping template (EvaluateMappingTemplate)', () => {
    const templatePath = path.join(project.dir, 'template.vtl');
    fs.writeFileSync(templatePath, '$util.toJson($context.arguments)');

    const { stdout } = appsync(
      ['evaluate', '--template', templatePath, '--context', context],
      { cwd: project.dir },
    );

    expect(stdout).toContain('integration');
  });

  it('evaluates a JS resolver (EvaluateCode)', () => {
    const { stdout } = appsync(
      [
        'evaluate',
        '--type',
        'Query',
        '--field',
        'hello',
        '--function',
        'request',
        '--context',
        context,
      ],
      { cwd: project.dir },
    );

    expect(stdout).toContain('integration');
  });
});
