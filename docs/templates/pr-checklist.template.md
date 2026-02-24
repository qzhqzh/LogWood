# PR Checklist

## 1. Scope and Spec
- [ ] 改动范围清晰，未混入无关变更
- [ ] 对应 `SPEC.md` 或模块 `module-spec.md` 已更新/确认无需更新
- [ ] 若有架构级变更，已新增或更新 ADR

## 2. Module Boundaries
- [ ] 未跨模块直接访问对方 `infra` 层
- [ ] 仅通过公开 contract 或 application 接口交互
- [ ] 依赖方向符合 `api -> application -> domain -> infra`

## 3. API and Compatibility
- [ ] API 契约文档已更新（如适用）
- [ ] 错误码与响应结构保持兼容或提供迁移说明
- [ ] 非兼容变更已标注并给出升级路径

## 4. Data and Migration
- [ ] Prisma schema/migration 评审通过（如适用）
- [ ] 索引、唯一键、约束与业务规则一致
- [ ] 数据回填与回滚策略明确

## 5. Testing
- [ ] Unit tests 已覆盖新增逻辑
- [ ] Contract tests 已覆盖公开接口语义
- [ ] Integration/E2E 已覆盖关键链路
- [ ] 边界条件和失败路径有测试

## 6. Quality and Observability
- [ ] lint/type-check/test 全通过
- [ ] 关键日志与指标已补充
- [ ] 风控和限流规则与文档一致（如适用）

## 7. Release Readiness
- [ ] Feature flag/灰度策略已明确（如适用）
- [ ] 回滚方案已验证
- [ ] 变更说明（Release note）已准备

