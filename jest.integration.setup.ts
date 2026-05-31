/**
 * Jest globalSetup for the integration suite.
 *
 * Each test scaffolds its own temporary Serverless service and links the plugin
 * source itself, so the only global precondition is that the plugin has been
 * compiled to `lib/` (the deployed service resolves the plugin from there).
 * `npm run test:integration` runs `npm run build` first, so this is just a
 * guard with a helpful message.
 */
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  const libPath = path.resolve(__dirname, 'lib', 'index.js');
  if (!fs.existsSync(libPath)) {
    throw new Error(
      `Plugin build artifact not found at ${libPath}. ` +
        'Run `npm run build` before the integration suite, or use ' +
        '`npm run test:integration` which builds first.',
    );
  }
}
