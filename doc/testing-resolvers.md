# Testing Resolvers with `evaluate`

The `sls appsync evaluate` command calls the AppSync `EvaluateCode` and `EvaluateMappingTemplate` APIs directly. This lets you test resolver logic against a known context **without deploying** and without executing the actual data source (DynamoDB, Lambda, etc.).

> **Requirements:** An active AWS connection with `appsync:EvaluateCode` and/or `appsync:EvaluateMappingTemplate` IAM permissions.

---

## How evaluation works

AppSync executes only the resolver code itself. It does **not**:

- call the data source (DynamoDB, Lambda, HTTP, …)
- execute other pipeline functions
- validate the GraphQL schema

What you get back is the **request mapping** (what would be sent to the data source) or the **response mapping** (what would be returned to the client), depending on which function you evaluate.

---

## Unit resolver

A unit resolver has a single `request` function and a single `response` function.

```
context  →  request()  →  [data source — not called]  →  response()  →  result
```

Evaluate each function independently:

```bash
# Evaluate the request mapping
sls appsync evaluate \
  --type Query \
  --field getUser \
  --function request \
  --context '{"arguments":{"id":"abc-123"},"identity":{"sub":"user-1"}}'

# Evaluate the response mapping (pass a mock data source result via context.result)
sls appsync evaluate \
  --type Query \
  --field getUser \
  --function response \
  --context '{"arguments":{"id":"abc-123"},"result":{"id":"abc-123","name":"Alice"}}'
```

---

## Pipeline resolver

A pipeline resolver chains multiple functions. Each function has its own `request` and `response`, and passes data to the next via `ctx.stash` and `ctx.prev.result`.

```
context
  │
  ▼
[pipeline request handler]   ← optional JS wrapper
  │
  ▼
function 1: request()  →  [data source — not called]  →  response()
  │  (result stored in ctx.prev.result, stash carried forward)
  ▼
function 2: request()  →  [data source — not called]  →  response()
  │
  ▼
[pipeline response handler]  ← optional JS wrapper
  │
  ▼
result
```

Because `EvaluateCode` runs **one function at a time**, you test a pipeline by chaining evaluations manually: the output of one function becomes part of the context for the next.

### Step-by-step example

Suppose you have a `Mutation.createPost` pipeline with two functions:

| Step | Function        | File                         |
| ---- | --------------- | ---------------------------- |
| 1    | `validateInput` | `functions/validateInput.js` |
| 2    | `savePost`      | `functions/savePost.js`      |

**Step 1 — evaluate `validateInput` request:**

```bash
sls appsync evaluate \
  --type Mutation \
  --field createPost \
  --function request \
  --context '{
    "arguments": { "title": "Hello World", "body": "Content" },
    "identity": { "sub": "user-1" },
    "stash": {}
  }'
# Output: the DynamoDB (or other DS) request object that validateInput would send
```

**Step 2 — evaluate `validateInput` response** (mock the data source result):

```bash
sls appsync evaluate \
  --type Mutation \
  --field createPost \
  --function response \
  --context '{
    "arguments": { "title": "Hello World", "body": "Content" },
    "identity": { "sub": "user-1" },
    "stash": {},
    "result": { "valid": true }
  }'
# Output: what validateInput puts into ctx.prev.result for the next function
```

**Step 3 — evaluate `savePost` request** (carry forward stash and prev.result):

```bash
sls appsync evaluate \
  --type Mutation \
  --field createPost \
  --function request \
  --context '{
    "arguments": { "title": "Hello World", "body": "Content" },
    "identity": { "sub": "user-1" },
    "stash": { "validated": true },
    "prev": { "result": { "valid": true } }
  }'
# Output: the DynamoDB PutItem request that savePost would send
```

---

## Automating pipeline tests with a script

The pattern above maps naturally to a shell script. Store your test fixtures as JSON files alongside your resolver code:

```
functions/
  validateInput.js
  savePost.js
tests/
  createPost/
    step1-validateInput-request.ctx.json     ← input context
    step1-validateInput-request.expected.json ← expected output
    step2-validateInput-response.ctx.json
    step2-validateInput-response.expected.json
    step3-savePost-request.ctx.json
    step3-savePost-request.expected.json
```

### `scripts/test-pipeline.sh`

```bash
#!/usr/bin/env bash
# Usage: ./scripts/test-pipeline.sh Mutation createPost
# Runs all test steps for a pipeline resolver in order.

set -euo pipefail

TYPE="${1:?Usage: $0 <Type> <field>}"
FIELD="${2:?Usage: $0 <Type> <field>}"
TEST_DIR="tests/${FIELD}"
FAILED=0

if [ ! -d "$TEST_DIR" ]; then
  echo "No test directory found: $TEST_DIR"
  exit 1
fi

# Collect and sort step files so they run in order (step1, step2, …)
STEPS=$(ls "$TEST_DIR"/*.ctx.json 2>/dev/null | sort)

if [ -z "$STEPS" ]; then
  echo "No context files found in $TEST_DIR"
  exit 1
fi

for CTX_FILE in $STEPS; do
  BASENAME=$(basename "$CTX_FILE" .ctx.json)
  EXPECTED_FILE="$TEST_DIR/${BASENAME}.expected.json"

  # Derive --function from filename: ends in -request or -response
  if [[ "$BASENAME" == *-request ]]; then
    FN="request"
  elif [[ "$BASENAME" == *-response ]]; then
    FN="response"
  else
    echo "SKIP $BASENAME (cannot determine function from filename)"
    continue
  fi

  echo -n "Testing $BASENAME ... "

  RESULT=$(sls appsync evaluate \
    --type "$TYPE" \
    --field "$FIELD" \
    --function "$FN" \
    --context "$CTX_FILE" 2>&1)

  # Check for evaluation errors returned in the result JSON
  if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "FAIL (evaluation error)"
    echo "  $RESULT"
    FAILED=1
    continue
  fi

  if [ -f "$EXPECTED_FILE" ]; then
    DIFF=$(diff \
      <(echo "$RESULT" | jq -S .) \
      <(jq -S . "$EXPECTED_FILE") \
    )
    if [ -n "$DIFF" ]; then
      echo "FAIL"
      echo "$DIFF"
      FAILED=1
    else
      echo "PASS"
    fi
  else
    # No expected file — print output so you can create one
    echo "OK (no expected file, output below)"
    echo "$RESULT" | jq .
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "Some tests failed."
  exit 1
fi

echo ""
echo "All tests passed."
```

Run it:

```bash
chmod +x scripts/test-pipeline.sh
./scripts/test-pipeline.sh Mutation createPost
./scripts/test-pipeline.sh Query listPosts
```

### Generating expected files on first run

On the first run, omit the `.expected.json` files. The script will print the actual output. Review it, and if it looks correct, save it:

```bash
sls appsync evaluate \
  --type Mutation \
  --field createPost \
  --function request \
  --context tests/createPost/step1-validateInput-request.ctx.json \
  | jq . > tests/createPost/step1-validateInput-request.expected.json
```

From that point on, the script will diff against the saved snapshot.

---

## Using `EvaluateCodeCommand` directly in Node.js

If you prefer to drive tests from JavaScript (e.g. inside a Jest integration test suite or a custom Node script), you can call the SDK directly.

### Single function

```typescript
import {
  AppSyncClient,
  EvaluateCodeCommand,
  RuntimeName,
} from '@aws-sdk/client-appsync';
import fs from 'fs';

const client = new AppSyncClient({ region: 'us-east-1' });

async function evaluateFunction(
  codePath: string,
  context: object,
  fn: 'request' | 'response',
) {
  const code = fs.readFileSync(codePath, 'utf8');

  const result = await client.send(
    new EvaluateCodeCommand({
      runtime: { name: RuntimeName.APPSYNC_JS, runtimeVersion: '1.0.0' },
      code,
      context: JSON.stringify(context),
      function: fn,
    }),
  );

  if (result.error) {
    throw new Error(`Evaluation error in ${codePath}: ${result.error.message}`);
  }

  return JSON.parse(result.evaluationResult ?? 'null');
}
```

### Chaining pipeline functions

```typescript
async function testPipeline() {
  // Initial context — what AppSync provides at the start of the pipeline
  let ctx: Record<string, unknown> = {
    arguments: { title: 'Hello World', body: 'Content' },
    identity: { sub: 'user-1' },
    stash: {},
  };

  // --- Function 1: validateInput ---
  // Evaluate request: what would be sent to the data source
  const validateRequest = await evaluateFunction(
    'functions/validateInput.js',
    ctx,
    'request',
  );
  console.log('validateInput request:', validateRequest);

  // Simulate data source response, then evaluate response handler
  const validateResponse = await evaluateFunction(
    'functions/validateInput.js',
    { ...ctx, result: { valid: true } },
    'response',
  );
  console.log('validateInput response:', validateResponse);

  // Carry forward: prev.result and any stash mutations
  ctx = {
    ...ctx,
    stash: { ...(ctx.stash as object), validated: true },
    prev: { result: validateResponse },
  };

  // --- Function 2: savePost ---
  const saveRequest = await evaluateFunction(
    'functions/savePost.js',
    ctx,
    'request',
  );
  console.log('savePost request:', saveRequest);

  const saveResponse = await evaluateFunction(
    'functions/savePost.js',
    { ...ctx, result: { id: 'post-1', title: 'Hello World' } },
    'response',
  );
  console.log('savePost response:', saveResponse);

  return saveResponse;
}

testPipeline().then(console.log).catch(console.error);
```

### Jest integration test example

```typescript
import {
  AppSyncClient,
  EvaluateCodeCommand,
  RuntimeName,
} from '@aws-sdk/client-appsync';

const client = new AppSyncClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

async function evaluate(
  codePath: string,
  context: object,
  fn: 'request' | 'response',
) {
  const result = await client.send(
    new EvaluateCodeCommand({
      runtime: { name: RuntimeName.APPSYNC_JS, runtimeVersion: '1.0.0' },
      code: require('fs').readFileSync(codePath, 'utf8'),
      context: JSON.stringify(context),
      function: fn,
    }),
  );
  if (result.error) throw new Error(result.error.message);
  return JSON.parse(result.evaluationResult!);
}

describe('Mutation.createPost pipeline', () => {
  const baseCtx = {
    arguments: { title: 'Hello', body: 'World' },
    identity: { sub: 'user-1' },
    stash: {},
  };

  it('validateInput request maps arguments to a validation query', async () => {
    const result = await evaluate(
      'functions/validateInput.js',
      baseCtx,
      'request',
    );
    expect(result.operation).toBe('GetItem');
    expect(result.key).toBeDefined();
  });

  it('validateInput response passes validation result to stash', async () => {
    const result = await evaluate(
      'functions/validateInput.js',
      { ...baseCtx, result: { valid: true } },
      'response',
    );
    expect(result).toMatchObject({ valid: true });
  });

  it('savePost request builds a correct PutItem operation', async () => {
    const ctx = {
      ...baseCtx,
      stash: { validated: true },
      prev: { result: { valid: true } },
    };
    const result = await evaluate('functions/savePost.js', ctx, 'request');
    expect(result.operation).toBe('PutItem');
    expect(result.key.id).toBeDefined();
  });
});
```

> These are **integration tests** — they call the real AWS API. Run them in a CI stage that has AWS credentials, after unit tests pass. Tag them (e.g. `@integration`) or keep them in a separate Jest project so they don't run on every local `npm test`.

---

## Key limitations to keep in mind

| Limitation                           | Detail                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| No data source execution             | The actual DynamoDB/Lambda call never happens — you supply mock results via `context.result`                           |
| No cross-function stash              | Each `EvaluateCode` call is isolated — you must manually thread `stash` and `prev.result` between steps                |
| No pipeline request/response wrapper | The optional pipeline-level JS wrapper (`before` / `after`) is a separate code file — evaluate it separately if needed |
| Requires AWS credentials             | Not suitable for fully offline/local testing                                                                           |
| One runtime version                  | Currently only `APPSYNC_JS 1.0.0` is supported for `EvaluateCode`; VTL uses `EvaluateMappingTemplate`                  |
