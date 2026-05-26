# CFN Synthesis Tests

These tests verify that `serverless-appsync-plugin` generates the
expected CloudFormation when applied to a variety of real-world
configurations. They complement the unit tests in `src/__tests__/`:

| Concern                                       | Unit tests          | CFN synthesis tests |
| --------------------------------------------- | ------------------- | ------------------- |
| Pure function logic                           | ✓                   |                     |
| Schema validation                             | ✓                   |                     |
| Type coercion                                 | ✓                   |                     |
| Plugin lifecycle on a real `serverless.yml`   |                     | ✓                   |
| Generated CloudFormation resources            | partial (snapshots) | ✓                   |
| Feature combinations                          |                     | ✓                   |
| Example projects stay current with the plugin |                     | ✓                   |

## How it works

Each test loads one of the example projects under [`../examples/`](../examples),
runs `serverless package` to produce a CloudFormation template, and
asserts on the generated resources.

Critically, **these tests do not deploy anything to AWS** — they only
exercise the synthesis path. That makes them fast (~3s per fixture),
fork-safe (no AWS credentials required), and suitable to run on every
PR.

## Running locally

```bash
# Run all CFN synthesis tests
npm run test:e2e

# Run everything (unit + synthesis)
npm run test:all

# Run a single fixture
npx jest --config jest.e2e.config.ts basic-api-key
```

## Adding a new test

1. Create a new example under `examples/<feature>/`:
   - `serverless.yml` — minimal configuration demonstrating the feature
   - `schema.graphql` — GraphQL schema (or multiple `.graphql` files)
   - Any handlers or resolver code the example needs
2. Add an entry to [`../examples/README.md`](../examples/README.md)
3. Create `e2e/<feature>.e2e.test.ts` using the helpers from `helpers/`
4. Run `npm run test:e2e` to verify

The example should be **runnable**: a user should be able to `cd` into
it, run `serverless deploy` (with AWS credentials), and get a working
AppSync API. That keeps the examples honest as documentation.

## Helpers reference

See `helpers/synthesize.ts` and `helpers/assertions.ts` for the full
set of utilities. The common patterns:

```typescript
import { synthesize } from './helpers/synthesize';
import {
  expectAuthenticationType,
  expectDataSourceOfType,
  expectResourceWithProperties,
  findOneResourceByType,
  getGraphQlApi,
} from './helpers/assertions';

describe('examples/my-feature', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/my-feature');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('does the thing', () => {
    expectAuthenticationType(result.template, 'API_KEY');
  });
});
```

## CI

A dedicated `e2e` job in `.github/workflows/ci.yml` runs the full
synthesis test suite on every PR and push to `master` or `alpha`. It
runs after the unit-test matrix completes successfully (no point
running E2E if unit tests already failed).
