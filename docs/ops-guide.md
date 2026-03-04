# AI MOC Design Assistant — 运维操作手册

> 项目仓库：`https://github.com/yujianankwc/ai-moc-design-assistant.git`
> 线上域名：`https://aimoc.kuwanchao.com`
> ECS 项目目录：`/root/ai-moc-design-assistant`
> ECS 端口：Next.js 监听 `3000`，Nginx 反代到该端口
> Nginx 配置：`/usr/local/nginx/conf/vhost/ai-moc.conf`

---

## 一、本地开发常用命令

```bash
# 启动开发服务
npm run dev

# 构建生产版本（部署前必须成功）
npm run build

# 生成邀请码（默认 10 个）
npm run invite:generate
# 生成指定数量
node scripts/generate-invite-code.mjs 20
```

---

## 二、Git 推送到远程仓库

```bash
# 1. 查看改动
git status

# 2. 添加所有改动
git add .

# 3. 提交（替换引号内的说明）
git commit -m "feat: 本次改动说明"

# 4. 推送到 GitHub
git push origin main
```

如果只想提交部分文件：

```bash
git add app/quick/result/page.tsx
git commit -m "fix: 修复重试按钮过早出现"
git push origin main
```

---

## 三、ECS 拉取代码 & 部署（完整流程）

SSH 登录 ECS 后，复制粘贴以下命令：

```bash
cd /root/ai-moc-design-assistant && git pull origin main && npm install && npm run build && pm2 restart ai-moc
```

分步解释：

| 步骤 | 命令 | 说明 |
|------|------|------|
| 1 | `cd /root/ai-moc-design-assistant` | 进入项目目录 |
| 2 | `git pull origin main` | 从 GitHub 拉取最新代码 |
| 3 | `npm install` | 安装新增依赖（没有新依赖也不影响） |
| 4 | `npm run build` | 构建生产版本 |
| 5 | `pm2 restart ai-moc` | 重启应用 |

---

## 四、ECS 服务管理

```bash
# 查看所有 PM2 进程状态
pm2 list

# 查看应用日志（实时）
pm2 logs ai-moc

# 查看最近 200 行日志
pm2 logs ai-moc --lines 200

# 重启应用
pm2 restart ai-moc

# 停止应用
pm2 stop ai-moc

# 删除应用后重新启动（端口冲突时用）
pm2 delete ai-moc
cd /root/ai-moc-design-assistant
pm2 start "node_modules/.bin/next start -p 3000" --name ai-moc

# 查看 Nginx 配置是否正确
nginx -t

# 重载 Nginx 配置（改过 Nginx 配置后执行）
nginx -s reload
```

---

## 五、常见错误 & 解决方案

### 5.1 `git pull` 被本地文件阻塞

**现象**：提示 `error: Your local changes to the following files would be overwritten`

```bash
# 如果本地改动不需要保留
git restore -- next-env.d.ts
git pull origin main

# 如果本地改动需要保留
git stash
git pull origin main
git stash pop
```

---

### 5.2 端口被占用（EADDRINUSE）

**现象**：`Error: listen EADDRINUSE :::3000`

```bash
# 查看占用端口的进程
lsof -iTCP:3000

# 强制结束（替换 PID）
kill -9 <PID>

# 或者通过 PM2 清理
pm2 delete ai-moc
pm2 start "node_modules/.bin/next start -p 3000" --name ai-moc
```

---

### 5.3 网站显示 502 Bad Gateway

**原因**：Nginx 转发目标端口不对，或 Node.js 应用没有启动。

```bash
# 1. 检查应用是否在运行
pm2 list

# 2. 检查端口是否在监听
ss -tlnp | grep 3000

# 3. 确认 Nginx 配置中 proxy_pass 指向 3000
cat /usr/local/nginx/conf/vhost/ai-moc.conf | grep proxy_pass
# 应该看到：proxy_pass http://127.0.0.1:3000;

# 如果端口不对，修改后重载
sed -i 's|proxy_pass http://127.0.0.1:8000;|proxy_pass http://127.0.0.1:3000;|' /usr/local/nginx/conf/vhost/ai-moc.conf
nginx -t && nginx -s reload
```

---

### 5.4 网站打开白屏

**排查步骤**：

```bash
# 1. 确认本地应用返回正确内容
curl -s http://127.0.0.1:3000 | head -50

# 2. 确认域名返回内容一致
curl -s https://aimoc.kuwanchao.com | head -50

# 3. 如果域名返回的 HTML 和本地不一样，检查 Nginx
cat /usr/local/nginx/conf/vhost/ai-moc.conf

# 4. 如果内容正确但浏览器白屏，清除浏览器缓存
#    Chrome：打开 DevTools → Application → Clear storage → Clear site data
#    或用无痕模式访问
```

---

### 5.5 `npm run build` 失败

**现象**：TypeScript 编译报错

```bash
# 查看完整错误
npm run build 2>&1 | tail -30

# 常见：next-env.d.ts 冲突
rm next-env.d.ts
npm run build
```

---

### 5.6 数据库报错（Supabase）

**现象**：`操作失败：缺少 Supabase 环境变量`

```bash
# 确认 .env.local 存在且包含正确变量
cat /root/ai-moc-design-assistant/.env.local | grep SUPABASE

# 必须包含以下两项（值不能为空）：
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

### 5.7 `npm run dev` 锁文件冲突

**现象**：`Unable to acquire lock file`

```bash
# 删除锁文件后重试
rm -f .next/dev/lock
npm run dev
```

---

### 5.8 图片生成失败 / 超时

**排查**：

```bash
# 查看最近的图片生成日志（ECS 上）
pm2 logs ai-moc --lines 100 | grep "image_generation"

# 日志字段说明：
# phase: primary_failed → 主模型失败
# phase: fallback_failed → 备用模型也失败
# phase: request_succeeded → 成功
# errorType: channel_busy → 通道拥堵，稍后自动恢复
# errorType: balance_insufficient → 余额不足，需充值
# errorType: timeout → 超时，检查网络或增大 AI_IMAGE_TIMEOUT_MS

# 本地手动测试 nano-banana 是否可用
curl -s -X POST https://api.acedata.cloud/nano-banana/images \
  -H "Authorization: Bearer <你的KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"nano-banana-2","prompt":"test","size":"1024x1024"}' | head -200
```

**切换图片模型**（修改 `.env.local`）：

```bash
# 使用 nano-banana（默认）
AI_IMAGE_ALIAS=nano_banana

# 切回火山引擎 Doubao
AI_IMAGE_ALIAS=default
```

修改后需重新构建部署（`npm run build && pm2 restart ai-moc`）。

---

## 六、环境变量速查（.env.local）

| 变量 | 说明 | 示例 |
|------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 密钥 | `eyJhbGci...` |
| `NEXT_PUBLIC_SUPABASE_URL` | 同 SUPABASE_URL（前端用） | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 密钥 | `eyJhbGci...` |
| `AI_API_KEY` | 文字生成 AI 密钥（火山引擎） | `Bearer ark-...` |
| `AI_API_BASE` | 文字生成 AI 地址 | `https://ark.cn-beijing...` |
| `AI_MODEL` | 文字生成模型 ID | `ep-...` |
| `AI_IMAGE_ALIAS` | 图片模型别名 | `nano_banana` 或 `default` |
| `AI_IMAGE_API_KEY` | 默认图片模型密钥 | `Bearer ark-...` |
| `AI_IMAGE_BASE_URL` | 默认图片模型地址 | `https://ark.cn-beijing...` |
| `AI_IMAGE_MODEL` | 默认图片模型 ID | `ep-...` |
| `AI_IMAGE_API_KEY_NANO_BANANA` | Nano Banana 密钥 | `674540...` |
| `AI_IMAGE_BASE_URL_NANO_BANANA` | Nano Banana 地址 | `https://api.acedata.cloud` |
| `AI_IMAGE_ENDPOINT_NANO_BANANA` | Nano Banana 完整端点 | `https://api.acedata.cloud/nano-banana/images` |
| `AI_IMAGE_MODEL_NANO_BANANA` | Nano Banana 模型 ID | `nano-banana-2` |
| `AI_IMAGE_SIZE_NANO_BANANA` | Nano 图片尺寸 | `1024x1024` |
| `AI_IMAGE_TIMEOUT_MS` | 默认图片超时（毫秒） | `90000` |
| `AI_IMAGE_TIMEOUT_MS_NANO_BANANA` | Nano 图片超时 | `120000` |
| `INVITE_CODES` | 邀请码（逗号分隔） | `MOC-BETA-XXXX,MOC-BETA-YYYY` |

---

## 七、快速操作速查表

| 我想… | 命令 |
|--------|------|
| 本地开发 | `npm run dev` |
| 本地构建 | `npm run build` |
| 推代码到 GitHub | `git add . && git commit -m "说明" && git push origin main` |
| ECS 一键部署 | `cd /root/ai-moc-design-assistant && git pull origin main && npm install && npm run build && pm2 restart aai-moc-design-assistant` |
| 看 ECS 日志 | `pm2 logs ai-moc --lines 200` |
| 重启 ECS 应用 | `pm2 restart ai-moc` |
| 看 PM2 状态 | `pm2 list` |
| 生成邀请码 | `npm run invite:generate` |
| 测试域名是否正常 | `curl -s https://aimoc.kuwanchao.com \| head -20` |
