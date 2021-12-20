import { IntrinsicFunction } from '../types/cloudFormation';
import fs from 'fs';
import { Substitutions } from '../types/plugin';

type MappingTemplateConfig = {
  path: string;
  substitutions: Substitutions;
};

export class MappingTemplate {
  constructor(private config: MappingTemplateConfig) {}

  compile(): string | IntrinsicFunction {
    const requestTemplateContent = fs.readFileSync(this.config.path, 'utf8');
    return this.processTemplateSubstitutions(requestTemplateContent);
  }

  processTemplateSubstitutions(template: string): string | IntrinsicFunction {
    const availableVariables = Object.keys(this.config.substitutions);
    const templateVariables: string[] = [];
    let searchResult;
    const variableSyntax = RegExp(/\${([\w\d-_]+)}/g);
    while ((searchResult = variableSyntax.exec(template)) !== null) {
      templateVariables.push(searchResult[1]);
    }

    const replacements = availableVariables
      .filter((value) => templateVariables.includes(value))
      .filter((value, index, array) => array.indexOf(value) === index)
      .reduce(
        (accum, value) =>
          Object.assign(accum, { [value]: this.config.substitutions[value] }),
        {},
      );

    // if there are substitutions for this template then add fn:sub
    if (Object.keys(replacements).length > 0) {
      return this.substituteGlobalTemplateVariables(template, replacements);
    }

    return template;
  }

  /**
   * Creates Fn::Join object from given template where all given substitutions
   * are wrapped in Fn::Sub objects. This enables template to have also
   * characters that are not only alphanumeric, underscores, periods, and colons.
   *
   * @param {*} template
   * @param {*} substitutions
   */
  substituteGlobalTemplateVariables(
    template: string,
    substitutions: Substitutions,
  ): IntrinsicFunction {
    const variables = Object.keys(substitutions).join('|');
    const regex = new RegExp(`\\\${(${variables})}`, 'g');
    const substituteTemplate = template.replace(regex, '|||$1|||');

    const templateJoin = substituteTemplate.split('|||');
    const parts: (string | IntrinsicFunction)[] = [];
    for (let i = 0; i < templateJoin.length; i += 1) {
      if (variables.includes(templateJoin[i])) {
        const subs = { [templateJoin[i]]: substitutions[templateJoin[i]] };
        parts[i] = { 'Fn::Sub': [`\${${templateJoin[i]}}`, subs] };
      } else {
        parts[i] = templateJoin[i];
      }
    }
    return { 'Fn::Join': ['', parts] };
  }
}
