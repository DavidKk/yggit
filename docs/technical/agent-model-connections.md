# Git Agent 模型接入

设置页的“模型接入”默认展示连接列表。每条连接有独立的名称、渠道、API 地址、模型与会话密钥，可以新增、编辑并选择当前使用项。

点击连接名称或编辑图标进入详情。详情使用一张卡片，底部左侧返回列表，右侧测试连接和保存。返回列表放弃草稿；测试使用草稿，不改动当前生效配置；保存更新该项并将其设为当前使用项。模型名称支持手动输入和预设建议。

密钥输入沿用工单系统 `ConfiguredSecretInput` 的状态划分：已保存状态与编辑草稿分离，聚焦不删除原密钥，空草稿保持原值，显式清除才删除，非空草稿替换原值。输入支持显示、隐藏和清除；掩码不会进入测试或聊天请求。

连接元数据与当前选择保存到浏览器 `yggit.agent.model-profiles.v1`。密钥遵循现有 Agent 的零持久化约定，仅存在于根级 `AgentProvider` 内存中，客户端页面导航期间可用，刷新后需要重新填写；列表对需要密钥的连接显示提示。此处复用输入交互，不引入工单系统的服务端凭据数据库。

相关实现：

- `components/git/agent/settings/ModelChannelSection.tsx`
- `components/git/agent/settings/ConfiguredSecretInput.tsx`
- `lib/agent/model-profiles.ts`
- `lib/agent/agent-context.tsx`

回归测试覆盖连续输入、保留/替换/清除密钥、多连接保存与选择、测试与聊天使用正确凭据、取消编辑、必填校验及持久化时剔除密钥。
