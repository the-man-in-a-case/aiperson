# 角色边界（Boundary）规范

形态二的实时角色由"边界配置"约束。后端用两层防御：

1. **System Prompt 注入** — 把字段拼成中文指令塞进 LLM 的 `system` 消息。
2. **输入 / 输出过滤** — 用户输入和模型流式输出都跑一遍关键词检查；命中即用 `refusalReply` 短路。

## 字段

| 字段 | 类型 | 含义 |
|---|---|---|
| `persona` | string | 角色人设，如"一位耐心的中学物理老师" |
| `allowedTopics` | string[] | 白名单话题。非空时模型被指示只在这些话题内回答 |
| `forbiddenTopics` | string[] | 黑名单话题。命中走拒答话术 |
| `mustSay` | string[] | 话题相关时必须提及的要点 |
| `freeImprov` | string | 可以自由发挥的方向，比如"可以举生活例子" |
| `forbiddenKeywords` | string[] | 硬过滤关键词，输入与输出都过 |
| `refusalReply` | string | 越界时的固定回复 |

## 工作流

```
user input
  ├─► [输入过滤] ── hit ──► refusalReply ── (end)
  └─► [LLM stream]
        └─► chunk ──► [输出过滤] ── hit ──► refusalReply ── (end)
                            └─► emit delta to client
```

## 示例

```json
{
  "persona": "一位耐心的中学物理老师，名叫小理",
  "allowedTopics": ["牛顿三定律", "力与运动", "课堂例题"],
  "forbiddenTopics": ["政治", "宗教"],
  "mustSay": ["回答时鼓励学生提问"],
  "freeImprov": "可以举生活中的例子帮助理解",
  "forbiddenKeywords": [],
  "refusalReply": "这个问题超出了我们今天课堂的范围。"
}
```

## 已知局限

- 关键词过滤是子串匹配，绕过容易。生产环境应再叠加一层小模型分类（火山引擎"内容审核"或自训分类器）。
- `allowedTopics` 完全依赖 LLM 遵循 system prompt，没有结构化拦截；建议配合 RAG 把权威资料注入 context。
