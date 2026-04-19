<!--
  Sync Impact Report
  ==================
  Version change: 0.0.0 → 1.0.0 (MAJOR - initial ratification)
  
  Modified principles: N/A (initial version)
  
  Added sections:
    - Core Principles (6 principles)
    - Explicit Exclusions
    - Development Workflow
    - Governance
  
  Removed sections: N/A
  
  Templates requiring updates:
    - .specify/templates/plan-template.md — no updates needed (generic)
    - .specify/templates/spec-template.md — no updates needed (generic)
    - .specify/templates/tasks-template.md — no updates needed (generic)
  
  Follow-up TODOs: None
-->

# V-CatalogManager Constitution

## Core Principles

### I. POC-First Simplicity

All implementation decisions MUST favor the simplest working solution
that demonstrates the core concept. Features MUST be scoped to what is
necessary to validate the product hypothesis.

- YAGNI is the default posture: do not build abstractions, helpers, or
  configurability beyond what the current feature requires.
- Inline code is preferred over premature extraction. Three similar
  lines are better than a shared utility that obscures intent.
- File-based or in-memory state is acceptable; external services MUST
  NOT be introduced unless they are the subject of the POC itself.

### II. AI-Native Architecture (Vercel AI SDK + Workflows)

The Vercel AI SDK and Vercel AI Workflows are the primary integration
layer for all AI functionality. All AI interactions MUST flow through
these libraries.

- AI route handlers MUST use the Vercel AI SDK (`ai` package)
  streaming primitives (`streamText`, `streamObject`, `generateText`,
  `generateObject`) rather than raw provider SDK calls.
- Multi-step or long-running AI operations MUST use Vercel AI
  Workflows for orchestration, retry, and state management.
- Provider configuration MUST be abstracted through the AI SDK's
  provider registry so that swapping models requires only
  configuration changes, not code changes.
- Tool definitions MUST use the AI SDK's `tool()` helper with Zod
  schemas for parameter validation.

### III. Test-Driven Quality (NON-NEGOTIABLE)

Every POC feature MUST have meaningful automated tests. The test suite
is the primary quality gate — code without tests is incomplete.

- Tests MUST be written before or alongside implementation; a feature
  is not done until its tests pass.
- Unit tests MUST cover all AI tool definitions, utility functions,
  and non-trivial data transformations.
- Integration tests MUST verify AI route handlers return correct
  streaming responses and handle error cases.
- Workflow tests MUST validate step sequencing, retry behavior, and
  final output shape using mocked AI responses.
- Test files MUST live adjacent to the code they test using the
  `*.test.ts` / `*.test.tsx` naming convention.
- Vitest is the test runner; React Testing Library for component tests.

### IV. Type Safety as Documentation

TypeScript strict mode MUST be enabled. Types serve as living
documentation for the POC's data contracts.

- All AI response schemas MUST be defined as Zod schemas and inferred
  to TypeScript types (`z.infer<typeof schema>`).
- `any` and `as` type assertions are prohibited except at third-party
  library boundaries where types are genuinely unavailable.
- API route request/response shapes MUST be typed and shared between
  client and server via a common types module.
- Prefer discriminated unions over optional fields for modeling
  variant states (loading, error, success).

### V. Component-Driven UI

UI MUST be built as composable React Server Components and Client
Components with clear separation of concerns.

- Server Components are the default; `"use client"` MUST only appear
  when the component requires browser APIs, state, or event handlers.
- AI streaming UI MUST use the AI SDK's React hooks (`useChat`,
  `useCompletion`, `useObject`) rather than manual fetch/state
  management.
- Components MUST be small enough to test in isolation. A component
  that requires more than three mocks to test is too coupled.
- Styling MUST use a single approach consistently (Tailwind CSS
  recommended for POC velocity).

### VI. Explicit Error Boundaries

AI operations are inherently unreliable. Every AI interaction point
MUST have explicit error handling visible to the user.

- AI route handlers MUST catch provider errors and return structured
  error responses, never leak raw provider errors to the client.
- Streaming responses MUST handle mid-stream failures gracefully with
  user-facing error states.
- Workflow steps MUST define retry policies and maximum attempt
  counts; unbounded retries are prohibited.
- Client components consuming AI streams MUST render loading, error,
  and empty states explicitly.

## Explicit Exclusions

The following concerns are intentionally out of scope for this POC.
Code reviews MUST reject PRs that introduce complexity in these areas.

- **Authentication / Authorization**: No login, sessions, roles, or
  access control. All endpoints are public.
- **Database Persistence**: No SQL, ORM, or external data store.
  Use in-memory structures or file-based storage only.
- **Horizontal Scaling**: No clustering, load balancing, or
  distributed state. Single-process `next dev` is the deployment
  target.
- **Production Hardening**: No rate limiting, CORS policies, CSP
  headers, or observability infrastructure beyond `console.log`.
- **CI/CD Pipeline**: No deployment automation. Local development
  and `next build` verification are sufficient.

## Development Workflow

All work MUST follow this sequence for POC features:

1. **Spec**: Define what the feature does and its acceptance criteria.
2. **Types**: Define Zod schemas and TypeScript interfaces for the
   feature's data contracts.
3. **Tests**: Write failing tests that encode the acceptance criteria.
4. **Implement**: Write the minimum code to make tests pass.
5. **Verify**: Run the full test suite; fix regressions before moving
   on.
6. **Refactor**: Simplify only if the code is unclear; do not
   introduce abstractions for hypothetical future needs.

Quality gates:

- `tsc --noEmit` MUST pass with zero errors.
- `vitest run` MUST pass with zero failures.
- Lint checks MUST pass (ESLint with Next.js recommended config).

## Governance

This constitution is the highest-authority document for development
decisions in this project. When a proposed change conflicts with a
principle above, the principle wins unless the constitution is
formally amended first.

**Amendment procedure**:

1. Propose the change with rationale in writing.
2. Update this document with the new or modified principle.
3. Increment the version per semantic versioning:
   - MAJOR: Principle removed, redefined, or scope fundamentally
     changed.
   - MINOR: New principle added or existing principle materially
     expanded.
   - PATCH: Clarifications, typos, non-semantic rewording.
4. Update the Sync Impact Report comment at the top of this file.
5. Verify downstream templates remain consistent.

**Compliance**: All code changes MUST be reviewed against the
applicable principles. The constitution check in plan templates MUST
reference the current version.

**Version**: 1.0.0 | **Ratified**: 2026-04-05 | **Last Amended**: 2026-04-05
