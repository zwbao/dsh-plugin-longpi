# 手动安装

**[English](install.md)** · **中文**

一般情况下，使用 [README](../README.zh.md#安装) 中的一键安装脚本即可。本文给出与安装脚本等价的逐步操作，适用于需要逐项排查、自定义安装位置，或在无法运行脚本的环境中安装。


装好之后有四块，各自独立：

| 部分 | 是什么 | 装在哪 |
| --- | --- | --- |
| Mirobody 服务器 | 病历、化验单、手环数据；插件通过它的 MCP 接口只读访问 | Docker，`http://127.0.0.1:18060` |
| longevity-skills | 方法库（技能脚本）和两张参考表 | `~/longpi/longevity-skills` |
| Python 环境 | Mirobody 术语引擎（LOINC、单位换算）和技能脚本的依赖 | `~/longpi/.venv` |
| DSH + 本插件 | 对话、工具和健康看板；[dsh-plugin-mirobody](https://github.com/zwbao/dsh-plugin-mirobody) 已随插件附带，不用另装 | `~/.dsh/profiles/web` |

下面的命令按顺序复制执行。默认都装在 `~/longpi`；**每开一个新终端，先执行一次第 0 步开头的 `export`。**

## 0. 准备工具

需要：macOS 或 Linux；Node.js 22.19 以上；pnpm（`dsh plugin` 用它装包）；Python 3.12 以上；git 和 git-lfs；Docker（跑 Mirobody）；一个 [DeepSeek API Key](https://platform.deepseek.com/api_keys)（在 DSH 网页里填）。

```bash
export LONGPI_HOME=~/longpi
mkdir -p "$LONGPI_HOME"

node -v                                   # 需要 v22.19 以上
npm install -g pnpm@10 @deepseek-ai/dsh   # 权限不够时用 sudo，或改用 nvm/fnm 装的 Node
pnpm -v && dsh --version                  # 本文用 pnpm 10、dsh 0.1.5-rc.3 验证过
python3.12 --version                      # 没有就装：brew install python@3.12，或 uv python install 3.12
git lfs version                           # 没有就装：brew install git-lfs / apt install git-lfs
docker info --format '{{.ServerVersion}}' # Docker 要在运行
```

## 1. 启动 Mirobody（病历服务器）

```bash
cd "$LONGPI_HOME"
git clone --depth 1 https://github.com/thetahealth/mirobody.git
cd mirobody
git lfs install && git lfs pull   # LOINC 词表；不拉的话只有一个指针文件
./deploy.sh                       # Postgres + Redis + 服务 + worker，约 800 MB 内存
```

浏览器打开 <http://127.0.0.1:18060>，用演示账号 `you@mirobody.ai`、验证码 `111111` 登录。默认 `SEED_DEMO_DATA=true`，两个演示账号里已经有 2019 条检查记录，用来验证插件足够。

- 要放自己的真实数据：第一次启动前在 `mirobody/.env` 里设 `SEED_DEMO_DATA=false`，然后用第 2 步的方式注册自己的账号。
- 上传化验单 PDF 或照片需要一个模型 Key（OpenRouter、Gemini、OpenAI、Anthropic、DeepSeek 任选其一），写进 `mirobody/.env` 后 `docker compose restart`。只读已有数据不需要。
- 起不来时 `deploy.sh` 会直接打印原因和修法（比如子网冲突、Docker 不支持命名卷）。

## 2. 拿到记录服务器地址（MCP）

插件通过一个「个人 MCP 地址」读你的记录。在网页里是 **设置 → MCP → 生成个人地址**；命令行也可以：

```bash
MIROBODY=http://127.0.0.1:18060

# 演示账号：验证码登录
JWT=$(curl -s -X POST "$MIROBODY/email/verify" -H 'Content-Type: application/json' \
  -d '{"email":"you@mirobody.ai","code":"111111"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["access_token"])')

# 自己的账号：把上面一段换成注册（只需一次）和密码登录
# curl -s -X POST "$MIROBODY/password/register" -H 'Content-Type: application/json' \
#   -d '{"email":"me@example.com","password":"至少8位的密码"}'
# JWT=$(curl -s -X POST "$MIROBODY/password/login" -H 'Content-Type: application/json' \
#   -d '{"email":"me@example.com","password":"至少8位的密码"}' \
#   | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["access_token"])')

MCP_URL=$(curl -s -X POST "$MIROBODY/personal/mcp" -H "Authorization: Bearer $JWT" \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["url"])')
echo "$MCP_URL"   # 形如 http://127.0.0.1:18060/mcp/<一长串密钥>
```

这个地址本身就是凭证，谁拿到都能读这份病历，别贴到聊天或截图里。默认 30 天有效（Mirobody `.env` 里的 `MCP_URL_TTL_DAYS` 可改），过期后重跑这一步、改第 6 步的配置即可，DSH 会热加载，不用重启。

## 3. Python 环境

一个虚拟环境同时给 Mirobody 术语引擎和技能脚本用。

```bash
cd "$LONGPI_HOME"
python3.12 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install mirobody numpy scipy openpyxl
# 用 uv 的话：uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python mirobody numpy scipy openpyxl

.venv/bin/python -c "import mirobody; print(mirobody.__version__, mirobody.BUNDLE_VERSION)"
# 应输出类似：1.5.0 loinc-2.83+2026.09.17-aacb2c715b56
```

少数技能依赖更重（比如 pyaging），它们在 `skill.json` 里声明了 runtime 名；没配置对应解释器时插件会直接拒绝运行，不会拿别的环境硬跑。需要时见 [配置参考](reference.zh.md#配置) 中的 `skillRuntimes`。

## 4. 技能库

```bash
cd "$LONGPI_HOME"
git clone https://github.com/zwbao/longevity-skills.git
ls longevity-skills/catalog.json longevity-skills/data   # 应看到 catalog.json、biological_variation.json、effects.jsonl
```

## 5. 安装插件

```bash
dsh plugin --profile web add github:zwbao/dsh-plugin-longpi
```

web profile 不存在时会自动创建。输出里的 `missing peer @deepseek-ai/...` 警告是正常的：这些包由 DSH 自己提供。不需要 `allowBuilds`，插件仓库里已经带着构建好的 `lib/`。

```bash
ls ~/.dsh/profiles/web/node_modules/dsh-plugin-longpi/vendor/dsh-plugin-mirobody   # 附带的 Mirobody 插件
grep -A 6 '"bundles"' ~/.dsh/profiles/web/package.json                             # 列表里应有 dsh-plugin-longpi
```

不要再单独 `dsh plugin add` Mirobody 插件：LongPi 已经在同一进程里挂上它，再装一份会让同一组工具注册两遍。

## 6. 写配置

配置写在 profile 的补丁文件里。补丁会整体替换这一行的 `config`，所以每个键都要写上。下面的脚本会先备份原文件；如果备份里除了 `[]` 还有你自己的内容，请手动合并回来。

```bash
P="${DSH_HOME:-$HOME/.dsh}/profiles/web/cordis.patch.yml"
cp "$P" "$P.bak.$(date +%Y%m%d%H%M%S)"
cat > "$P" <<EOF
# LongPi。补丁整体替换这一行的 config，所以每个键都要写。
- id: dsh-plugin-longpi
  config:
    skillsHome: $LONGPI_HOME/longevity-skills
    skillsVersion: ''
    mirobodyPluginHome: ''
    pythonBin: $LONGPI_HOME/.venv/bin/python
    mirobodyHome: ''
    mcpUrl: '$MCP_URL'
    mcpToken: ''
    member: ''
    timeoutMs: 30000
    skillPython: $LONGPI_HOME/.venv/bin/python
    skillTimeoutMs: 120000
    skillRuntimes: {}
    dataDir: ''
    maxSkillMatches: 8
    bootstrapWorkspace: true
EOF
chmod 600 "$P"

dsh --profile web --dump-config | grep -B 1 -A 24 'id: dsh-plugin-longpi'
```

最后一条命令应该打印 `# == dsh-plugin-longpi, patched by …/cordis.patch.yml`，下面是你刚写的值（`mcpUrl` 是明文，别外传）。每个键的含义见后面的 [配置参考](reference.zh.md#配置)。

## 7. 启动 DSH

插件只在启动时加载。如果 DSH 已经在跑，先在它的终端里按 Ctrl+C 停掉。

```bash
cd "$LONGPI_HOME" && dsh web
```

终端会打印 `dsh web: http://127.0.0.1:3080/?token=…` 并打开浏览器（加 `--no-open` 则不打开）。第一次打开：

1. 「内测声明」点 **继续**；
2. 「添加一个 API Key 开始使用」里粘贴 DeepSeek API Key，点 **保存并继续**（存在 `~/.dsh/.credentials.yaml`；也可以之后在 **设置 → 模型** 里填）；
3. 输入框上方选一个工作区（任意文件夹，比如 `~/longpi`），就可以开始会话。

## 8. 确认插件在正常工作

**8.1 命令行检查（不需要模型）。** `TOKEN` 是第 7 步打印的地址里 `token=` 后面那一段。接口只接受 DeepSeek Harness 的登录 Cookie，所以第一条 `curl` 先像浏览器一样用 token 换取 Cookie。

```bash
TOKEN='粘贴 token= 后面的内容'
JAR="$(mktemp)"
curl -s -o /dev/null -c "$JAR" "http://127.0.0.1:3080/?token=$TOKEN"
curl -s -b "$JAR" "http://127.0.0.1:3080/api/longpi/version"; echo
curl -s -b "$JAR" "http://127.0.0.1:3080/api/longpi/board" | python3 -c '
import json, sys
d = json.load(sys.stdin); s, m, r = d["skills"], d["mirobody"], d["records"]
print("技能库  ", s["count"], "个，版本", s["version"], s["error"] or "")
print("Mirobody", "已挂载" if m["mounted"] else "未挂载：" + m["error"])
e = m["engine"]; print("术语引擎", ("正常 " + str(e.get("version"))) if e.get("ok") else ("异常：" + str(e.get("error"))))
print("病历    ", r["status"], r["indicator_count"], "项指标", r["error"] or "")'
curl -s -b "$JAR" "http://127.0.0.1:3080/api/mirobody/resolve?q=%E8%A1%80%E7%BA%A2%E8%9B%8B%E7%99%BD&token=$TOKEN" \
  | python3 -c 'import json, sys; x = json.load(sys.stdin)["results"][0]; print(x["term"], "→", x["loinc"])'
```

应看到类似下面的输出（数字以你的为准）：

```text
{"product":"dsh-plugin-longpi","version":"5.1.0"}
技能库   171 个，版本 2026.39.0
Mirobody 已挂载
术语引擎 正常 1.5.0
病历     ok 21 项指标
血红蛋白 → 718-7
```

**8.2 网页里检查（不需要模型）。**

- 输入框上方有一行 **LongPi** 建议问题（点一下复制到剪贴板），侧边栏底部有 **LongPi** 标记。
- 在输入框输入 `/longpi` 回车，应看到：

  ```text
  dsh-plugin-longpi 4.2.0
  skills 171 (personal 98)  version 2026.39.0  revision …  from catalog.json
  profile age unset  sex unknown  birth unset
  mirobody mounted
  record server configured
  ```

  `/longpi-version` 只打印版本，`/longpi-skills 表型年龄` 打印会被选中的技能。
- 看板是一个名为 **健康看板** 的会话视图。会话里有了对话之后，它出现在顶部的视图标签里，和对话视图并列（空白会话时 DSH 不显示标签栏）。看板顶部应显示「Mirobody 已连接 · N 项指标」。
- 展开看板底部的 **记录、方法和档案**，填上年龄、性别和 China-PAR 需要的几个是否项并保存。记录里有同一天测齐九项血检的体检时，「身体年龄」卡片会出现表型年龄，「目标」里出现 China-PAR 十年风险。注意：年龄要单独填，出生年只用来估算，不会当作模型输入。

**8.3 和模型对话检查（需要 DeepSeek Key）。** 依次发下面几句，每次都应看到对应的工具调用卡片：

| 发送 | 应调用 |
| --- | --- |
| 看看我的记录里有哪些检查指标 | `read_personal_situation` |
| 我 53 岁，男，1972 年出生，不吸烟，没有糖尿病，没吃降压药，住北方城市，家里没有早发心血管病。帮我存到档案 | `save_personal_profile` |
| 用我记录里的血检算表型年龄，数值和单位按记录原样传，缺的不要补 | `run_longevity_skill` |
| 帮我保存干预方案：从 2026-09-01 起每天快走 8000 步，每周 3 次力量训练，11 点前睡觉；目标空腹血糖 5.0 | `save_intervention_plan`（先读给你确认，你说「确认」后才保存） |
| 我的干预方案有没有效果？哪些有效，哪些还看不出来？ | `review_interventions` |
| 如果空腹血糖降到 5.0、超敏 CRP 降到 1，表型年龄会怎样？ | `model_intervention_goals` |

有问题时发「帮我查一下 longpi 状态」，模型会调 `longpi_status`，里面有技能库、运行时和 Mirobody 的状态（不含病历和 token）。

## 9. 常见问题

| 现象 | 原因和处理 |
| --- | --- |
| `dsh plugin` 报找不到 pnpm | `npm install -g pnpm@10`，确认 `pnpm -v` 能用。 |
| `skills unavailable` / 技能库 0 个 | `skillsHome` 不对或没克隆。`ls $LONGPI_HOME/longevity-skills/catalog.json`。 |
| `mirobody not mounted: … not found` | 没通过 `dsh plugin add` 安装，或 `mirobodyPluginHome` 指向了不存在的目录。留空并重新执行第 5 步。 |
| `mirobody not mounted: Cannot find package '@deepseek-ai/…'` | `mirobodyPluginHome` 指向了 DSH profile 之外的源码目录，那里找不到 DSH 的包。留空，用插件附带的那份。 |
| 术语引擎异常 / `No module named mirobody` | `pythonBin` 指的解释器没装 mirobody，重做第 3 步。 |
| 病历 `error`，提示 refused 或 401 | MCP 地址过期或复制错了。重做第 2 步，改配置里的 `mcpUrl`（热加载）。 |
| 病历 `error`，提示 Could not reach | Mirobody 没在跑：`cd $LONGPI_HOME/mirobody && docker compose ps`。 |
| 看板提示缺实足年龄 | 在看板档案里填年龄，或在对话里告诉它。 |
| 技能返回 `runtime_missing` | 这个技能要专门的解释器，在 `skillRuntimes` 里按它声明的 runtime 名配置。 |
| 改了配置没生效 | `--dump-config` 看这一行是否 `patched by` 你的文件；补丁里漏掉的键会回到默认值。 |
| DSH 启动失败 | 终端会打印出错的插件；完整记录在 `~/.dsh/logs/startup-*.log`。 |
| 没有「健康看板」标签 | 先发一条消息或命令让会话开始；插件改动后要重启 `dsh web`。 |

## 更新和卸载

```bash
dsh plugin --profile web update dsh-plugin-longpi   # 更新到 GitHub 上最新的 main，然后重启 dsh web
git -C "$LONGPI_HOME/longevity-skills" pull          # 更新技能库，不用重启
dsh plugin --profile web remove dsh-plugin-longpi   # 卸载；再删掉 cordis.patch.yml 里 LongPi 那一行
```

要固定版本，安装时用 `github:zwbao/dsh-plugin-longpi#v4.2.0` 这样的标签。卸载不会删除 `~/.dsh/longpi` 里的档案、方案和打卡记录。

## 不装 DSH，先看一眼（开发者）

```bash
git clone https://github.com/zwbao/dsh-plugin-longpi.git && cd dsh-plugin-longpi
npm ci
LONGEVITY_SKILLS_HOME="$LONGPI_HOME/longevity-skills" npm test   # 单位、调度、Mirobody 格式、干预评估
npm run preview && python3 -m http.server 4173 -d preview/out     # 浏览器打开 http://127.0.0.1:4173
```

`npm run preview` 用演示数据（假的 Mirobody 记录、真实的技能）把看板渲染成普通网页。改了本地代码想装进 DSH 试：`npm pack`，再 `dsh plugin --profile web add ./dsh-plugin-longpi-<版本>.tgz`。附带的 Mirobody 插件用 `npm run vendor:mirobody` 从它的发布标签更新。
