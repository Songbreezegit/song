# 松屿 SONG ISLE · 作品集后端服务接口规范文档 (API Specification)

> **版本**：`v1.0.0`  
> **服务协议**：`HTTPS / RESTful JSON`  
> **基准路径**：`https://api.songisle.dev/api/v1` (生产环境) / `http://localhost:3000/api/v1` (本地开发)  
> **字符编码**：`UTF-8`  
> **维护者**：松屿 (SONG ISLE) · `dogfishgcordialf@gmail.com`

---

## 目录
1. [通用设计规范](#1-通用设计规范)
2. [全局错误码字典](#2-全局错误码字典)
3. [接口详细定义](#3-接口详细定义)
   - 3.1 [获取开发者个人主页信息](#31-获取开发者个人主页信息)
   - 3.2 [获取项目作品集列表](#32-获取项目作品集列表)
   - 3.3 [获取单个项目深度架构详情](#33-获取单个项目深度架构详情)
   - 3.4 [投递访客留言与联系意向](#34-投递访客留言与联系意向)
   - 3.5 [获取 GitHub 实时动态与仓库统计](#35-获取-github-实时动态与仓库统计)
   - 3.6 [服务健康检查探针](#36-服务健康检查探针)
4. [安全防护与风控策略](#4-安全防护与风控策略)
5. [cURL 联调示例](#5-curl-联调示例)

---

## 1. 通用设计规范

### 1.1 请求头规范 (Request Headers)
所有写入类或具有 payload 的请求需携带以下基础请求头：
```http
Content-Type: application/json; charset=utf-8
Accept: application/json
User-Agent: SongIsle-WebClient/1.0
```

### 1.2 统一响应格式 (Standard Response Format)
接口均采用统一的 JSON 包装体，返回字段如下：

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1725839400000
}
```

- **`code`** (int): 业务状态码，`200` 表示业务成功，其他值表示不同类型的异常（见错误码表）。
- **`message`** (string): 提示信息，面向客户端或调试输出。
- **`data`** (any | null): 实际业务负载载荷。
- **`timestamp`** (int64): 响应生成的毫秒级 Unix 时间戳。

### 1.3 速率限制 (Rate Limiting)
为防止恶意爬取与接口滥用，服务端配置了基于 IP 与 Token 的滑动窗口限流：
- **只读查询接口**：`60 次 / 分钟 / IP`
- **消息投递接口 (`/contact`)**：`5 次 / 小时 / IP`，单日最多 `15 次 / IP`
- 超限时返回 HTTP `429 Too Many Requests`，响应头附带：
  - `X-RateLimit-Limit`: 配额上限
  - `X-RateLimit-Remaining`: 当前周期剩余次数
  - `X-RateLimit-Reset`: 配额重置的时间戳（秒）

---

## 2. 全局错误码字典

| HTTP 状态码 | 业务码 (`code`) | 英文标识 (`error_code`) | 说明与处理建议 |
| :--- | :--- | :--- | :--- |
| `200` | `200` | `OK` | 业务操作成功 |
| `400` | `40001` | `BAD_REQUEST` | 请求参数缺失或格式不合法 |
| `400` | `40002` | `INVALID_EMAIL_FORMAT` | 邮箱格式校验未通过 |
| `400` | `40003` | `SPAM_DETECTED` | 触发垃圾文本过滤或蜜罐 (Honeypot) 检测 |
| `404` | `40401` | `PROJECT_NOT_FOUND` | 指定 ID 的项目不存在 |
| `429` | `42901` | `RATE_LIMIT_EXCEEDED` | 请求频次超出阈值，请稍后再试 |
| `500` | `50001` | `INTERNAL_SERVER_ERROR` | 服务器内部未知异常 |
| `503` | `50301` | `MAIL_SERVICE_UNAVAILABLE` | 第三方邮件投递网关短暂不可用 |

---

## 3. 接口详细定义

### 3.1 获取开发者个人主页信息
获取松屿的基础定位宣言、核心统计数据、研发准则与社交外链。

- **接口地址**：`GET /profile`
- **认证方式**：公开接口，无需鉴权

#### 请求参数
无

#### 响应示例 (`200 OK`)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "name": "松屿",
    "englishName": "SONG ISLE",
    "tagline": "Software Engineer · Interface Craftsman",
    "bio": "专注构建高性能、高可用性的现代软件系统与具有温润质感的交互界面...",
    "email": "dogfishgcordialf@gmail.com",
    "location": "Hangzhou / Remote",
    "status": "Open for high-impact engineering & open-source projects",
    "social": {
      "github": "https://github.com/Songbreezegit",
      "twitter": "https://x.com/song_breezed"
    },
    "stats": [
      { "label": "Engineering Craft", "value": "5+ Years" },
      { "label": "Open Source Repos", "value": "20+" },
      { "label": "Core Stack Mastery", "value": "TypeScript / Go / Rust" },
      { "label": "Design Philosophy", "value": "Quiet Minimalism" }
    ],
    "principles": [
      {
        "id": 1,
        "title": "克制与留白",
        "desc": "减少无谓的视觉噪点与认知负载，每一行代码与每一个像素都应当有明确存在的理由。"
      },
      {
        "id": 2,
        "title": "工程确定性",
        "desc": "注重可测试性、类型安全与优雅的容错设计，在复杂分布式环境中追求可预测的稳定性。"
      },
      {
        "id": 3,
        "title": "手感与直觉",
        "desc": "交互如呼吸般顺畅自然，无论在终端 CLI 还是在浏览器界面，均追求亚毫秒级的响应反馈。"
      }
    ]
  },
  "timestamp": 1725839400120
}
```

---

### 3.2 获取项目作品集列表
检索开发者精选项目列表，支持多维度类别筛选与关键词检索。

- **接口地址**：`GET /projects`
- **认证方式**：公开接口，无需鉴权

#### 请求 Query 参数
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `category` | string | 否 | `all` | 分类枚举：`all`, `web`, `tools`, `systems`, `opensource` |
| `featured` | boolean | 否 | - | 是否仅筛选精选核心项目 (`true`/`false`) |
| `keyword` | string | 否 | - | 模糊匹配项目名称、副标题或技术栈（如 `rust`, `raft`） |
| `limit` | integer | 否 | `20` | 返回数量限制（1 - 50） |

#### 响应示例 (`200 OK`)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 6,
    "list": [
      {
        "id": "lumina-canvas",
        "title": "Lumina Engine",
        "subtitle": "面向海量数据拓扑的高性能 Canvas/WebGL 交互式可视化渲染内核",
        "category": "web",
        "categoryLabel": "Web Application",
        "year": "2024",
        "featured": true,
        "description": "自主研发的轻量级 2D/3D 图形渲染内核，专为千万级节点复杂拓扑图与关系链提供流畅渲染能力...",
        "highlights": [
          "支持 100,000+ 节点拓扑同屏丝滑缩放平移",
          "基于 WebAssembly 加速的力导向布局计算引擎",
          "自适应视口剔除与 LOD 动态模糊渐进加载"
        ],
        "techStack": ["TypeScript", "WebGL", "WebAssembly", "React", "TailwindCSS"],
        "githubUrl": "https://github.com/Songbreezegit/lumina-engine",
        "liveUrl": "https://github.com/Songbreezegit"
      },
      {
        "id": "kura-kv",
        "title": "Kura Store",
        "subtitle": "基于 Raft 共识协议的高性能分布式内存键值存储引擎",
        "category": "systems",
        "categoryLabel": "Systems & Backend",
        "year": "2024",
        "featured": true,
        "description": "以 Go 语言从零实现的分布式强一致性 KV 存储系统...",
        "highlights": [
          "端到端实现 Raft 算法规范，包含快照 Snapshotting 与日志压缩",
          "基于 gRPC 流式传输的高效节点间通信与心跳保活机制",
          "内建 LSM-Tree 存储引擎与 WAL (Write-Ahead Log) 持久化"
        ],
        "techStack": ["Go", "Raft", "gRPC", "Protobuf", "Docker"],
        "githubUrl": "https://github.com/Songbreezegit/kura-store",
        "liveUrl": "https://github.com/Songbreezegit"
      }
    ]
  },
  "timestamp": 1725839400250
}
```

---

### 3.3 获取单个项目深度架构详情
获取特定项目的技术规格抽屉内容，包含系统架构概览、关键技术决策与性能基准指标。

- **接口地址**：`GET /projects/{id}`
- **认证方式**：公开接口，无需鉴权

#### 路径参数 (Path Parameters)
| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 项目全局唯一标识，如 `kura-kv`, `typocraft-cli`, `lumina-canvas` |

#### 响应示例 (`200 OK`)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "kura-kv",
    "title": "Kura Store",
    "subtitle": "基于 Raft 共识协议的高性能分布式内存键值存储引擎",
    "category": "systems",
    "categoryLabel": "Systems & Backend",
    "year": "2024",
    "githubUrl": "https://github.com/Songbreezegit/kura-store",
    "liveUrl": "https://github.com/Songbreezegit",
    "techStack": ["Go", "Raft", "gRPC", "Protobuf", "Docker"],
    "architecture": {
      "overview": "分为客户端接入层、Raft 共识协调层、以及 LSM-Tree 底层存储引擎层。支持 Multi-Raft 分区扩展，通过 Lease Read 优化只读吞吐。",
      "keyDecisions": [
        "使用环形缓冲队列解耦网络 IO 与状态机应用阶段",
        "自适应批量提交策略（Dynamic Batching），在低并发下保低延迟，高并发下保高吞吐",
        "支持混沌测试（Chaos Mesh），模拟网络分区与随机节点 Crash 恢复验证"
      ],
      "performance": "单集群 45,000+ QPS 读写吞吐，P99 写入延迟 < 3.2ms"
    }
  },
  "timestamp": 1725839400300
}
```

#### 异常响应 (`404 Not Found`)
```json
{
  "code": 40401,
  "message": "Project with identifier 'unknown-id' was not found",
  "data": null,
  "timestamp": 1725839400315
}
```

---

### 3.4 投递访客留言与联系意向
接收来自作品集前台的快速留言与合作沟通申请，服务端经过反垃圾过滤后，通过 SMTP 邮件通知通道向松屿主邮箱投递通知。

- **接口地址**：`POST /contact`
- **认证方式**：公开接口（受 IP 限流与防刷机制保护）

#### 请求 Body (JSON)
| 字段名 | 类型 | 必填 | 约束限制 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `name` | string | 否 | 最大 50 字符 | 访客姓名或称呼 |
| `email` | string | 是 | 标准 Email 格式，最大 100 字符 | 访客有效联系邮箱 |
| `message` | string | 是 | 5 - 2000 字符 | 合作意向、技术咨询或留言正文 |
| `honeypot` | string | 否 | 必须为空 | 蜜罐字段（隐藏表单，若有内容直接判为 Bot 并静默拦截） |

#### 请求示例
```json
{
  "name": "Alex Zhang",
  "email": "alex.zhang@example.com",
  "message": "你好松屿，我们正在研发一款基于 WebAssembly 的图形编辑器，对你的 Lumina Engine 很感兴趣，期待能与你深入交流合作可能！",
  "honeypot": ""
}
```

#### 成功响应 (`200 OK`)
```json
{
  "code": 200,
  "message": "留言已成功送达，松屿会尽快与您取得联系！",
  "data": {
    "dispatchId": "msg_9f82d1ab38e1",
    "receivedAt": "2026-09-09T01:52:00Z"
  },
  "timestamp": 1725839400400
}
```

#### 校验失败响应 (`400 Bad Request`)
```json
{
  "code": 40002,
  "message": "请提供有效的电子邮箱地址 (Invalid email address)",
  "data": null,
  "timestamp": 1725839400412
}
```

#### 限流超限响应 (`429 Too Many Requests`)
```json
{
  "code": 42901,
  "message": "您提交留言的频次过多，请在 1 小时后再试",
  "data": {
    "retryAfterSeconds": 3600
  },
  "timestamp": 1725839400420
}
```

---

### 3.5 获取 GitHub 实时动态与仓库统计
服务端缓存并聚合来自 GitHub API 的统计数据（如公开仓库数、Stars 总数、最近活跃度），避免前端直接调用触发 GitHub 严格的 Rate Limit。

- **接口地址**：`GET /github/overview`
- **缓存策略**：边缘与服务端内存双重缓存 `TTL = 1800 秒 (30分钟)`

#### 请求参数
无

#### 响应示例 (`200 OK`)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "username": "Songbreezegit",
    "profileUrl": "https://github.com/Songbreezegit",
    "publicRepos": 24,
    "followers": 142,
    "totalStars": 386,
    "recentActivity": [
      {
        "repo": "Songbreezegit/kura-store",
        "type": "PushEvent",
        "message": "feat(raft): add dynamic batching for log replication",
        "committedAt": "2026-09-08T14:30:00Z"
      },
      {
        "repo": "Songbreezegit/lumina-engine",
        "type": "ReleaseEvent",
        "message": "v0.4.2 Quadtree viewport culling optimization",
        "committedAt": "2026-09-05T09:12:00Z"
      }
    ]
  },
  "timestamp": 1725839400500
}
```

---

### 3.6 服务健康检查探针
用于云原生环境（如 Docker / Kubernetes / Cloudflare Workers）的存活与就绪状态探针。

- **接口地址**：`GET /health`

#### 响应示例 (`200 OK`)
```json
{
  "code": 200,
  "message": "OK",
  "data": {
    "status": "healthy",
    "uptime": 864200,
    "version": "1.0.0",
    "environment": "production",
    "region": "hkg"
  },
  "timestamp": 1725839400600
}
```

---

## 4. 安全防护与风控策略

1. **跨域资源共享 (CORS)**：
   - 仅允许经过认证的前端源站（如 `https://songisle.dev`、`http://localhost:5173`）发起跨域请求。
   - 严禁配置通配符 `Access-Control-Allow-Origin: *` 与 `Allow-Credentials: true` 共存。
2. **输入深度过滤与消毒 (Sanitization)**：
   - 所有文本字段（`name`, `message`）在落盘或邮件拼接前执行 HTML 实体转义，严防 XSS 注入。
3. **蜜罐技术与 Bot 拦截 (Honeypot Strategy)**：
   - 前端渲染 CSS 不可见字段 `honeypot`，常规真实访客不会填写该项，自动化爬虫表单自动填入时，后端将直接静默忽略并返回伪装成功响应。
4. **异步邮件投递队列**：
   - 留言接口采用解耦设计（Worker 接收 -> 压入 Redis/Cloudflare 消息队列 -> 异步邮件消费），确保接口响应时间在 50ms 以内，不依赖外发 SMTP 握手阻塞。

---

## 5. cURL 联调示例

### 5.1 获取所有精选项目
```bash
curl -X GET "https://api.songisle.dev/api/v1/projects?featured=true" \
  -H "Accept: application/json"
```

### 5.2 提交联系留言
```bash
curl -X POST "https://api.songisle.dev/api/v1/contact" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "李工程师",
    "email": "engineer.li@tech.io",
    "message": "阅读了你的 Kura Store 架构设计，非常欣赏你的工程品味，希望能建立技术联系！"
  }'
```

### 5.3 探测服务健康度
```bash
curl -i "https://api.songisle.dev/api/v1/health"
```
