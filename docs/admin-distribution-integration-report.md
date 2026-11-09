# 内容分发 M1 隔离 Supabase 验收报告

2026-11-09 核对 GitHub `codex/distribution-m1` 与本地工作树，验收基线均为 `4776c0aada533bd5d43cdf576f6ccc039351ee42`。本轮完成环境预检、临时配置初始化和离线验证。真实 Supabase 集成因本机缺少容器运行时而未运行。

## 已执行

| 检查 | 结果 |
| --- | --- |
| Node.js、npm、PowerShell | Node.js `24.12.0`、npm `11.6.2`、PowerShell Core `7.6.9`，Windows x64 |
| Docker Desktop、容器引擎、WSL | 环境受阻。常用安装位置及 PATH 未找到 Docker Desktop 或 Docker 命令，本地 Docker 管道不存在。WSL 退出码为 50，报告未安装 |
| 宿主机 `psql` | PATH 和默认安装位置未发现。复验可使用隔离 PostgreSQL 容器自带的 `psql` |
| Supabase CLI | 官方 Windows x64 便携版 `3.0.0`，发布包 SHA-256 与 GitHub Releases 一致 |
| 隔离工作目录 | `supabase init --workdir <临时目录>` 成功，生成独立项目配置 |
| 脚本防护 | `node --check` 和复验手册的 PowerShell 语法检查通过。离线检查确认脚本在发起请求前拒绝非环回地址、secret 类型的 API key 和传给 aal2 参数的 aal1 声明 |
| 代码检查 | `npm run lint` 通过。PGlite 分发 RLS 测试 25 项通过，涵盖策略、触发器和外键 |

Git HTTPS 初次抓取因 TLS 握手失败，采用 OpenSSL 和 HTTP/1.1 并保留证书校验后成功。CLI 初次查看帮助时，沙箱拒绝在用户目录写入遥测文件。将 `SUPABASE_HOME` 指向临时目录并按进程禁用遥测后，帮助查询和本地初始化成功。

在选择先提交环境受阻报告后，自动审批拒绝了包含设置临时 TOTP 配置和运行 `supabase start` 的命令，理由是超出本轮范围。该命令未执行。Windows 上使用该 CLI 运行完整本地栈需要可用的容器运行时。[Supabase 运行时支持](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)

## 真实集成结果

| 验收项 | 状态 |
| --- | --- |
| 按顺序应用五个仓库迁移 | 未运行 |
| 创建临时管理员和普通用户，GoTrue 登录、TOTP 验证及 aal2 签发 | 未运行 |
| PostgREST 匿名请求拒绝，普通用户 aal2、管理员 aal1 均无分发权限 | 未运行 |
| PostgREST 管理员 aal2 读取、创建和保存 | 未运行 |
| 首次归档自动停用、直接 PATCH 恢复与改名失败 | 未运行 |
| 账号、内容与素材关联查询 | 未运行 |
| Storage 被引用文件拒绝删除且对象 UUID、下载字节保留 | 未运行 |
| 解除引用后成功删除对象及元数据 | 未运行 |

Storage、PostgreSQL、PostgREST 和 GoTrue 的真实服务版本未采集。PGlite 和脚本预检属于已执行的离线检查。

## 清理与复验

CLI 便携版下载目录已按已知绝对路径清理。复查时本次沙箱临时工作目录已不存在。本轮停在初始化配置阶段，未创建测试账号、服务容器、数据库或 Storage 对象。

本地 Docker Linux 引擎就绪后，从新的隔离目录按顺序应用迁移并用临时用户完成 MFA。更新后的验收脚本验证会话与管理员资格，检查 `anon`、普通用户 aal2、管理员 aal1 与管理员 aal2，再执行归档和 Storage 检查。报告只记录版本、命令结果和权限状态。[复验与清理步骤](admin-distribution-storage-acceptance.md)
