# AGENTS.md

Operational guide for the progressive Askr example applications.

## Askr North Star

Examples must show applications whose behavior a reader can narrate without
framework folklore. Keep routes, services, schemas, actions, data access, and
configuration explicit. Demonstrate runtime invariant failures and actionable
error handling where a learner is likely to misuse an API. Preserve the visible
seams between SPA, SSR, API, auth, data, and tooling instead of hiding them in
example-only helpers. Add a concept only when it advances the documented
journey, and carry earlier application structure forward rather than rewriting
it into magic.

Run `npm run check` and `npm run build`. A changed stage must remain runnable,
and journey assertions and generated contracts must agree with the example.

## Optimization Gate

A benchmark number is only half of an optimization's success criterion. The
change must also preserve a causal path that a human or agent can narrate in one
sentence.

Every benchmark-driven change must include:

1. the one-sentence causal description of the optimized path;
2. the exact fallback trigger and proof that optimized and fallback paths have
   identical observable behavior and error surfaces;
3. an explicit legibility-cost statement, including `none` when no new path or
   concept is introduced; and
4. evidence that a measured bottleneck in a real application justifies the
   optimization now.

Prefer making the existing single path faster. New caches, inference,
memoization, shortcuts, fast paths, or scheduler states require an explicit
legibility decision; a speedup alone does not justify them.
