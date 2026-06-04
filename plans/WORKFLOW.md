# Watson Workflow

Full lifecycle for the FDC3-Sail Watson planning and delivery workflow.

---

## Commands

| Command | What it does |
|---|---|
| `/ww-plan` | Plan: interview → PRD → arch review → work breakdown → human gate |
| `/ww-approve` | Review and approve draft work items (standalone, after a break) |
| `/ww-deliver` | Implement one approved work item (RED → GREEN → verify → review) |
| `/ww-reconcile` | Sync PR status after merge; archive done items |

---

## Full lifecycle diagram

```mermaid
flowchart TD
    A([User: /ww-plan]) --> B[spec-planner harness]

    B --> S0[Stage 0: Health check\nww-work-items]
    S0 -->|pass| S1

    S0 -->|fail| STOP([Stop — report missing requirements])

    subgraph PLAN [Planning Phase]
        S1{Vague goal?}
        S1 -->|yes| INT[Stage 1: interview skill\nPriority ladder Q&A\nstop when PRD fields fillable]
        S1 -->|no| S2

        INT --> S2[Stage 2: prd skill\nWrite plans/prd-slug.md\nAccuracy gate via verify-this]

        S2 --> S3{Arch triggers?}
        S3 -->|yes| ARCH[Stage 3: architect-agent\nVerify claims · Surface risks\nOptional ADR]
        S3 -->|no| S4

        ARCH -->|PASS / CONCERNS| S4
        ARCH -->|BLOCKER| BLOCK([Block — human resolves\nbefore continuing])

        S4[Stage 4: work-breakdown skill\nMoSCoW · INVEST · vertical slices\nCalls bdd skill per item\nDelegates each to spec-agent]

        S4 --> S5[Stage 5: Human gate\nDraft validation → present → approve / revise]
        S5 -->|revise| S4
        S5 -->|approve| S6[Stage 6: Handoff report\nTrigger continual-learning]
    end

    S6 --> APPROVE

    subgraph APPROVE [Approval Phase — /ww-approve]
        A2([/ww-approve]) --> AQ[Build approval queue\nfrom plans/work-items/]
        AQ --> AC[Show catalog table]
        AC --> AG[Per-item: validate → human gate]
        AG -->|approve| AS[status: approved]
        AG -->|revise| AG
        AG -->|done| AD[status: done → archive]
        AG -->|skip| AG
    end

    AS --> DELIVER

    subgraph DELIVER [Delivery Phase — /ww-deliver]
        D1([/ww-deliver slug]) --> DA[Phase A: RED evidence\ntest-engineer writes failing tests]
        DA --> DB[Phase B: GREEN\nimplement-agent makes tests pass]
        DB --> DC[Phase C: Verify\nverifier-agent checks behavior spec]
        DC -->|pass| DD[Phase D: Review\ncode-reviewer · security-auditor]
        DC -->|fail| DB
        DD -->|pass| DG[Human approve gate\ncommit / draft PR per tier]
        DD -->|fail| DB
        DG -->|approve| DR[status: committed or pr_awaiting]
        DG -->|changes| DB
    end

    DR --> RECONCILE

    subgraph RECONCILE [Reconcile — /ww-reconcile]
        R1([/ww-reconcile]) --> R2[Check pr_awaiting + committed items\nvia gh pr view]
        R2 -->|merged| R3[status: done → archive\nplans/completed-work-items/]
        R2 -->|closed not merged| R4[status: draft — surface to human]
        R2 -->|still open| R5[leave as-is]
    end
```

---

## Skill and agent map

```mermaid
graph LR
    subgraph Harness
        SP[spec-planner\n/ww-plan]
        WA[ww-approve\n/ww-approve]
        WD[ww-deliver\n/ww-deliver]
    end

    subgraph Atomic Skills
        INT2[interview]
        PRD2[prd]
        WB[work-breakdown]
        BDD2[bdd]
    end

    subgraph Agents
        SA[spec-agent\nwork item writer]
        AA[architect-agent\narch review + ADR]
        TE[test-engineer]
        IA[implement-agent]
        VA[verifier-agent]
        CR[code-reviewer]
        SEC[security-auditor]
    end

    subgraph Shared Library
        WWI[ww-work-items]
        PS[ww-planning-stack]
    end

    SP --> INT2
    SP --> PRD2
    SP --> WB
    SP --> AA
    SP --> WWI
    SP --> PS

    WB --> BDD2
    WB --> SA

    WA --> WWI
    WD --> TE
    WD --> IA
    WD --> VA
    WD --> CR
    WD --> SEC
    WD --> WWI
```

---

## Automation tiers

| Tier | After human `approve` at delivery gate |
|---|---|
| `stage_only` | Stage files only — human commits manually |
| `commit_push` | Commit + push branch → `status: committed` |
| `draft_pr` | Commit + push + open draft PR → `status: pr_awaiting` |

This repo default: **`commit_push`**. Set per-workload in `plans/workflow-config.yaml` under `workloads:`.

---

## Status lifecycle

```
draft
  → approved          (human gate in /ww-plan or /ww-approve)
       → in-progress  (/ww-deliver start)
            → blocked        (waiting on human decision)
            → waiting_on_user (staged, human review gate)
                 → committed / pr_awaiting
                      → done (after merge via /ww-reconcile)
            → escalated      (loop_count ≥ loop_limit → dead-letter)
```

Full status fields and automation tier mapping:
`.cursor/skills/ww-work-items/references/status-lifecycle.md`

PR reconcile procedure:
`.cursor/skills/ww-work-items/references/reconcile.md`

---

## Continual learning

Runs automatically after the session ends when:
- ≥ 10 turns since last run, AND
- ≥ 2 hours since last run, AND
- Transcript has advanced

Invoke manually anytime: *"run continual-learning now"*

Updates `## Learned User Preferences` and `## Learned Workspace Facts` in `AGENTS.md`.
State: `.cursor/hooks/state/continual-learning.json`
Index: `.cursor/hooks/state/continual-learning-index.json`
