# API Contract: <module-name>/<endpoint-or-service>

## 1. Metadata
- Module: `<module-name>`
- Endpoint/Service: `<name>`
- Version: `v1`
- Status: `draft | active | deprecated`
- Last Updated: `YYYY-MM-DD`

## 2. Purpose
- 

## 3. Request
### Method and Path
- `POST /api/...`

### Headers
- `Content-Type: application/json`
- `Authorization: Bearer <token>` (if required)

### Query Params
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `page` | number | no |  |

### Body Schema
```json
{
  "fieldA": "string",
  "fieldB": 1
}
```

### Validation Rules
- 

## 4. Response
### Success (200/201)
```json
{
  "id": "uuid",
  "status": "published"
}
```

### Error Responses
| HTTP | Code | Message | Notes |
|------|------|---------|-------|
| 400 | `ERR_VALIDATION` | Invalid input |  |
| 401 | `ERR_UNAUTHORIZED` | Unauthorized |  |
| 429 | `ERR_RATE_LIMIT` | Too many requests |  |
| 500 | `ERR_INTERNAL` | Internal error |  |

## 5. Idempotency
- Idempotent: `yes | no`
- Rule:

## 6. Side Effects
- Writes:
- Events:
- Cache invalidation:

## 7. Rate Limits
- Actor scope:
- Quota:
- Window:

## 8. Security
- AuthN:
- AuthZ:
- Abuse checks:

## 9. Compatibility Strategy
- Optional fields:
- Deprecated fields:
- Breaking change plan:

## 10. Test Cases (Minimum)
- Valid request returns success
- Invalid schema returns 400
- Unauthorized returns 401/403
- Exceed quota returns 429
- Duplicate request idempotency behavior is correct

