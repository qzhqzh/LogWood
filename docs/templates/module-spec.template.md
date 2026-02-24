# Module Spec: <module-name>

## 1. Background
- Module: `<module-name>`
- Owner: `<team-or-person>`
- Status: `draft | active | deprecated`
- Last Updated: `YYYY-MM-DD`

## 2. Goal and Scope
### In Scope
- 

### Out of Scope
- 

## 3. Domain Model
### Core Entities
- `<EntityA>`: 
- `<EntityB>`:

### Value Objects
- 

### States and State Machine
- State enum:
- Allowed transitions:
  - `<from>` -> `<to>` when `<condition>`

## 4. Public Contract (Application Layer)
### Use Cases
1. `<UseCaseName>`
- Input DTO:
- Output DTO:
- Errors:

2. `<UseCaseName>`
- Input DTO:
- Output DTO:
- Errors:

### Idempotency and Concurrency
- Idempotency key:
- Duplicate request behavior:
- Concurrent write policy:

## 5. Validation Rules
- Field constraints:
- Business constraints:
- Cross-entity constraints:

## 6. Dependencies
### Inbound Dependencies
- Which modules call this module:

### Outbound Dependencies
- Which modules/services this module depends on:

### Dependency Rules
- Allowed import path:
- Forbidden import path:

## 7. Persistence and Data Ownership
- Owned tables:
- Read-only external tables:
- Indexes and unique constraints:
- Migration notes:

## 8. Error Model
| Code | HTTP | Meaning | Retryable |
|------|------|---------|-----------|
| `<ERR_XXX>` | `400` |  | `no` |

## 9. Observability
- Metrics:
  - 
- Logs:
  - 
- Alerts:
  - 

## 10. Rate Limit and Moderation
- Rate limits:
- Risk checks:
- Escalation actions:

## 11. Compatibility and Versioning
- Backward compatibility policy:
- Breaking change process:

## 12. Security and Privacy
- Data classification:
- PII handling:
- Abuse prevention:

## 13. Test Strategy
- Unit tests:
- Contract tests:
- Integration tests:
- E2E scenarios:

## 14. Open Questions
- 

