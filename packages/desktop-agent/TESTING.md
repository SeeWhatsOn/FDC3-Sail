# Testing Guide

## Running Cucumber Tests

### Run All Tests
```bash
npm run test:cucumber
```

**⚠️ Important:** By default, cucumber-js runs ALL feature files due to the `cucumber.yml` configuration. To run a single feature file, you **must** use `--profile single`.

### Run a Specific Feature File

**You MUST use `--profile single` to run only one feature file.** Without it, cucumber will run all features:

```bash
# ❌ WRONG - This runs ALL features (107 scenarios)
npx cucumber-js test/features/apps/apps.feature

# ✅ CORRECT - This runs only apps.feature (13 scenarios)
npx cucumber-js test/features/apps/apps.feature --profile single
```

```bash
# Run apps feature (single file only - 13 scenarios)
npx cucumber-js test/features/apps/apps.feature --profile single

# Run app channels feature (single file only)
npx cucumber-js test/features/channels/app-channels.feature --profile single

# Alternative: Use --no-config to ignore cucumber.yml entirely (more verbose)
npx cucumber-js test/features/apps/apps.feature --no-config --format "@cucumber/pretty-formatter" --require-module tsx/cjs --require "test/step-definitions/*.steps.ts" --require "test/support/*.ts" --require "test/world/index.ts"

# Run user channels feature (single file only)
npx cucumber-js test/features/channels/user-channels.feature --profile single

# Run private channel feature (single file only)
npx cucumber-js test/features/channels/private-channel.feature --profile single

# Run broadcast feature (single file only)
npx cucumber-js test/features/context/broadcast.feature --profile single

# Run event listeners feature (single file only)
npx cucumber-js test/features/context/event-listeners.feature --profile single

# Run find intent feature (single file only)
npx cucumber-js test/features/intents/find-intent.feature --profile single

# Run raise intent feature (single file only)
npx cucumber-js test/features/intents/raise-intent.feature --profile single

# Run raise intent with context feature (single file only)
npx cucumber-js test/features/intents/raise-intent-with-context.feature --profile single

# Run intent result feature (single file only)
npx cucumber-js test/features/intents/intent-result.feature --profile single

# Run disconnect cleanup feature (single file only)
npx cucumber-js test/features/apps/disconnect-cleanup.feature --profile single

# Run heartbeat feature (single file only)
npx cucumber-js test/features/infrastructure/heartbeat.feature --profile single
```

### Run a Specific Scenario by Name

Use the `--name` flag to run scenarios matching a pattern:

```bash
# Run scenarios with "Looking up app metadata" in the name
npx cucumber-js test/features/apps/apps.feature --profile single --name "Looking up app metadata"

# Run scenarios with "Opening" in the name
npx cucumber-js test/features/apps/apps.feature --profile single --name "Opening"
```

### Run Multiple Feature Files

```bash
# Run all features in a directory (uses default profile)
npx cucumber-js test/features/apps/

# Run multiple specific files (use --profile single to avoid default paths)
npx cucumber-js test/features/apps/apps.feature test/features/channels/app-channels.feature --profile single
```

### Other Useful Options

```bash
# Watch mode (re-runs on file changes)
npm run test:cucumber:watch

# Publish results to Cucumber Cloud
npm run test:cucumber:report

# Use pretty formatter (more readable output)
npx cucumber-js --format @cucumber/pretty-formatter test/features/apps/apps.feature

# Run with tags (if you add tags to scenarios)
npx cucumber-js --tags @smoke test/features/
```

## All Available Feature Files

- `test/features/apps/apps.feature` - App opening and metadata requests
- `test/features/apps/disconnect-cleanup.feature` - App disconnection cleanup
- `test/features/channels/app-channels.feature` - App channel operations
- `test/features/channels/private-channel.feature` - Private channel operations
- `test/features/channels/user-channels.feature` - User channel operations
- `test/features/context/broadcast.feature` - Context broadcasting
- `test/features/context/event-listeners.feature` - Event listener management
- `test/features/infrastructure/heartbeat.feature` - Heartbeat functionality
- `test/features/intents/find-intent.feature` - Finding intents
- `test/features/intents/intent-result.feature` - Intent results
- `test/features/intents/raise-intent.feature` - Raising intents
- `test/features/intents/raise-intent-with-context.feature` - Raising intents with context
