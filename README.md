# Simul8 知识问答助手

公司可自托管的浏览器问答系统：

- 知识存在应用自己的 PostgreSQL（pgvector），**不直连个人 IMA**
- 每位同事独立账号，**自行配置 LLM API Key**（费用各自承担）
- 适合放到 GitHub，别人克隆后自己部署

## 别人怎么用（推荐：GitHub 自托管）

### 1. 克隆仓库

```bash
git clone <你的仓库地址>
cd "Simul8 QA Assistant"
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

请修改：

- `ENCRYPTION_SECRET` / `AUTH_SECRET`（长随机串）
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `BOOTSTRAP_INVITE_CODE`（发给同事的邀请码）
- 可选：`EMBEDDING_*`（公司共用的 Embedding；没有则靠关键词检索）

### 3. 一键启动（Docker）

```bash
docker compose up -d --build
```

浏览器打开：http://localhost:3000

- 管理员：`.env` 里的账号密码
- 同事：用邀请码注册 → 在「API 设置」填自己的模型 Base URL / Key / 模型名 → 开始问答

### 4. 仅本地开发（可选）

```bash
docker compose up -d db
npm install
npx prisma db push
npm run db:seed-admin
npm run db:seed-knowledge
npm run start:lan
```

## 功能

- 邀请码注册 / 登录
- 个人 OpenAI 兼容 API（DeepSeek / 通义兼容 / OpenAI 等）
- 知识库 RAG 问答（含引用）
- 会话历史按用户隔离
- 管理后台上传资料、生成邀请码

## 知识从哪里来

仓库已包含：

- `knowledge-import/seed/` 入门说明 + IMA 目录标题索引（便于检索定位）
- 管理后台可继续上传 Markdown/TXT

若你本机仍有 IMA 凭证，可继续把原文导入（不会把 IMA Key 写进仓库）：

```bash
npm run import:ima
```

导入结果在本地数据库；若要把正文也分发给同事，请把导出的 `.md/.txt` 放进 `knowledge-import/` 后提交（注意版权，勿提交未授权整本 PDF）。

## 费用归属

| 项目 | 谁付费 |
|------|--------|
| Chat 补全 | 每位用户自己的 API Key |
| Embedding | 部署方 `.env` 中的 `EMBEDDING_API_KEY`（可选） |
| 服务器 | 各自部署环境 |

## 安全注意

- **不要**把 `.env`、IMA Client ID / API Key 提交到 GitHub
- 每人使用独立账号与独立 API Key
- 生产环境务必更换默认管理员密码与加密密钥

## 目录

- `src/app` 页面与 API
- `src/lib` 鉴权、加密、切片、RAG
- `prisma` 数据模型
- `knowledge-import` 种子知识
- `scripts` 初始化与导入
- `docker-compose.yml` / `Dockerfile` 部署
