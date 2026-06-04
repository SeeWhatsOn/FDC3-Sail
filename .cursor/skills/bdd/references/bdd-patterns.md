# BDD Patterns

Pattern library for the `bdd` skill. Use these examples and anti-patterns to
write well-formed `Given / When / Then` acceptance scenarios.

## Core principles

- **Observable:** `Then` describes what a user or external system can see,
  not what's in a database or an internal variable.
- **Neutral:** `Given` and `When` describe intent and action, not
  implementation details.
- **Specific:** Concrete values over vague generalizations ("a valid ticker
  symbol `AAPL`" over "some input").
- **Minimal:** One behavior per scenario. Do not pack multiple assertions into
  one `Then`.

---

## Pattern 1 — Happy path

```text
Scenario: App receives broadcast context on joined channel
  Given an FDC3 app has joined channel "fdc3.channel.1"
  And a context listener for type "fdc3.instrument" is registered
  When another app broadcasts an "fdc3.instrument" context on "fdc3.channel.1"
  Then the listener receives the context within 1000 ms
```

---

## Pattern 2 — Precondition variation

```text
Scenario: Listener not called when app is on a different channel
  Given an FDC3 app has joined channel "fdc3.channel.2"
  And a context listener for type "fdc3.instrument" is registered
  When another app broadcasts an "fdc3.instrument" context on "fdc3.channel.1"
  Then the listener is not called
```

---

## Pattern 3 — Error / rejection path

```text
Scenario: raiseIntent returns error when no handler registered
  Given no handler is registered for intent "ViewChart"
  When an app raises intent "ViewChart" with an "fdc3.instrument" context
  Then the promise rejects with error "NoAppsFound"
```

---

## Pattern 4 — State change observable externally

```text
Scenario: getAppMetadata reflects updated display name after registration
  Given an app is registered with display name "Portfolio App"
  When the app updates its display name to "Portfolio Manager"
  Then getAppMetadata for that appId returns displayName "Portfolio Manager"
```

---

## Pattern 5 — Sequence / ordering

```text
Scenario: Broadcast history is replayed to new listener
  Given an "fdc3.instrument" context was broadcast on "fdc3.channel.1"
  When a new listener for "fdc3.instrument" joins "fdc3.channel.1"
  Then the listener receives the previously broadcast context immediately
```

---

## Anti-patterns (do not use)

| Anti-pattern | Why wrong | Fix |
|---|---|---|
| `Then the database contains…` | Internal state inspection | `Then the UI displays…` or `Then the API response includes…` |
| `When the OrderService calls processOrder()` | Method name in When | `When a user submits an order` |
| `Given the flag is set to true` | Implementation detail | `Given the feature is enabled` |
| `Then it works correctly` | Not observable | `Then the response status is 200 and includes…` |
| `Then A and B and C all happen` | Multiple assertions | Split into separate scenarios |
| `When the user does X\n And Y\n And Z` | Multi-step When | Use a meaningful action name or Background |

---

## FDC3-specific conventions (this project)

- Channel IDs use full spec IDs: `fdc3.channel.1`, `fdc3.channel.2`, etc.
- Context types use FDC3 spec namespace: `fdc3.instrument`, `fdc3.position`.
- App IDs are stable identifiers, not display names.
- WCP messages (`WCP1Hello`, `WCP4AppHello`) appear only in integration-level
  scenarios, not in unit-level behavior specs.
- Use `within N ms` for timing constraints (prefer wide bounds in specs,
  tighten in tests).
