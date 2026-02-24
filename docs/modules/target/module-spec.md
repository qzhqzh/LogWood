# Module Spec: target

## 1. 目标与边界
### In Scope
- AI 工具目录管理（editor/coding）
- 工具详情查询（slug 唯一）
- 工具功能标签（features）读取与筛选

### Out of Scope
- 工具定价自动抓取
- 工具外部数据同步调度

## 2. 数据归属
- Owned tables: `targets`
- 对外 contract：
  - `listTargets(filter)`
  - `getTargetBySlug(type, slug)`
  - `getTargetById(id)`（供 review 写入前校验）

## 3. 核心规则
- `slug` 全局唯一
- `type in {editor,coding}`
- 删除策略采用软删除或下线标记（不允许直接硬删除已有关联评测的 target）

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_TARGET_NOT_FOUND` | 404 | 目标工具不存在 |
| `ERR_TARGET_TYPE_INVALID` | 400 | 工具类型非法 |

## 5. 可观测指标
- `target_query_qps`
- `target_detail_not_found_rate`

## 6. 兼容性约束
- target 字段新增必须向后兼容（允许 nullable/optional 扩展）
- `type` 枚举变更必须 ADR + 全链路评估

