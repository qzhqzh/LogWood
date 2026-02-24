# LogWood Templates

该目录用于沉淀“模块可独立重构”的标准模板，目标是让每次迭代都能保持一致性、稳定性、可回归。

## 模板列表

- `module-spec.template.md`: 模块规范模板（边界、契约、状态机、错误码、指标）
- `api-contract.template.md`: 接口契约模板（请求/响应/错误/兼容策略）
- `test-cases.template.md`: 测试用例模板（单测/契约/集成/E2E）
- `adr.template.md`: 架构决策记录模板（ADR）
- `pr-checklist.template.md`: PR 变更检查清单

## 推荐使用流程

1. 新建或重构模块前，先复制 `module-spec.template.md` 到目标模块目录。
2. 有对外接口时，补 `api-contract.template.md`。
3. 有重要设计取舍时，补 ADR。
4. 开发前先写测试清单，PR 时使用检查清单自检。

## 建议落地路径

- 模块规范：`src/modules/<module>/module-spec.md`
- 接口契约：`src/modules/<module>/api-contract.md`
- 测试清单：`src/modules/<module>/test-cases.md`
- ADR：`docs/adr/0001-<topic>.md`
