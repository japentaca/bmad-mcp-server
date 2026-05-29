# BMAD Story-Gates Workflow

Pre and post-implementation validation gates for user stories. Use this before starting or after finishing a story to ensure quality.

## Gate 1: Story-Ready (Pre-Implementation)

Verify EVERY item before allowing development to start:

### Requirements Quality
- [ ] Story has a clear "As a... I want... so that..." format
- [ ] Acceptance criteria are specific, measurable, and testable
- [ ] Edge cases are explicitly listed (not assumed)
- [ ] Priority is clearly stated (must-have / should-have / could-have)

### Technical Readiness
- [ ] Architecture decision exists or is explicitly not needed
- [ ] Data model changes are documented (if any)
- [ ] API contract is defined (if new endpoint)
- [ ] Dependencies on other stories are identified and tracked

### Test Strategy
- [ ] Test approach is defined: unit tests, integration tests, E2E?
- [ ] Test data requirements are identified
- [ ] Mock/stub strategy is clear for external dependencies

### Gate Decision
- **PASS**: All items checked → story is ready for development
- **FAIL with issues**: Missing items identified → fix before development
- **BLOCKED**: Depends on incomplete work → track dependency

---

## Gate 2: Story-Done (Post-Implementation)

Verify EVERY item before marking a story as complete:

### Implementation Completeness
- [ ] All acceptance criteria are met
- [ ] Code review is complete with no unresolved issues
- [ ] Review findings are addressed (code changed or explicitly waived)

### Test Results
- [ ] All tests pass (unit, integration, E2E)
- [ ] No regressions in existing tests
- [ ] Test coverage meets project standards
- [ ] Edge cases from the story are tested

### Code Quality
- [ ] Code follows project patterns and conventions
- [ ] No commented-out code or debugging artifacts
- [ ] Error handling is present for all external calls
- [ ] Logging is appropriate for production debugging

### Documentation
- [ ] API docs updated (if new/changed endpoints)
- [ ] README or developer docs updated (if setup changed)
- [ ] Changelog entry added (if applicable)

### Gate Decision
- **PASS**: All items checked → story is DONE
- **FAIL with issues**: Missing items → back to development
- **WAIVE**: Items explicitly deemed unnecessary with reason

---

## Output Format

```json
{
  "gate": "story-ready",
  "passed": true,
  "issues": [],
  "dependencies": ["story-x"],
  "recommendation": "Ready to start development"
}
```
