/**
 * Jest globalSetup for E2E tests.
 *
 * Creates a `node_modules/serverless-appsync-plugin` symlink under
 * `examples/` so that every example project resolves the plugin from
 * the current source tree (via Node's module resolution walking up
 * the directory tree), without needing a per-example `npm install`.
 *
 * This is invoked once before any e2e test runs.
 */
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  const repoRoot = path.resolve(__dirname);
  const examplesNodeModules = path.join(repoRoot, 'examples', 'node_modules');
  const pluginSymlinkPath = path.join(
    examplesNodeModules,
    'serverless-appsync-plugin',
  );

  fs.mkdirSync(examplesNodeModules, { recursive: true });

  // Remove any pre-existing entry (whether file, symlink, or directory)
  // so we always get a fresh symlink pointing at the current repo root.
  if (
    fs.existsSync(pluginSymlinkPath) ||
    fs.lstatSync(pluginSymlinkPath, { throwIfNoEntry: false })
  ) {
    try {
      fs.rmSync(pluginSymlinkPath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // Use a relative symlink so it works in any clone location.
  fs.symlinkSync('../..', pluginSymlinkPath, 'dir');

  // Make sure `lib/` is built — synthesis needs the compiled plugin.
  const libPath = path.join(repoRoot, 'lib', 'index.js');
  if (!fs.existsSync(libPath)) {
    throw new Error(
      `Plugin build artifact not found at ${libPath}. ` +
        `Run \`npm run build\` before \`npm run test:e2e\`, or use \`npm run test:e2e\` directly which builds first.`,
    );
  }
}
