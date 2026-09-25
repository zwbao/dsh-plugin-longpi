#!/usr/bin/env bash
# LongPi installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- --mcp-url <URL>
#   curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- --with-mirobody
#
# Installs the DeepSeek Harness CLI and pnpm when they are missing, clones
# longevity-skills, creates a Python environment with the Mirobody engine, adds
# dsh-plugin-longpi to a DSH profile and writes its configuration. Running it
# again updates every part and keeps the settings already in place.
#
# The whole script sits in main() so that `curl | bash` has read all of it
# before anything runs, and child processes get /dev/null as stdin.

main() {
  set -euo pipefail

  local longpi_home="${LONGPI_HOME:-$HOME/longpi}"
  local profile="web"
  local plugin_spec="github:zwbao/dsh-plugin-longpi"
  local mcp_url="" mcp_token="" set_mcp=0 with_mirobody=0

  case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in zh*) ZH=1 ;; *) ZH=0 ;; esac
  if [ -t 1 ]; then B=$'\033[1m' G=$'\033[32m' Y=$'\033[33m' R=$'\033[31m' N=$'\033[0m'; else B='' G='' Y='' R='' N=''; fi

  while [ $# -gt 0 ]; do
    case "$1" in
      --home) longpi_home="$(arg "$@")"; shift 2 ;;
      --home=*) longpi_home="${1#*=}"; shift ;;
      --profile) profile="$(arg "$@")"; shift 2 ;;
      --profile=*) profile="${1#*=}"; shift ;;
      --mcp-url) mcp_url="$(arg "$@")"; set_mcp=1; shift 2 ;;
      --mcp-url=*) mcp_url="${1#*=}"; set_mcp=1; shift ;;
      --mcp-token) mcp_token="$(arg "$@")"; shift 2 ;;
      --mcp-token=*) mcp_token="${1#*=}"; shift ;;
      --with-mirobody) with_mirobody=1; shift ;;
      --plugin) plugin_spec="$(arg "$@")"; shift 2 ;;
      --plugin=*) plugin_spec="${1#*=}"; shift ;;
      -h|--help) usage; return 0 ;;
      *) die "Unknown option: $1 (see --help)" "未知参数：$1（见 --help）" ;;
    esac
  done
  if [ -n "$mcp_token" ] && [ "$set_mcp" = 0 ]; then
    die "--mcp-token needs --mcp-url." "--mcp-token 需要和 --mcp-url 一起使用。"
  fi

  case "$longpi_home" in "~"*) longpi_home="$HOME${longpi_home#\~}" ;; esac
  mkdir -p "$longpi_home"
  longpi_home="$(cd "$longpi_home" && pwd)"
  LOG="$longpi_home/install.log"
  printf '\n==== %s install.sh\n' "$(date '+%Y-%m-%d %H:%M:%S')" >>"$LOG"

  local dsh_home="${DSH_HOME:-$HOME/.dsh}"
  local profile_dir="$dsh_home/profiles/$profile"
  local skills_dir="$longpi_home/longevity-skills"
  local venv="$longpi_home/.venv"
  local py="$venv/bin/python"
  local mirobody_base="${LONGPI_MIROBODY_URL:-http://127.0.0.1:18060}"

  printf '%sLongPi%s %s\n' "$B" "$N" "$(pick "installer" "安装程序")"

  # 1. Tools ---------------------------------------------------------------
  step "Checking prerequisites" "检查运行环境"
  have git || die "git is required." "需要 git。"
  have curl || die "curl is required." "需要 curl。"
  have node || die "Node.js 22.19 or later is required: https://nodejs.org" "需要 Node.js 22.19 或更高版本：https://nodejs.org"
  have npm || die "npm is required (it ships with Node.js)." "需要 npm（随 Node.js 安装）。"
  local node_version
  node_version="$(node -p 'process.versions.node')"
  node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a >= 24 || (a === 22 && b >= 19) ? 0 : 1)' \
    || die "Node.js 22.19 or later is required (found $node_version)." "需要 Node.js 22.19 或更高版本（当前 ${node_version}）。"
  ok "Node.js $node_version" "Node.js $node_version"

  local npm_prefix
  npm_prefix="$(npm prefix -g </dev/null 2>>"$LOG")" || die "npm prefix -g failed; check the npm installation." "npm prefix -g 执行失败，请检查 npm。"
  NPM_BIN="$npm_prefix/bin"
  ensure_cli pnpm pnpm@10
  ensure_cli dsh @deepseek-ai/dsh
  ok "pnpm $(pnpm --version </dev/null), dsh $(dsh --version </dev/null 2>/dev/null | head -n 1)" \
     "pnpm $(pnpm --version </dev/null)，dsh $(dsh --version </dev/null 2>/dev/null | head -n 1)"

  # 2. Skill library -------------------------------------------------------
  step "Installing the skill library" "安装方法库 longevity-skills"
  if [ -d "$skills_dir/.git" ]; then
    if git -C "$skills_dir" pull --ff-only --quiet </dev/null >>"$LOG" 2>&1; then
      ok "Updated $(pretty "$skills_dir")" "已更新 $(pretty "$skills_dir")"
    else
      warn "Could not fast-forward $skills_dir; kept the current checkout." "$skills_dir 无法快进更新，保留现有版本。"
    fi
  else
    git clone --quiet https://github.com/zwbao/longevity-skills.git "$skills_dir" </dev/null >>"$LOG" 2>&1 \
      || fail_log "Could not clone longevity-skills." "无法下载 longevity-skills。"
    ok "Cloned into $(pretty "$skills_dir")" "已下载到 $(pretty "$skills_dir")"
  fi
  [ -f "$skills_dir/catalog.json" ] || die "$skills_dir has no catalog.json." "$skills_dir 中没有 catalog.json。"

  # 3. Python environment --------------------------------------------------
  step "Preparing the Python environment" "准备 Python 环境"
  if ! python_ok "$py"; then
    local base
    if [ -e "$venv" ]; then
      mv "$venv" "$venv.old-$(date +%Y%m%d%H%M%S)"
      info "Moved an incompatible $venv aside." "已将不兼容的 $venv 移到一旁。"
    fi
    if base="$(find_python)"; then
      "$base" -m venv "$venv" </dev/null >>"$LOG" 2>&1 \
        || fail_log "Could not create $venv (on Debian/Ubuntu: apt install python3-venv)." "无法创建 ${venv}（Debian/Ubuntu 需要 apt install python3-venv）。"
    elif have uv; then
      uv venv --quiet --python 3.12 "$venv" </dev/null >>"$LOG" 2>&1 || fail_log "uv could not create $venv." "uv 无法创建 ${venv}。"
    else
      die "Python 3.12 or later is required (or uv: https://docs.astral.sh/uv/)." "需要 Python 3.12 或更高版本（或安装 uv：https://docs.astral.sh/uv/）。"
    fi
  fi
  info "Installing mirobody, numpy, scipy and openpyxl" "安装 mirobody、numpy、scipy、openpyxl"
  if "$py" -m pip --version </dev/null >/dev/null 2>&1; then
    { "$py" -m pip install --quiet --upgrade pip && "$py" -m pip install --quiet --upgrade mirobody numpy scipy openpyxl; } </dev/null >>"$LOG" 2>&1 \
      || fail_log "pip could not install mirobody, numpy, scipy and openpyxl." "pip 无法安装 mirobody、numpy、scipy、openpyxl。"
  else
    uv pip install --quiet --python "$py" --upgrade mirobody numpy scipy openpyxl </dev/null >>"$LOG" 2>&1 \
      || fail_log "uv could not install mirobody, numpy, scipy and openpyxl." "uv 无法安装 mirobody、numpy、scipy、openpyxl。"
  fi
  local mirobody_version
  mirobody_version="$("$py" -c 'import mirobody; print(mirobody.__version__)' </dev/null)" \
    || die "The Mirobody engine does not import in $venv." "$venv 中无法导入 Mirobody 引擎。"
  ok "$(pretty "$venv") (mirobody $mirobody_version)" "$(pretty "$venv")（mirobody ${mirobody_version}）"

  # 4. Plugin --------------------------------------------------------------
  step "Installing the plugin into DeepSeek Harness" "将插件安装到 DeepSeek Harness"
  dsh plugin --profile "$profile" add "$plugin_spec" </dev/null >>"$LOG" 2>&1 \
    || fail_log "dsh plugin add $plugin_spec failed." "dsh plugin add $plugin_spec 失败。"
  local installed="$profile_dir/node_modules/dsh-plugin-longpi"
  [ -f "$installed/lib/index.js" ] && [ -f "$installed/vendor/dsh-plugin-mirobody/bridge/dsh_bridge.py" ] \
    || die "The plugin files are missing from $installed." "$installed 中缺少插件文件。"
  local plugin_version
  plugin_version="$(node -p 'require(process.argv[1]).version' "$installed/package.json" </dev/null)"
  ok "dsh-plugin-longpi $plugin_version (profile $profile)" "dsh-plugin-longpi ${plugin_version}（profile：${profile}）"

  # 5. Mirobody (optional) -------------------------------------------------
  if [ "$with_mirobody" = 1 ]; then
    step "Setting up Mirobody" "部署 Mirobody"
    if reachable "$mirobody_base/"; then
      ok "Mirobody is already running at $mirobody_base" "Mirobody 已在 $mirobody_base 运行"
    else
      if ! have docker || ! docker info </dev/null >/dev/null 2>&1; then
        die "--with-mirobody needs Docker installed and running." "--with-mirobody 需要已安装并正在运行的 Docker。"
      fi
      git lfs version </dev/null >/dev/null 2>&1 \
        || die "--with-mirobody needs git-lfs (brew install git-lfs, or apt install git-lfs)." "--with-mirobody 需要 git-lfs（brew install git-lfs 或 apt install git-lfs）。"
      local mirobody_dir="$longpi_home/mirobody"
      if [ ! -d "$mirobody_dir/.git" ]; then
        git clone --quiet --depth 1 https://github.com/thetahealth/mirobody.git "$mirobody_dir" </dev/null >>"$LOG" 2>&1 \
          || fail_log "Could not clone Mirobody." "无法下载 Mirobody。"
      fi
      info "Starting Mirobody with Docker; the first run takes a few minutes." "正在用 Docker 启动 Mirobody，首次运行需要几分钟。"
      (cd "$mirobody_dir" && git lfs install --local && git lfs pull && ./deploy.sh) </dev/null >>"$LOG" 2>&1 \
        || fail_log "Mirobody's deploy.sh failed." "Mirobody 的 deploy.sh 执行失败。"
      wait_for "$mirobody_base/" 300 || fail_log "Mirobody did not answer at $mirobody_base within 5 minutes." "Mirobody 在 5 分钟内没有在 $mirobody_base 响应。"
      ok "Mirobody is running at $mirobody_base" "Mirobody 已在 $mirobody_base 运行"
    fi
    if [ "$set_mcp" = 0 ]; then
      mcp_url="$(demo_mcp_url "$mirobody_base" "$py")" \
        || die "Could not get a personal MCP address for the demo account (is SEED_DEMO_DATA off?). Pass your own with --mcp-url." \
               "无法为演示账号生成个人 MCP 地址（是否关闭了 SEED_DEMO_DATA？）。请用 --mcp-url 传入自己的地址。"
      set_mcp=1
      ok "Connected the demo account (you@mirobody.ai)" "已连接演示账号（you@mirobody.ai）"
    fi
  fi

  # 6. Configuration -------------------------------------------------------
  step "Writing the configuration" "写入配置"
  mkdir -p "$profile_dir"
  local patch="$profile_dir/cordis.patch.yml" result
  result="$("$py" -c "$WRITE_CONFIG" "$patch" "$skills_dir" "$py" "$set_mcp" "$mcp_url" "$mcp_token" </dev/null)" \
    || die "Could not update $patch; add the dsh-plugin-longpi row by hand (docs/install.md)." "无法更新 ${patch}；请按 docs/install.zh.md 手动添加 dsh-plugin-longpi 配置。"
  ok "$(pretty "$patch")" "$(pretty "$patch")"
  local dump
  dump="$(dsh --profile "$profile" --dump-config </dev/null 2>>"$LOG")" || true
  case "$dump" in
    *"== dsh-plugin-longpi, patched by"*) ok "DeepSeek Harness reads the configuration" "DeepSeek Harness 已读取该配置" ;;
    *) warn "dsh --profile $profile --dump-config does not show the LongPi row; see $LOG." "dsh --profile $profile --dump-config 中没有 LongPi 配置，详见 ${LOG}。" ;;
  esac

  # 7. Summary -------------------------------------------------------------
  local skills_line
  skills_line="$("$py" -c 'import json, sys; d = json.load(open(sys.argv[1])); print(len(d.get("skills", [])), d.get("version") or "-")' "$skills_dir/catalog.json" </dev/null)"
  printf '\n%s%s%s\n' "$B" "$(pick "LongPi is installed." "LongPi 安装完成。")" "$N"
  row "Skills    " "方法库    " "$(pick "${skills_line% *} methods, version ${skills_line#* }" "${skills_line% *} 个方法，版本 ${skills_line#* }")"
  row "Python    " "Python    " "mirobody ${mirobody_version}"
  row "Plugin    " "插件      " "dsh-plugin-longpi ${plugin_version} (profile ${profile})"
  case "$result" in
    mcp=configured*) row "Mirobody  " "Mirobody  " "$(pick "connected" "已连接") ${result#*configured }" ;;
    *) row "Mirobody  " "Mirobody  " "$(pick "not connected; rerun with --mcp-url <URL> or --with-mirobody" "未连接；可加 --mcp-url <地址> 或 --with-mirobody 重新运行")" ;;
  esac
  row "Files     " "安装目录  " "$(pretty "$longpi_home")"
  if [ -n "${EXPOSED:-}" ]; then
    info "Linked${EXPOSED} into ~/.local/bin." "已将${EXPOSED} 链接到 ~/.local/bin。"
  fi
  if [ -n "${PATH_HINT:-}" ]; then
    warn "Add ${PATH_HINT} to PATH, e.g. echo 'export PATH=\"${PATH_HINT}:\$PATH\"' >> ~/.zshrc" \
         "请把 ${PATH_HINT} 加入 PATH，例如：echo 'export PATH=\"${PATH_HINT}:\$PATH\"' >> ~/.zshrc"
  fi
  printf '\n%s\n' "$(pick "Next:" "下一步：")"
  if reachable http://127.0.0.1:3080/; then
    printf '  %s\n' "$(pick "DeepSeek Harness is already running; stop it (Ctrl+C) and start it again so the plugin loads:" "DeepSeek Harness 正在运行，请先停止（Ctrl+C）再重新启动以加载插件：")"
  fi
  if [ "$profile" = web ]; then printf '  %sdsh web%s\n' "$B" "$N"; else printf '  %sdsh --profile %s%s\n' "$B" "$profile" "$N"; fi
  printf '  %s\n' "$(pick "Enter a DeepSeek API key when asked, pick a workspace, then type /longpi in the chat." "按提示填写 DeepSeek API Key 并选择工作区，然后在对话框输入 /longpi。")"
}

# --- helpers -----------------------------------------------------------------

pick() { if [ "${ZH:-0}" = 1 ]; then printf '%s' "$2"; else printf '%s' "$1"; fi; }
step() { printf '\n%s==>%s %s\n' "$B" "$N" "$(pick "$1" "$2")"; }
ok() { printf '  %s✓%s %s\n' "$G" "$N" "$(pick "$1" "$2")"; }
info() { printf '  %s\n' "$(pick "$1" "$2")"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$(pick "$1" "$2")" >&2; }
die() { printf '\n%s✗%s %s\n' "$R" "$N" "$(pick "$1" "$2")" >&2; exit 1; }
row() { printf '  %s %s\n' "$(pick "$1" "$2")" "$3"; }
pretty() { case "$1" in "$HOME"/*) printf '~%s' "${1#"$HOME"}" ;; *) printf '%s' "$1" ;; esac; }
have() { command -v "$1" >/dev/null 2>&1; }

arg() {
  [ $# -ge 2 ] && [ -n "$2" ] || die "$1 needs a value." "$1 需要一个值。"
  printf '%s' "$2"
}

fail_log() {
  printf '\n' >&2
  tail -n 20 "$LOG" >&2 || true
  die "$1 Full log: $LOG" "$2 完整日志：$LOG"
}

usage() {
  cat <<'EOF'
LongPi installer

  curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- [options]

Options
  --mcp-url URL      Connect a Mirobody record server (its personal MCP address)
  --mcp-token TOKEN  Access token, when the MCP address carries no secret
  --with-mirobody    Deploy Mirobody locally with Docker (demo data) and connect it
  --home DIR         Where the skill library and Python environment go (default ~/longpi)
  --profile NAME     DeepSeek Harness profile (default web)
  --plugin SPEC      Plugin to install (default github:zwbao/dsh-plugin-longpi)
  -h, --help         Show this help

Environment: DSH_HOME (default ~/.dsh), LONGPI_HOME, LONGPI_MIROBODY_URL.
Running the installer again updates every part and keeps existing settings.
EOF
}

# A command on PATH, installed with npm when missing. npm's global bin is not
# always on PATH, so a new or stranded command is linked into ~/.local/bin.
ensure_cli() {
  have "$1" && return 0
  if [ ! -x "$NPM_BIN/$1" ]; then
    info "Installing $2 with npm" "用 npm 安装 $2"
    npm_install_global "$2"
  fi
  have "$1" && return 0
  if [ -x "$NPM_BIN/$1" ]; then expose "$NPM_BIN/$1"; fi
  have "$1" || die "$1 was installed but is not on PATH." "$1 已安装，但不在 PATH 中。"
}

npm_install_global() {
  local prefix
  prefix="$(npm prefix -g </dev/null 2>>"$LOG")"
  if [ -w "$prefix" ] && { [ ! -d "$prefix/lib/node_modules" ] || [ -w "$prefix/lib/node_modules" ]; }; then
    npm install -g --no-fund --no-audit --loglevel=error "$1" </dev/null >>"$LOG" 2>&1 || fail_log "npm could not install $1." "npm 无法安装 $1。"
  else
    npm install -g --prefix "$HOME/.local" --no-fund --no-audit --loglevel=error "$1" </dev/null >>"$LOG" 2>&1 \
      || fail_log "npm could not install $1 into ~/.local." "npm 无法把 $1 安装到 ~/.local。"
    NPM_BIN="$HOME/.local/bin"
  fi
}

expose() {
  local target="$1" name dir="$HOME/.local/bin"
  name="$(basename "$target")"
  case ":$PATH:" in
    *":$dir:"*)
      mkdir -p "$dir"
      ln -sf "$target" "$dir/$name"
      EXPOSED="${EXPOSED:-} $name"
      ;;
    *)
      PATH_HINT="$(dirname "$target")"
      export PATH="$PATH_HINT:$PATH"
      ;;
  esac
}

python_ok() {
  [ -x "$1" ] && "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' </dev/null >/dev/null 2>&1
}

find_python() {
  local bin
  for bin in python3.14 python3.13 python3.12 python3; do
    if have "$bin" && python_ok "$(command -v "$bin")"; then
      command -v "$bin"
      return 0
    fi
  done
  return 1
}

# Any HTTP answer counts: the root page may redirect or ask for a login.
reachable() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$1" </dev/null 2>/dev/null)" || true
  [ -n "$code" ] && [ "$code" != 000 ]
}

wait_for() {
  local url="$1" limit="$2" waited=0
  while [ "$waited" -lt "$limit" ]; do
    reachable "$url" && return 0
    sleep 5
    waited=$((waited + 5))
  done
  return 1
}

# Sign in to Mirobody's seeded demo account and mint a personal MCP address.
demo_mcp_url() {
  local base="$1" py="$2" jwt attempt=0
  local field='import json, sys
body = json.load(sys.stdin)
value = (body.get("data") or {}).get(sys.argv[1])
if not value:
    sys.exit(body.get("msg") or "no " + sys.argv[1])
print(value)'
  while [ "$attempt" -lt 12 ]; do
    if jwt="$(curl -fsS --max-time 10 -X POST "$base/email/verify" -H 'Content-Type: application/json' \
          -d '{"email":"you@mirobody.ai","code":"111111"}' </dev/null 2>>"$LOG" | "$py" -c "$field" access_token 2>>"$LOG")"; then
      curl -fsS --max-time 10 -X POST "$base/personal/mcp" -H "Authorization: Bearer $jwt" </dev/null 2>>"$LOG" \
        | "$py" -c "$field" url 2>>"$LOG" && return 0
    fi
    attempt=$((attempt + 1))
    sleep 5
  done
  return 1
}

# Writes the LongPi row between two markers in the profile's patch file.
# Keeps values set earlier (MCP address, runtimes, member, ...), refreshes the
# paths this installer owns, and never touches other rows.
WRITE_CONFIG='
import os, re, sys, time
path, skills_home, python_bin, set_mcp, mcp_url, mcp_token = sys.argv[1:7]
BEGIN = "# >>> dsh-plugin-longpi (written by install.sh; keep one value per line) >>>"
END = "# <<< dsh-plugin-longpi <<<"
KEYS = ["skillsHome", "skillsVersion", "mirobodyPluginHome", "pythonBin", "mirobodyHome", "mcpUrl", "mcpToken",
        "member", "timeoutMs", "skillPython", "skillTimeoutMs", "skillRuntimes", "dataDir", "maxSkillMatches", "bootstrapWorkspace"]
DEFAULTS = {"skillsVersion": "\x27\x27", "mirobodyHome": "\x27\x27", "mcpUrl": "\x27\x27", "mcpToken": "\x27\x27",
            "member": "\x27\x27", "timeoutMs": "30000", "skillTimeoutMs": "120000", "skillRuntimes": "{}",
            "dataDir": "\x27\x27", "maxSkillMatches": "8", "bootstrapWorkspace": "true"}

def quote(text):
    return "\x27" + text.replace("\x27", "\x27\x27") + "\x27"

def unquote(raw):
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] == "\x27":
        return raw[1:-1].replace("\x27\x27", "\x27")
    if len(raw) >= 2 and raw[0] == raw[-1] == "\"":
        return raw[1:-1]
    return raw

text = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
lines = text.splitlines()
span = None
for i, line in enumerate(lines):
    if line.strip() == BEGIN:
        end = next((j + 1 for j in range(i + 1, len(lines)) if lines[j].strip() == END), None)
        if end is None:
            sys.exit("unterminated LongPi block")
        span = (i, end)
        break
if span is None:
    for i, line in enumerate(lines):
        if re.match(r"^-\s+id:\s*[\x27\"]?dsh-plugin-longpi[\x27\"]?\s*$", line):
            j = i + 1
            while j < len(lines) and (lines[j].startswith((" ", "\t")) or not lines[j].strip()):
                j += 1
            span = (i, j)
            break

values = dict(DEFAULTS)
if span:
    for line in lines[span[0]:span[1]]:
        match = re.match(r"^\s{4,}(\w+):\s*(.*?)\s*$", line)
        if match and match.group(1) in KEYS and match.group(2) not in ("", ">-", "|", ">"):
            values[match.group(1)] = match.group(2)
values["skillsHome"] = quote(skills_home)
values["pythonBin"] = quote(python_bin)
values["skillPython"] = quote(python_bin)
values["mirobodyPluginHome"] = "\x27\x27"
if set_mcp == "1":
    values["mcpUrl"] = quote(mcp_url)
    values["mcpToken"] = quote(mcp_token)

block = [BEGIN, "- id: dsh-plugin-longpi", "  config:"] + ["    %s: %s" % (key, values[key]) for key in KEYS] + [END]
if span:
    new_lines = lines[:span[0]] + block + lines[span[1]:]
else:
    content = [i for i, line in enumerate(lines) if line.strip() and not line.lstrip().startswith("#")]
    if len(content) == 1 and lines[content[0]].strip() == "[]":
        new_lines = lines[:content[0]] + block + lines[content[0] + 1:]
    elif content and lines[content[0]].lstrip().startswith("["):
        sys.exit("the patch file is a flow sequence")
    else:
        new_lines = lines + ([""] if lines and lines[-1].strip() else []) + block
new_text = "\n".join(new_lines) + "\n"
if new_text != text:
    if text:
        with open(path + ".bak-" + time.strftime("%Y%m%d%H%M%S"), "w", encoding="utf-8") as backup:
            backup.write(text)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as out:
        out.write(new_text)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
url = unquote(values["mcpUrl"])
if url:
    shown = re.sub(r"(/mcp/)[^/?#]+", r"\1…", url)
    print("mcp=configured " + shown)
else:
    print("mcp=none")
'

main "$@"
