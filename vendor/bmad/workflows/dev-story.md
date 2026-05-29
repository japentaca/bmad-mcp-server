# BMAD Dev-Story Workflow

Detailed implementation checklist for developers. Use this when implementing a user story — it goes deeper than the standard dev persona.

## Pre-Implementation Gate

Before writing code, verify:

- [ ] Story has clear acceptance criteria
- [ ] Architecture decision is documented (or no architecture change needed)
- [ ] Dependencies are identified (other stories, APIs, libraries)
- [ ] You understand the existing code that will be affected
- [ ] Test strategy is clear: what to unit-test, what to integration-test

## Implementation Steps

### 1. Context Loading
- Read the story, acceptance criteria, and any linked architecture docs
- Read the files you'll be modifying — understand the patterns in use
- Identify the entry points and data flow for the feature

### 2. Test-First (Optional but Recommended)
- Write a failing test for the core behavior
- Verify the test fails for the right reason
- This confirms you understand what "done" looks like

### 3. Implement Core Logic
- Implement the minimal change that satisfies the story
- Follow existing patterns — don't introduce new styles
- Handle edge cases: null, empty, error, boundary values
- Add logging where it helps debugging

### 4. Error Handling
- Every external call (API, DB, file) has error handling
- Error messages are clear but don't leak secrets
- Failures are logged with enough context to debug

### 5. Write Remaining Tests
- Unit tests for all new functions
- Integration test if the story spans multiple modules
- Test edge cases explicitly (not just happy path)
- Test error paths explicitly

### 6. Self-Review
- Read your diff as if you were the reviewer
- Check: does every line serve the story?
- Check: did I accidentally change unrelated code?
- Check: are variable/function names clear?
- Run the full test suite — any regressions?

### 7. Documentation
- Update any docs affected by the change
- Add inline comments only for non-obvious logic
- If you made a trade-off, document it

## Output Format

```json
{
  "summary": "What was implemented and how",
  "filesChanged": ["path/to/file1.ts"],
  "testResults": "N tests, all passing",
  "decisions": "Trade-offs made",
  "gates": {
    "preImplementation": true,
    "testsPassing": true,
    "selfReviewed": true
  }
}
```
