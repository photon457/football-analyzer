# AGENTS.md — Football Analysis Project

## Purpose

You are the primary software engineering agent for this project.

This repository is a football-analysis desktop application designed from the perspective of a football manager. Your implementation decisions must remain consistent with the project's documented architecture, memory, rules, and task roadmap.

The four documents below are the project's **Core-4 instruction documents** and are the authoritative project context:

1. `docs/architecture.md`
2. `docs/memory.md`
3. `docs/rules.md`
4. `docs/tasks.md`

---

# 1. Mandatory Core-4 Reading

Before performing any implementation, modification, refactoring, architectural decision, dependency addition, or significant configuration change, you MUST read and understand all four Core-4 documents:

```
docs/architecture.md
docs/memory.md
docs/rules.md
docs/tasks.md
```

Do not assume that a task is too small to require checking them.

If the relevant information is already available in your context, use it, but verify the current files when the task could affect architecture, project scope, implementation rules, or task sequencing.

---

# 2. Strict Adherence

The Core-4 documents are not suggestions.

Treat them as the project's source of truth.

You MUST:

- Follow `architecture.md` for architectural boundaries and technology responsibilities.
- Follow `memory.md` for established project decisions and product context.
- Follow `rules.md` for implementation constraints and engineering principles.
- Follow `tasks.md` for the intended implementation order and project scope.

Do not silently contradict, bypass, reinterpret, or weaken these documents merely because another implementation appears convenient.

---

# 3. Before Starting Work

Before making changes:

1. Determine what the requested task is trying to accomplish.
2. Read the Core-4 documents.
3. Identify which architectural components are affected.
4. Check `tasks.md` for the appropriate implementation phase.
5. Inspect the existing code before modifying it.
6. Determine whether the requested change conflicts with an existing project decision.
7. Implement the smallest coherent change that satisfies the requirement.

Do not immediately start writing code based only on the user's latest sentence.

---

# 4. Conflict Handling

If the user's request conflicts with the Core-4 documents:

- Do not silently implement the conflicting approach.
- Identify the conflict.
- Explain which documented decision would be affected.
- Determine whether the request is intentionally changing the project's direction.
- If the user clearly intends to change the decision, update the relevant Core-4 documentation as part of the change when appropriate.
- Keep all four documents internally consistent.

The documentation must evolve together with intentional architectural changes.

---

# 5. Do Not Invent Project Decisions

Do not assume that an undocumented technology, library, architecture, data format, metric, or feature has already been approved.

If a decision materially affects the architecture or scope:

1. Check the Core-4 documents.
2. Inspect the current implementation.
3. Prefer the simplest approach consistent with the existing architecture.
4. If an important decision is genuinely unresolved, surface the uncertainty instead of inventing a permanent project rule.

---

# 6. Core Product Priority

The project's primary workflow is:

```
Match Data
    ↓
Validation
    ↓
Analysis
    ↓
Manager Dashboard
    ↓
Historical Comparison
```

Protect this workflow from unnecessary complexity.

Do not allow secondary features to displace the core analysis pipeline without an explicit project decision.

---

# 7. Technology Boundaries

Respect the responsibilities established in `architecture.md`.

At a high level:

```
Electron
    ↓
React + TypeScript
    ↓
Python Analysis Layer
    ↓
Supabase / PostgreSQL
```

Docker is primarily intended for the backend/analysis service and development/testing infrastructure.

Do not introduce unnecessary services, frameworks, databases, or infrastructure.

---

# 8. Authentication Boundary

Authentication/sign-up is intentionally deferred.

Do NOT implement:

- sign-up
- login
- password reset
- OAuth
- user roles

unless explicitly requested and the project documentation is updated accordingly.

---

# 9. Architecture Preservation

Do not perform architectural rewrites merely to complete a local feature.

Before introducing a new abstraction, service, dependency, database structure, or communication mechanism, determine:

- why it is required,
- whether the existing architecture already supports the requirement,
- what complexity it introduces,
- whether it conflicts with the Core-4 documents.

Prefer simple, modular solutions.

Do not prematurely optimize for theoretical scale.

---

# 10. Data and Analysis Integrity

Football analysis is the core value of this project.

Maintain the separation:

```
Raw Data
    ↓
Normalized Data
    ↓
Derived Metrics
    ↓
Interpretation
```

Do not confuse raw statistics with derived metrics or interpretations.

Do not introduce unexplained "magic scores."

Any important analytical metric must have a clear definition and reproducible calculation.

---

# 11. Historical Analysis

Do not design features as if the application only handles one match.

Match history is a first-class part of the product.

Preserve relationships between:

```
Player
    ↕
Match
    ↕
Metrics
```

Historical comparisons must account for relevant context such as minutes played and player position/role where applicable.

---

# 12. Code Quality

When implementing:

- Reuse existing abstractions when appropriate.
- Avoid unnecessary duplication.
- Keep modules focused.
- Use TypeScript types.
- Keep API contracts explicit.
- Keep Python analysis logic separate from presentation.
- Handle errors deliberately.
- Do not silently swallow failures.
- Do not introduce dependencies without justification.
- Do not leave debugging code in production paths.

---

# 13. Security

Follow the security requirements in `architecture.md` and `rules.md`.

In particular:

- Never commit secrets.
- Never expose Supabase service-role credentials to the renderer.
- Keep Electron's Node.js access restricted.
- Preserve `contextIsolation: true`.
- Preserve `nodeIntegration: false` unless an explicit documented architectural change is made.
- Validate imported data before persistence.

---

# 14. Documentation Synchronization

If implementation changes an established architectural or product decision, update the relevant Core-4 document.

Examples:

- Architecture change → update `architecture.md`.
- Persistent project decision → update `memory.md`.
- New engineering constraint → update `rules.md`.
- Task completion/new roadmap item → update `tasks.md`.

Do not allow documentation and implementation to diverge.

---

# 15. Task Tracking

Use `docs/tasks.md` as the project's implementation roadmap.

When completing a task:

- Keep the task status accurate.
- Do not mark work complete if it has not actually been implemented and verified.
- Do not skip prerequisite tasks without a clear reason.
- If implementation reveals that the roadmap is incorrect, update the roadmap rather than ignoring the discrepancy.

---

# 16. Verification

After making changes:

1. Check that the implementation follows the Core-4 documents.
2. Check for affected dependencies or interfaces.
3. Run appropriate tests or validation.
4. Check for obvious regressions.
5. Update documentation/task status when necessary.

Never claim that something works without performing the relevant verification available in the environment.

---

# 17. Scope Discipline

If a request introduces a feature that belongs to a later phase:

- Do not automatically implement the entire future feature.
- Determine whether the requested work is a prerequisite for the current phase.
- Keep the implementation focused.
- Record future work in `docs/tasks.md` when appropriate.

Avoid feature creep.

---

# 18. Final Instruction

The four documents:

```
docs/architecture.md
docs/memory.md
docs/rules.md
docs/tasks.md
```

form the **Core-4 project contract**.

You must treat them as the authoritative source of project architecture, persistent decisions, engineering rules, and implementation roadmap.

**Read them. Understand them. Follow them. Keep them synchronized with the implementation.**

When in doubt, preserve the documented architecture and ask for clarification rather than silently inventing a new project direction.
