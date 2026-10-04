#!/usr/bin/env bash
# LongPi installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- --mcp-url <URL>
#   curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- --with-mirobody
#   curl -fsSL .../install.sh | bash -s -- --mirror cn
#
# Installs the DeepSeek Harness CLI and pnpm when they are missing, clones
# longevity-skills, creates a Python environment with the Mirobody engine, adds
# dsh-plugin-longpi to a DSH profile and writes its configuration. Running it
# again updates every part and keeps the settings already in place.
#
# With no --mirror flag the commands are the public defaults (GitHub, npmjs,
# PyPI, Docker Hub). --mirror cn forces the mainland mirrors. --mirror auto
# probes github.com, registry.npmjs.org, pypi.org and registry-1.docker.io
# with a short timeout and switches only the hosts that do not answer.
#
# The whole script sits in main() so that `curl | bash` has read all of it
# before anything runs, and child processes get /dev/null as stdin.
#
#   bash install.sh install [--mirror cn|auto] [--with-mirobody]
#   bash install.sh update
#   bash install.sh status
#   npx dsh-plugin-longpi install
#
# longevity-skills is not an npm dependency. It is resolved from node_modules
# if one is there, then LONGPI_SKILLS_URL, then a git clone of GitHub main
# (or a mirror). An empty SKILLS_PIN_DEFAULT leaves skillsVersion empty, so the
# running catalog is the reference (docs/dev/packaging.md).

SKILLS_PIN_DEFAULT=

main() {
  set -euo pipefail

  local command="install"
  if [ $# -gt 0 ]; then
    case "$1" in
      install|update|status) command="$1"; shift ;;
    esac
  fi
  COMMAND="$command"

  local longpi_home="${LONGPI_HOME:-$HOME/longpi}"
  local profile="web"
  local plugin_spec="github:zwbao/dsh-plugin-longpi"
  local mcp_url="" mcp_token="" set_mcp=0 with_mirobody=0
  local mirobody_native=0 with_analyst=0 analyst_repo="${LONGPI_ANALYST_REPO:-https://github.com/zwbao/longevity-analyst-skill}"
  local with_coach="" coach_repo="${LONGPI_COACH_REPO:-https://github.com/zwbao/longevity-coach-skill}"
  local mirror_mode="${LONGPI_MIRROR:-}"

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
      --mirobody-native) with_mirobody=1; mirobody_native=1; shift ;;
      --with-analyst) with_analyst=1; shift ;;
      --analyst-repo) analyst_repo="$(arg "$@")"; with_analyst=1; shift 2 ;;
      --analyst-repo=*) analyst_repo="${1#*=}"; with_analyst=1; shift ;;
      --with-coach) with_coach=1; shift ;;
      --without-coach) with_coach=0; shift ;;
      --coach-repo) coach_repo="$(arg "$@")"; with_coach=1; shift 2 ;;
      --coach-repo=*) coach_repo="${1#*=}"; with_coach=1; shift ;;
      --mirror) mirror_mode="$(arg "$@")"; shift 2 ;;
      --mirror=*) mirror_mode="${1#*=}"; shift ;;
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
  if [ -f "$0" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  else
    SCRIPT_DIR=""
  fi
  local dsh_home="${DSH_HOME:-$HOME/.dsh}"
  if [ "$command" = status ]; then
    do_status "$longpi_home" "$profile" "$dsh_home"
    return
  fi
  mkdir -p "$longpi_home"
  longpi_home="$(cd "$longpi_home" && pwd)"
  local state="$longpi_home/install-state.json"
  if [ "$command" = update ] && [ -z "$mirror_mode" ] && [ -f "$state" ]; then
    mirror_mode="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("mirror") or "")' "$state" 2>/dev/null || true)"
  fi
  LOG="$longpi_home/install.log"
  LONGPI_CACHE="$longpi_home/cache"
  printf '\n==== %s install.sh\n' "$(date '+%Y-%m-%d %H:%M:%S')" >>"$LOG"
  resolve_mirrors "$mirror_mode"
  printf 'mirror=%s npm=%s pypi=%s github=%s docker=%s\n' \
    "${mirror_mode:-default}" "$USE_NPM_MIRROR" "$USE_PYPI_MIRROR" "$USE_GITHUB_MIRROR" "$USE_DOCKER_MIRROR" >>"$LOG"

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

  # 2. Plugin --------------------------------------------------------------
  # Before the library, so node_modules/longevity-skills shipped with the
  # plugin (or hoisted beside it) can be the skillsHome.
  step "Installing the plugin into DeepSeek Harness" "将插件安装到 DeepSeek Harness"
  PLUGIN_SPEC="$plugin_spec"
  PLUGIN_CHANGED=0
  local installed="$profile_dir/node_modules/dsh-plugin-longpi"
  if [ "$command" = update ]; then
    maybe_upgrade_plugin "$installed"
    plugin_spec="$PLUGIN_SPEC"
  fi
  if [ "$command" = update ] && [ "$PLUGIN_CHANGED" != 1 ] && [ -f "$installed/lib/index.js" ] && [ -f "$installed/vendor/dsh-plugin-mirobody/bridge/dsh_bridge.py" ]; then
    info "Plugin files are already installed; not running dsh plugin add." "插件已在，跳过 dsh plugin add。"
  else
    local resolved_plugin
    resolved_plugin="$(resolve_plugin_spec "$plugin_spec")" \
      || fail_log "Could not fetch the plugin. On a network that cannot reach GitHub, set LONGPI_PLUGIN_URL to an npm pack tarball (.tgz)." \
                  "无法取得插件。访问不了 GitHub 时，请把 LONGPI_PLUGIN_URL 设成一个 npm pack 压缩包（.tgz）。"
    if ! dsh plugin --profile "$profile" add "$resolved_plugin" </dev/null >>"$LOG" 2>&1; then
      # The pinned longevity-skills package is not on the registry until the lead publishes it.
      # A local plugin tarball can still be added once that dependency is left for this installer to place.
      local offline=""
      case "$resolved_plugin" in
        /*.tgz | /*.tar.gz | ./*.tgz | ./*.tar.gz)
          offline="$(plugin_tarball_without_library_dep "$resolved_plugin")" || offline=""
          ;;
      esac
      if [ -z "$offline" ] || ! dsh plugin --profile "$profile" add "$offline" </dev/null >>"$LOG" 2>&1; then
        fail_log "dsh plugin add $resolved_plugin failed." "dsh plugin add ${resolved_plugin} 失败。"
      fi
      note "Installed the plugin without fetching longevity-skills from the registry. The library is placed from node_modules or LONGPI_SKILLS_URL." \
           "插件已装上，没有从 npm 拉取 longevity-skills。方法库改从 node_modules 或 LONGPI_SKILLS_URL 取得。"
    fi
  fi
  [ -f "$installed/lib/index.js" ] && [ -f "$installed/vendor/dsh-plugin-mirobody/bridge/dsh_bridge.py" ] \
    || die "The plugin files are missing from $installed." "$installed 中缺少插件文件。"
  local plugin_version
  plugin_version="$(node -p 'require(process.argv[1]).version' "$installed/package.json" </dev/null)"
  ok "dsh-plugin-longpi $plugin_version (profile $profile)" "dsh-plugin-longpi ${plugin_version}（profile：${profile}）"

  # 3. Skill library -------------------------------------------------------
  step "Installing the skill library" "安装方法库 longevity-skills"
  local pin
  pin="$(read_pin "$installed/package.json" "${SCRIPT_DIR:-}/package.json")"
  install_skills "$skills_dir" "$installed" "$profile_dir" "$pin"
  [ -f "$skills_dir/catalog.json" ] || die "$skills_dir has no catalog.json." "$skills_dir 中没有 catalog.json。"

  # 4. Python environment --------------------------------------------------
  step "Preparing the Python environment" "准备 Python 环境"
  local req="$skills_dir/requirements-ci.txt" req_hash="" prev_hash="" skip_pip=0
  if [ -f "$req" ]; then
    req_hash="$(sha256_of "$req")"
  fi
  if [ -f "$state" ]; then
    prev_hash="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("requirements_sha256") or "")' "$state" 2>/dev/null || true)"
  fi
  if [ "$command" = update ] && [ -n "$req_hash" ] && [ "$req_hash" = "$prev_hash" ] && python_ok "$py"; then
    skip_pip=1
    info "requirements-ci.txt unchanged; keeping the Python environment." "requirements-ci.txt 未变，保留现有 Python 环境。"
  fi
  if [ "$skip_pip" != 1 ]; then
    if [ "$command" = update ] && [ -n "$req_hash" ] && [ "$req_hash" != "$prev_hash" ] && [ -e "$venv" ]; then
      mv "$venv" "$venv.old-$(date +%Y%m%d%H%M%S)"
      info "requirements-ci.txt changed; rebuilding the Python environment." "requirements-ci.txt 已变，正在重建 Python 环境。"
    fi
    if ! python_ok "$py"; then
      local base=""
      if [ -e "$venv" ]; then
        mv "$venv" "$venv.old-$(date +%Y%m%d%H%M%S)"
        info "Moved an incompatible $venv aside." "已将不兼容的 $venv 移到一旁。"
      fi
      # uv first. A system python3 -m venv is the fallback when uv cannot download a Python.
      if ensure_uv && uv venv --quiet --python 3.12 "$venv" </dev/null >>"$LOG" 2>&1; then
        info "Created the venv with uv (Python 3.12)." "已用 uv 创建 Python 3.12 虚拟环境。"
      else
        if have uv; then
          warn "uv could not create a Python 3.12 environment; trying a system interpreter." "uv 无法创建 Python 3.12 环境，改用系统解释器。"
        fi
        if base="$(find_python)"; then
          "$base" -m venv "$venv" </dev/null >>"$LOG" 2>&1 \
            || fail_log "Could not create $venv (on Debian/Ubuntu: apt install python3-venv)." "无法创建 ${venv}（Debian/Ubuntu 需要 apt install python3-venv）。"
        else
          die "Python 3.12 or later is required (or uv: https://docs.astral.sh/uv/)." "需要 Python 3.12 或更高版本（或安装 uv：https://docs.astral.sh/uv/）。"
        fi
      fi
    fi
    if [ -f "$req" ]; then
      info "Installing Python packages from requirements-ci.txt" "正在按 requirements-ci.txt 安装 Python 包"
      install_python_requirements "$py" "$req" \
        || fail_log "Could not install requirements-ci.txt." "无法安装 requirements-ci.txt。"
    else
      info "Installing mirobody, numpy, scipy and openpyxl" "安装 mirobody、numpy、scipy、openpyxl"
      if [ "$USE_PYPI_MIRROR" = 1 ]; then
        info "pip index: ${PIP_INDEX_CN} (fallback ${PIP_INDEX_CN_FALLBACK})" "pip 源：${PIP_INDEX_CN}（备用 ${PIP_INDEX_CN_FALLBACK}）"
      fi
      if "$py" -m pip --version </dev/null >/dev/null 2>&1; then
        if [ "$USE_PYPI_MIRROR" != 1 ]; then
          { "$py" -m pip install --quiet --upgrade pip && "$py" -m pip install --quiet --upgrade mirobody numpy scipy openpyxl; } </dev/null >>"$LOG" 2>&1 \
            || fail_log "pip could not install mirobody, numpy, scipy and openpyxl." "pip 无法安装 mirobody、numpy、scipy、openpyxl。"
        else
          { pip_install_quiet "$py" pip && pip_install_quiet "$py" mirobody numpy scipy openpyxl; } </dev/null >>"$LOG" 2>&1 \
            || fail_log "pip could not install mirobody, numpy, scipy and openpyxl." "pip 无法安装 mirobody、numpy、scipy、openpyxl。"
        fi
      else
        if [ "$USE_PYPI_MIRROR" != 1 ]; then
          uv pip install --quiet --python "$py" --upgrade mirobody numpy scipy openpyxl </dev/null >>"$LOG" 2>&1 \
            || fail_log "uv could not install mirobody, numpy, scipy and openpyxl." "uv 无法安装 mirobody、numpy、scipy、openpyxl。"
        else
          uv pip install --quiet --python "$py" --index-url "$PIP_INDEX_CN" --upgrade mirobody numpy scipy openpyxl </dev/null >>"$LOG" 2>&1 \
            || uv pip install --quiet --python "$py" --index-url "$PIP_INDEX_CN_FALLBACK" --upgrade mirobody numpy scipy openpyxl </dev/null >>"$LOG" 2>&1 \
            || fail_log "uv could not install mirobody, numpy, scipy and openpyxl." "uv 无法安装 mirobody、numpy、scipy、openpyxl。"
        fi
      fi
    fi
  fi
  local mirobody_version
  mirobody_version="$("$py" -c 'import mirobody; print(mirobody.__version__)' </dev/null)" \
    || die "The Mirobody engine does not import in $venv." "$venv 中无法导入 Mirobody 引擎。"
  ok "$(pretty "$venv") (mirobody $mirobody_version)" "$(pretty "$venv")（mirobody ${mirobody_version}）"

  # 5. Mirobody (optional) -------------------------------------------------
  if [ "$with_mirobody" = 1 ]; then
    step "Setting up Mirobody" "部署 Mirobody"
    if reachable "$mirobody_base/"; then
      ok "Mirobody is already running at $mirobody_base" "Mirobody 已在 $mirobody_base 运行"
    else
      if ! have docker || ! docker info </dev/null >/dev/null 2>&1; then
        die "--with-mirobody needs Docker installed and running." "--with-mirobody 需要已安装并正在运行的 Docker。"
      fi
      local mirobody_dir="$longpi_home/mirobody"
      obtain_mirobody "$mirobody_dir"
      if ! ensure_loinc "$mirobody_dir" "$py"; then
        fail_log "The LOINC bundle is still a Git LFS pointer. Install git-lfs, or set LONGPI_LOINC_URL to a real fhir_loinc_bundle.tar.gz." \
                 "LOINC 词表仍是 Git LFS 指针。请安装 git-lfs，或把 LONGPI_LOINC_URL 设成真正的 fhir_loinc_bundle.tar.gz。"
      fi
      if [ "$mirobody_native" = 1 ]; then
        mirobody_native_start "$mirobody_dir" "$mirobody_base" "$set_mcp"
      else
      docker_mirror_hint
      info "Starting Mirobody with Docker; the first run takes a few minutes." "正在用 Docker 启动 Mirobody，首次运行需要几分钟。"
      (cd "$mirobody_dir" && ./deploy.sh) </dev/null >>"$LOG" 2>&1 \
        || fail_log "Mirobody's deploy.sh failed." "Mirobody 的 deploy.sh 执行失败。"
      wait_for "$mirobody_base/" 300 || fail_log "Mirobody did not answer at $mirobody_base within 5 minutes." "Mirobody 在 5 分钟内没有在 $mirobody_base 响应。"
      fi
      ok "Mirobody is running at $mirobody_base" "Mirobody 已在 $mirobody_base 运行"
    fi
    if [ "$set_mcp" = 0 ]; then
      # 0.8.0: no demo account as the person's record. LongPi pairs an account of its own with this Mirobody
      # when DeepSeek Harness starts; the example profile on the 健康 page shows what a full record looks like.
      ok "LongPi will pair with this Mirobody by itself" "LongPi 会自动与这台电脑上的 Mirobody 配对"
    fi
  fi

  # 5b. Deep analysis skill (optional) ------------------------------------
  if [ "$with_analyst" = 1 ]; then
    step "Installing the deep analysis skill (longevity-analyst)" "安装深度分析技能（longevity-analyst）"
    install_analyst "$analyst_repo" "$dsh_home" \
      || fail_log "Could not install longevity-analyst from $analyst_repo (a private repository needs git access)." \
                  "无法从 $analyst_repo 安装 longevity-analyst（私有仓库需要 git 访问权限）。"
  fi

  # 5c. Pi, the longevity coach (default; --without-coach turns it off, and an update keeps that choice) ------
  if [ -z "$with_coach" ]; then
    if [ "$(read_patch_value "$profile_dir/cordis.patch.yml" coach 2>/dev/null || true)" = false ]; then with_coach=0; else with_coach=1; fi
  fi
  if [ "$with_coach" = 1 ]; then
    step "Installing Pi, the longevity coach (longevity-coach)" "安装长寿教练 Pi（longevity-coach）"
    install_coach "$coach_repo" "$dsh_home" \
      || warn "Could not install longevity-coach from $coach_repo; LongPi still speaks as Pi, without the full coaching method." \
              "无法从 $coach_repo 安装 longevity-coach；LongPi 仍以 Pi 的口吻说话，只是没有完整的教练方法。"
  else
    remove_coach "$dsh_home"
  fi

  # Health data never goes into DeepSeek's session logs: the home layer turns the upload off for every profile.
  ensure_session_log_off "$dsh_home" "$py"

  # 6. Configuration -------------------------------------------------------
  step "Writing the configuration" "写入配置"
  mkdir -p "$profile_dir"
  local patch="$profile_dir/cordis.patch.yml" result
  strip_brand_rows "$dsh_home" "$py"
  local local_base=""
  [ "$with_mirobody" = 1 ] && local_base="$mirobody_base"
  result="$("$py" -c "$WRITE_CONFIG" "$patch" "$skills_dir" "$py" "$set_mcp" "$mcp_url" "$mcp_token" "$pin" "$local_base" "$with_coach" </dev/null)" \
    || die "Could not update $patch; add the dsh-plugin-longpi row by hand (docs/install.md)." "无法更新 ${patch}；请按 docs/install.zh.md 手动添加 dsh-plugin-longpi 配置。"
  ok "$(pretty "$patch")" "$(pretty "$patch")"
  local dump
  dump="$(dsh --profile "$profile" --dump-config </dev/null 2>>"$LOG")" || true
  case "$dump" in
    *"== dsh-plugin-longpi, patched by"*) ok "DeepSeek Harness reads the configuration" "DeepSeek Harness 已读取该配置" ;;
    *) warn "dsh --profile $profile --dump-config does not show the LongPi row; see $LOG." "dsh --profile $profile --dump-config 中没有 LongPi 配置，详见 ${LOG}。" ;;
  esac
  local catalog_version=""
  catalog_version="$(catalog_version_of "$skills_dir/catalog.json" 2>/dev/null || true)"
  write_install_state "$state" "${mirror_mode:-}" "${SKILLS_ORIGIN:-}" "$req_hash" "$plugin_spec" "$pin" "$catalog_version"

  # 7. Summary -------------------------------------------------------------
  local skills_line
  skills_line="$("$py" -c 'import json, sys; d = json.load(open(sys.argv[1])); print(len(d.get("skills", [])), d.get("version") or "-")' "$skills_dir/catalog.json" </dev/null)"
  printf '\n%s%s%s\n' "$B" "$(pick "LongPi is installed." "LongPi 安装完成。")" "$N"
  row "Skills    " "方法库    " "$(pick "${skills_line% *} methods, version ${skills_line#* }" "${skills_line% *} 个方法，版本 ${skills_line#* }")"
  row "Python    " "Python    " "mirobody ${mirobody_version}"
  row "Plugin    " "插件      " "dsh-plugin-longpi ${plugin_version} (profile ${profile})"
  local mcp_line backup_line kept removed
  mcp_line="$(printf '%s\n' "$result" | grep '^mcp=' || true)"
  backup_line="$(printf '%s\n' "$result" | grep '^backups=' || true)"
  case "$mcp_line" in
    mcp=configured*) row "Mirobody  " "Mirobody  " "$(pick "connected" "已连接") ${mcp_line#*configured }" ;;
    *) if [ "$with_mirobody" = 1 ]; then
         row "Mirobody  " "Mirobody  " "$(pick "paired by LongPi when DeepSeek Harness starts" "DeepSeek Harness 启动后由 LongPi 自动配对")"
       else
         row "Mirobody  " "Mirobody  " "$(pick "not found on this computer; rerun with --with-mirobody" "这台电脑上没有健康数据服务；请加 --with-mirobody 重新运行")"
       fi ;;
  esac
  if [ -n "$backup_line" ]; then
    kept="${backup_line#backups=}"; removed="${kept#* }"; kept="${kept% *}"
    row "Backups   " "配置备份  " "$(pick "$kept kept (0600, newest 3 only; $removed older removed)" "保留 $kept 份（权限 0600，只留最新 3 份；删除了 $removed 份旧的）")"
  fi
  row "Files     " "安装目录  " "$(pretty "$longpi_home")"
  if [ "$USE_NPM_MIRROR" = 1 ] || [ "$USE_PYPI_MIRROR" = 1 ] || [ "$USE_GITHUB_MIRROR" = 1 ] || [ "$USE_DOCKER_MIRROR" = 1 ]; then
    row "Mirrors   " "镜像      " "npm=${USE_NPM_MIRROR} pypi=${USE_PYPI_MIRROR} github=${USE_GITHUB_MIRROR} docker=${USE_DOCKER_MIRROR}"
  fi
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
  --mirobody-native  Like --with-mirobody, but only Postgres runs in Docker; Mirobody
                     itself runs from a local venv (for networks where the app image
                     does not build). Logs and pids in the LongPi home.
  --with-analyst     Also install the deep analysis skill (longevity-analyst) into
                     DSH_HOME/skills; --analyst-repo URL for another source
  --without-coach    Do not install Pi, the longevity coach (longevity-coach), and
                     speak with LongPi's own voice. Pi is installed by default; an
                     update keeps the last choice; --with-coach turns it back on;
                     --coach-repo URL for another source
  --mirror MODE      cn: mainland mirrors. auto: probe GitHub, npm, PyPI and
                     Docker Hub (short timeout) and mirror only what failed.
                     Omit the flag to keep the public defaults.
  --home DIR         Where the skill library and Python environment go (default ~/longpi)
  --profile NAME     DeepSeek Harness profile (default web)
  --plugin SPEC      Plugin to install (default github:zwbao/dsh-plugin-longpi)
  -h, --help         Show this help

Commands
  install            Default. dsh, pnpm, this plugin, longevity-skills, Pi (longevity-coach), Python 3.12
  update             Newer plugin and the longevity-skills version it depends on.
                     Rebuilds the venv only when requirements-ci.txt changes.
                     Reuses the mirror recorded by the last install.
  status             Pinned skillsVersion against the running catalog. Exit 2
                     when a result cannot be labelled verified.

Environment: DSH_HOME (default ~/.dsh), LONGPI_HOME, LONGPI_MIROBODY_URL, LONGPI_MIRROR, LONGPI_ANALYST_REPO,
  LONGPI_COACH_REPO, LONGPI_COACH_REF (default v0.2.0).
Mainland mirrors (only when --mirror cn, or auto decides a host is down):
  LONGPI_NPM_REGISTRY       default https://registry.npmmirror.com
  LONGPI_PIP_INDEX          default https://mirrors.cloud.tencent.com/pypi/simple
  LONGPI_PIP_INDEX_FALLBACK default https://mirrors.aliyun.com/pypi/simple
  LONGPI_PLUGIN_URL         npm pack tarball (.tgz) or other dsh plugin spec
  LONGPI_PLUGIN_SHA256      sha256 of a downloaded plugin tarball (required before install)
  LONGPI_SKILLS_URL         git URL or .tar.gz of longevity-skills (catalog.json)
  LONGPI_SKILLS_SHA256      sha256 of a downloaded skills tarball (required before install)
  LONGPI_MIROBODY_SOURCE    git URL, tarball or local directory of thetahealth/mirobody
  LONGPI_LOINC_URL          fhir_loinc_bundle.tar.gz when git-lfs cannot pull it
                            (goes to mirobody/res/loinc/ for Mirobody >= 1.5.1)
  LONGPI_GITHUB_MIRROR      prefix tried before the built-in archive proxies,
                            e.g. https://ghfast.top/https://github.com
Running the installer again updates every part and keeps existing settings.
DeepSeek session-log upload is turned off in DSH_HOME/cordis.patch.yml unless a row for it already exists.
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
  # The array is never empty, so "${cmd[@]}" is safe under set -u on bash 3.2.
  local cmd
  if [ -w "$prefix" ] && { [ ! -d "$prefix/lib/node_modules" ] || [ -w "$prefix/lib/node_modules" ]; }; then
    cmd=(npm install -g --no-fund --no-audit --loglevel=error)
    if [ "${USE_NPM_MIRROR:-0}" = 1 ]; then
      cmd+=(--registry "$NPM_REGISTRY_CN")
    fi
    cmd+=("$1")
    "${cmd[@]}" </dev/null >>"$LOG" 2>&1 || fail_log "npm could not install $1." "npm 无法安装 $1。"
  else
    cmd=(npm install -g --prefix "$HOME/.local" --no-fund --no-audit --loglevel=error)
    if [ "${USE_NPM_MIRROR:-0}" = 1 ]; then
      cmd+=(--registry "$NPM_REGISTRY_CN")
    fi
    cmd+=("$1")
    "${cmd[@]}" </dev/null >>"$LOG" 2>&1 \
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
# Up to 0.7.0 the installer also disabled DeepSeek Harness's wordmark row inside LongPi's block, in whichever profile
# it configured. Every profile's patch loses that row (only inside the LongPi block), not just the one configured now.
strip_brand_rows() {
  local dsh_home="$1" py="$2" file
  for file in "$dsh_home"/profiles/*/cordis.patch.yml; do
    [ -f "$file" ] || continue
    "$py" - "$file" <<'PYEOF' >/dev/null 2>&1 || true
import sys
path = sys.argv[1]
lines = open(path, encoding="utf-8").read().split("\n")
out, inside, skip_next = [], False, False
for line in lines:
    stripped = line.strip()
    if stripped.startswith("# >>> dsh-plugin-longpi"):
        inside = True
    elif stripped.startswith("# <<< dsh-plugin-longpi"):
        inside = False
    if skip_next:
        skip_next = False
        if stripped == "disabled: true":
            continue
    if inside and stripped == "- id: ui-brand-official":
        skip_next = True
        continue
    out.append(line)
if out != lines:
    open(path, "w", encoding="utf-8").write("\n".join(out))
PYEOF
  done
}

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
# --- mainland mirrors --------------------------------------------------------
# Defaults stay on the public hosts. These globals are set by resolve_mirrors.

USE_NPM_MIRROR=0
USE_PYPI_MIRROR=0
USE_GITHUB_MIRROR=0
USE_DOCKER_MIRROR=0
NPM_REGISTRY_CN="https://registry.npmmirror.com"
PIP_INDEX_CN="https://mirrors.cloud.tencent.com/pypi/simple"
PIP_HOST_CN="mirrors.cloud.tencent.com"
PIP_INDEX_CN_FALLBACK="https://mirrors.aliyun.com/pypi/simple"
PIP_HOST_CN_FALLBACK="mirrors.aliyun.com"

# Progress that must not mix into a captured stdout.
note() { printf '  %s\n' "$(pick "$1" "$2")" >&2; }

resolve_mirrors() {
  local mode="$1"
  USE_NPM_MIRROR=0
  USE_PYPI_MIRROR=0
  USE_GITHUB_MIRROR=0
  USE_DOCKER_MIRROR=0
  NPM_REGISTRY_CN="${LONGPI_NPM_REGISTRY:-https://registry.npmmirror.com}"
  PIP_INDEX_CN="${LONGPI_PIP_INDEX:-https://mirrors.cloud.tencent.com/pypi/simple}"
  PIP_HOST_CN="${LONGPI_PIP_HOST:-mirrors.cloud.tencent.com}"
  PIP_INDEX_CN_FALLBACK="${LONGPI_PIP_INDEX_FALLBACK:-https://mirrors.aliyun.com/pypi/simple}"
  PIP_HOST_CN_FALLBACK="${LONGPI_PIP_HOST_FALLBACK:-mirrors.aliyun.com}"
  case "$mode" in
    "") return 0 ;;
    cn)
      USE_NPM_MIRROR=1
      USE_PYPI_MIRROR=1
      USE_GITHUB_MIRROR=1
      USE_DOCKER_MIRROR=1
      info "Using mainland mirrors (npm ${NPM_REGISTRY_CN}, pip ${PIP_INDEX_CN})." \
           "使用大陆镜像（npm ${NPM_REGISTRY_CN}，pip ${PIP_INDEX_CN}）。"
      ;;
    auto)
      step "Checking which hosts answer" "检查哪些站点能连通"
      if host_answers "https://github.com/"; then
        info "github.com answers" "github.com 可连通"
      else
        USE_GITHUB_MIRROR=1
        info "github.com did not answer; source will not be cloned from GitHub." "github.com 不通，不再从 GitHub 克隆源码。"
      fi
      if host_answers "https://registry.npmjs.org/"; then
        info "registry.npmjs.org answers" "registry.npmjs.org 可连通"
      else
        USE_NPM_MIRROR=1
        info "registry.npmjs.org did not answer; npm will use ${NPM_REGISTRY_CN}." "registry.npmjs.org 不通，npm 改用 ${NPM_REGISTRY_CN}。"
      fi
      if host_answers "https://pypi.org/simple/pip/"; then
        info "pypi.org answers" "pypi.org 可连通"
      else
        USE_PYPI_MIRROR=1
        info "pypi.org did not answer; pip will use ${PIP_INDEX_CN}." "pypi.org 不通，pip 改用 ${PIP_INDEX_CN}。"
      fi
      if host_answers "https://registry-1.docker.io/v2/"; then
        info "registry-1.docker.io answers" "registry-1.docker.io 可连通"
      else
        USE_DOCKER_MIRROR=1
        info "registry-1.docker.io did not answer." "registry-1.docker.io 不通。"
      fi
      ;;
    *)
      die "--mirror must be cn or auto (got: $mode)." "--mirror 只能是 cn 或 auto（当前：${mode}）。"
      ;;
  esac
  if [ "$USE_NPM_MIRROR" = 1 ]; then
    export npm_config_registry="$NPM_REGISTRY_CN"
  fi
}

# Any HTTP status means the host answered. A timeout or "000" means it did not.
# Connect timeout is 3s and the whole probe is 5s, so a black-holed route fails fast.
host_answers() {
  local url="$1" code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 5 "$url" </dev/null 2>>"$LOG")" || code=000
  [ -n "${code}" ] && [ "${code}" != "000" ]
}

pip_install_quiet() {
  local py="$1"
  shift
  if [ "${USE_PYPI_MIRROR:-0}" != 1 ]; then
    "$py" -m pip install --quiet --upgrade "$@"
    return
  fi
  if "$py" -m pip install --quiet --upgrade -i "$PIP_INDEX_CN" --trusted-host "$PIP_HOST_CN" "$@"; then
    return 0
  fi
  echo "pip index ${PIP_INDEX_CN} failed; trying ${PIP_INDEX_CN_FALLBACK}" >>"$LOG"
  warn "The pip index ${PIP_INDEX_CN} failed; trying ${PIP_INDEX_CN_FALLBACK}." \
       "pip 源 ${PIP_INDEX_CN} 失败，改试 ${PIP_INDEX_CN_FALLBACK}。"
  "$py" -m pip install --quiet --upgrade -i "$PIP_INDEX_CN_FALLBACK" --trusted-host "$PIP_HOST_CN_FALLBACK" "$@"
}

download_file() {
  local url="$1" dest="$2" tmp
  tmp="${dest}.partial"
  rm -f "$tmp"
  curl -fL --retry 2 --connect-timeout 5 --max-time 300 -o "$tmp" "$url" </dev/null >>"$LOG" 2>&1 || { rm -f "$tmp"; return 1; }
  mv "$tmp" "$dest"
}

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print $1 }'
  else
    sha256sum "$1" | awk '{ print $1 }'
  fi
}

# A downloaded plugin or skills tarball is installed only when its sha256 matches
# the checksum published with that release. Local files and git clones are not hashed.
verify_integrity() {
  local file="$1" integrity="$2" algo b64 actual
  algo="${integrity%%-*}"
  b64="${integrity#*-}"
  [ "$algo" = "sha512" ] || return 1
  [ -n "$b64" ] || return 1
  actual="$(openssl dgst -sha512 -binary "$file" | openssl base64 -A)"
  [ "$actual" = "$b64" ]
}

verify_tarball() {
  local file="$1" url="$2" integrity="${3:-}" expected="" label=""
  case "$url" in
    *dsh-plugin-longpi*) expected="${LONGPI_PLUGIN_SHA256:-}"; label="plugin" ;;
    *longevity-skills*) expected="${LONGPI_SKILLS_SHA256:-}"; label="skills" ;;
    *) return 0 ;;
  esac
  if [ -n "$expected" ]; then
    local actual
    actual="$(sha256_of "$file")"
    if [ "$actual" != "$expected" ]; then
      rm -f "$file"
      die "sha256 mismatch for the ${label} tarball (expected ${expected}, got ${actual})." \
          "${label} 压缩包的 sha256 不一致（期望 ${expected}，实际 ${actual}）。没有安装。"
    fi
    note "sha256 ok for ${label}" "${label} 的 sha256 已核对"
    return 0
  fi
  if [ -n "$integrity" ] && verify_integrity "$file" "$integrity"; then
    note "integrity ok for ${label}" "${label} 的发布校验已核对"
    return 0
  fi
  if [ -n "$integrity" ]; then
    rm -f "$file"
    die "integrity mismatch for the ${label} tarball." "${label} 压缩包的发布校验不一致。没有安装。"
  fi
  die "Refusing to install the downloaded ${label} tarball without a sha256. Set LONGPI_PLUGIN_SHA256 or LONGPI_SKILLS_SHA256 to the checksum published with the release." \
      "拒绝安装没有 sha256 的${label}压缩包。请设置 LONGPI_PLUGIN_SHA256 或 LONGPI_SKILLS_SHA256，用这次发布公布的校验和。"
}

# Leave $marker at $dest/$marker. GitHub archives wrap one top directory; npm
# pack tarballs wrap "package/". The shortest path wins.
extract_marked() {
  local archive="$1" dest="$2" marker="$3" tmp root found
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/longpi-src.XXXXXX")"
  tar -xzf "$archive" -C "$tmp" >>"$LOG" 2>&1 || { rm -rf "$tmp"; return 1; }
  if [ -f "$tmp/$marker" ]; then
    root="$tmp"
  else
    # head closes the pipe early; ignore the SIGPIPE status under pipefail.
    found="$(find "$tmp" -type f -name "$marker" | awk '{ print length, $0 }' | sort -n | head -n 1 | cut -d' ' -f2-)" || true
    [ -n "$found" ] || { rm -rf "$tmp"; return 1; }
    root="$(dirname "$found")"
  fi
  mkdir -p "$dest"
  cp -R "$root"/. "$dest"/ >>"$LOG" 2>&1 || { rm -rf "$tmp"; return 1; }
  rm -rf "$tmp"
  [ -f "$dest/$marker" ]
}

fetch_source() {
  local url="$1" dest="$2" marker="$3" archive
  case "$url" in
    git@* | *.git)
      git clone --quiet --depth 1 "$url" "$dest" </dev/null >>"$LOG" 2>&1 || return 1
      ;;
    /* | ./*)
      if [ -d "$url" ]; then
        mkdir -p "$dest"
        cp -R "$url"/. "$dest"/ || return 1
      else
        extract_marked "$url" "$dest" "$marker" || return 1
      fi
      ;;
    *.tar.gz | *.tgz | *archive/refs/*)
      archive="$(mktemp "${TMPDIR:-/tmp}/longpi-arc.XXXXXX")"
      download_file "$url" "$archive" || { rm -f "$archive"; return 1; }
      verify_tarball "$archive" "$url" || { rm -f "$archive"; return 1; }
      extract_marked "$archive" "$dest" "$marker" || { rm -f "$archive"; return 1; }
      rm -f "$archive"
      ;;
    *)
      git clone --quiet --depth 1 "$url" "$dest" </dev/null >>"$LOG" 2>&1 || return 1
      ;;
  esac
  [ -f "$dest/$marker" ]
}

github_mirror_prefixes() {
  if [ -n "${LONGPI_GITHUB_MIRROR:-}" ]; then
    printf '%s\n' "$LONGPI_GITHUB_MIRROR"
  fi
  # These proxies answer without the client opening github.com. ghfast.top and
  # gh-proxy.com both returned a real gzip of this repo when checked on 2026-09-28.
  # There is no Gitee remote for these repositories; set LONGPI_SKILLS_URL or
  # LONGPI_PLUGIN_URL to a Gitee import (or any other URL) to use one.
  printf '%s\n' "https://ghfast.top/https://github.com"
  printf '%s\n' "https://gh-proxy.com/https://github.com"
}

fetch_github_archive() {
  local owner="$1" repo="$2" ref="$3" dest="$4" marker="$5"
  local prefix refpath url refs
  if [ -z "$ref" ] || [ "$ref" = main ]; then
    refs="heads/main"
  else
    refs="tags/${ref} heads/${ref}"
  fi
  while IFS= read -r prefix; do
    [ -n "$prefix" ] || continue
    prefix="${prefix%/}"
    for refpath in $refs; do
      url="${prefix}/${owner}/${repo}/archive/refs/${refpath}.tar.gz"
      note "Trying ${url}" "正在尝试 ${url}"
      if fetch_source "$url" "$dest" "$marker"; then
        return 0
      fi
      rm -rf "$dest"
    done
  done <<EOF
$(github_mirror_prefixes)
EOF
  return 1
}

# Prints an https URL ending in .tgz, or fails. Missing packages are normal:
# dsh-plugin-longpi and longevity-skills are not on npm yet (checked 2026-09-28).
npm_dist_tarball() {
  local name="$1" out
  out="$(npm view "$name" dist.tarball --registry "$NPM_REGISTRY_CN" </dev/null 2>>"$LOG")" || return 1
  out="$(printf '%s\n' "$out" | awk '/^https?:\/\/.*\.tgz$/ { line = $0 } END { print line }')"
  [ -n "$out" ] || return 1
  printf '%s' "$out"
}

# Download a plugin archive and print a path pnpm can add. npm-pack tarballs
# (top-level package/package.json) are returned as-is. Git archives are packed
# with npm pack so the result has the layout dsh plugin add expects.
materialize_plugin_tarball() {
  local url="$1" archive srcdir packed kept
  mkdir -p "$LONGPI_CACHE"
  case "$url" in
    /* | ./*)
      if [ -f "$url" ]; then
        printf '%s' "$url"
        return 0
      fi
      return 1
      ;;
  esac
  archive="$LONGPI_CACHE/plugin-download.tgz"
  download_file "$url" "$archive" || return 1
  verify_tarball "$archive" "$url" || return 1
  local listing
  listing="$(tar -tzf "$archive" | head -n 40)" || true
  case "$listing" in
    *package/package.json*)
      printf '%s' "$archive"
      return 0
      ;;
  esac
  srcdir="$(mktemp -d "${TMPDIR:-/tmp}/longpi-plugin.XXXXXX")"
  extract_marked "$archive" "$srcdir" package.json || { rm -rf "$srcdir"; return 1; }
  packed="$(cd "$srcdir" && npm pack --ignore-scripts </dev/null)" || { rm -rf "$srcdir"; return 1; }
  packed="$(printf '%s\n' "$packed" | tail -n 1)"
  case "$packed" in
    /*) ;;
    *) packed="$srcdir/$packed" ;;
  esac
  [ -f "$packed" ] || { rm -rf "$srcdir"; return 1; }
  kept="$LONGPI_CACHE/$(basename "$packed")"
  mv "$packed" "$kept"
  rm -rf "$srcdir"
  printf '%s' "$kept"
}

resolve_plugin_spec() {
  local spec="$1" rest owner repo ref tarball srcdir packed kept
  if [ "${USE_GITHUB_MIRROR:-0}" != 1 ]; then
    printf '%s' "$spec"
    return 0
  fi
  if [ -n "${LONGPI_PLUGIN_URL:-}" ]; then
    spec="${LONGPI_PLUGIN_URL}"
  fi
  case "$spec" in
    github:*) ;;
    *)
      case "$spec" in
        http://*.tgz | http://*.tar.gz | https://*.tgz | https://*.tar.gz | http://*archive/refs/* | https://*archive/refs/*)
          materialize_plugin_tarball "$spec" || return 1
          return 0
          ;;
        /*.tgz | /*.tar.gz | ./*.tgz | ./*.tar.gz)
          printf '%s' "$spec"
          return 0
          ;;
      esac
      printf '%s' "$spec"
      return 0
      ;;
  esac
  rest="${spec#github:}"
  ref=""
  case "$rest" in
    *#*) ref="${rest#*#}"; rest="${rest%%#*}" ;;
  esac
  owner="${rest%%/*}"
  repo="${rest#*/}"
  # Only the published name. A fork passed via --plugin is fetched as an archive.
  if [ "$owner/$repo" = "zwbao/dsh-plugin-longpi" ]; then
    tarball="$(npm_dist_tarball dsh-plugin-longpi)" || tarball=""
    if [ -n "$tarball" ]; then
      note "Plugin tarball: ${tarball}" "插件压缩包：${tarball}"
      materialize_plugin_tarball "$tarball" || return 1
      return 0
    fi
    note "dsh-plugin-longpi is not on the npm mirror; trying a GitHub archive proxy." \
         "npm 镜像上还没有 dsh-plugin-longpi，改从 GitHub 归档代理下载。"
  fi
  srcdir="$(mktemp -d "${TMPDIR:-/tmp}/longpi-plugin.XXXXXX")"
  if ! fetch_github_archive "$owner" "$repo" "${ref:-main}" "$srcdir" package.json; then
    rm -rf "$srcdir"
    return 1
  fi
  packed="$(cd "$srcdir" && npm pack --ignore-scripts </dev/null)" || { rm -rf "$srcdir"; return 1; }
  packed="$(printf '%s\n' "$packed" | tail -n 1)"
  case "$packed" in
    /*) ;;
    *) packed="$srcdir/$packed" ;;
  esac
  [ -f "$packed" ] || { rm -rf "$srcdir"; return 1; }
  mkdir -p "$LONGPI_CACHE"
  kept="$LONGPI_CACHE/$(basename "$packed")"
  mv "$packed" "$kept"
  rm -rf "$srcdir"
  printf '%s' "$kept"
}

install_skills() {
  local skills_dir="$1" plugin_dir="${2:-}" profile_dir_arg="${3:-}" pin="${4:-$SKILLS_PIN_DEFAULT}" src tarball found="" sibling=""
  if [ -n "${SCRIPT_DIR:-}" ] && [ "$(basename "$(dirname "$SCRIPT_DIR")")" = "node_modules" ]; then
    sibling="$(dirname "$SCRIPT_DIR")/longevity-skills"
  fi
  found="$(find_packaged_skills \
    "$plugin_dir/node_modules/longevity-skills" \
    "$profile_dir_arg/node_modules/longevity-skills" \
    "${SCRIPT_DIR:-}/node_modules/longevity-skills" \
    "$sibling")" || found=""
  if [ -n "$found" ]; then
    # A packaged tree is not a git checkout. Do not fast-forward one over it.
    link_skills "$found" "$skills_dir"
    SKILLS_ORIGIN=package
    ok "Skill library from node_modules ($(pretty "$found"))" "方法库来自 node_modules（$(pretty "$found")）"
    return 0
  fi
  if [ -L "$skills_dir" ]; then
    SKILLS_ORIGIN=package
    ok "Kept packaged library $(pretty "$skills_dir")" "已保留打包的方法库 $(pretty "$skills_dir")"
    return 0
  fi
  # An explicit URL or local tarball wins over git clone on every mirror mode.
  # A local tarball is placed in the plugin's node_modules (no sha256: it is not a download).
  if [ -n "${LONGPI_SKILLS_URL:-}" ]; then
    src="${LONGPI_SKILLS_URL}"
    case "$src" in
      /*.tgz | /*.tar.gz | ./*.tgz | ./*.tar.gz)
        local dest_nm="$plugin_dir/node_modules/longevity-skills"
        mkdir -p "$plugin_dir/node_modules"
        rm -rf "$dest_nm"
        extract_marked "$src" "$dest_nm" catalog.json \
          || fail_log "Could not unpack the longevity-skills tarball." "无法解压 longevity-skills 压缩包。"
        link_skills "$dest_nm" "$skills_dir"
        SKILLS_ORIGIN=package
        ok "Skill library from ${src}" "方法库来自 ${src}"
        return 0
        ;;
    esac
    fetch_source "$src" "$skills_dir" catalog.json \
      || fail_log "Could not fetch longevity-skills from LONGPI_SKILLS_URL." "无法从 LONGPI_SKILLS_URL 下载 longevity-skills。"
    ok "Skill library from ${src}" "方法库来自 ${src}"
    case "$src" in
      *.git | git@*) SKILLS_ORIGIN=git ;;
      *) SKILLS_ORIGIN=package ;;
    esac
    return 0
  fi
  if [ "${USE_GITHUB_MIRROR:-0}" != 1 ]; then
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
    SKILLS_ORIGIN=git
    return 0
  fi
  if [ -f "$skills_dir/catalog.json" ] && [ -z "${LONGPI_SKILLS_REFRESH:-}" ]; then
    if [ -d "$skills_dir/.git" ]; then
      if git -C "$skills_dir" pull --ff-only --quiet </dev/null >>"$LOG" 2>&1; then
        ok "Updated $(pretty "$skills_dir")" "已更新 $(pretty "$skills_dir")"
      else
        warn "Could not fast-forward $skills_dir; kept the current checkout." "$skills_dir 无法快进更新，保留现有版本。"
      fi
      SKILLS_ORIGIN=git
    else
      # No .git: this is a tarball or package tree. Do not clone over it.
      ok "Kept $(pretty "$skills_dir")" "已保留 $(pretty "$skills_dir")"
      SKILLS_ORIGIN=package
    fi
    return 0
  fi
  case "$skills_dir" in
    "" | / | "$HOME") die "Refusing to replace $skills_dir." "拒绝替换 ${skills_dir}。" ;;
  esac
  rm -rf "$skills_dir"
  tarball="$(npm_dist_tarball "longevity-skills@${pin}")" || tarball=""
  if [ -n "$tarball" ]; then
    fetch_source "$tarball" "$skills_dir" catalog.json \
      || fail_log "Could not download the longevity-skills tarball." "无法下载 longevity-skills 压缩包。"
    SKILLS_ORIGIN=package
    ok "Skill library from the npm tarball" "方法库来自 npm 压缩包"
    return 0
  fi
  note "longevity-skills is not on the npm mirror; trying a GitHub archive proxy." \
       "npm 镜像上没有 longevity-skills，改从 GitHub 归档代理下载。"
  fetch_github_archive zwbao longevity-skills main "$skills_dir" catalog.json \
    || fail_log "Could not download longevity-skills. Set LONGPI_SKILLS_URL to a tarball or git URL this machine can reach (for example a Gitee import). Publishing the library to npm would make the npmmirror tarball path work with no proxy." \
                "无法下载 longevity-skills。请把 LONGPI_SKILLS_URL 设成这台机器能访问的压缩包或 git 地址（例如导入 Gitee 后的地址）。把方法库发布到 npm 后，npmmirror 上的压缩包路径就不需要代理。"
  SKILLS_ORIGIN=archive
  ok "Skill library from a GitHub archive proxy" "方法库来自 GitHub 归档代理"
}

obtain_mirobody() {
  local dir="$1"
  if [ -d "$dir/.git" ] || [ -x "$dir/deploy.sh" ]; then
    return 0
  fi
  if [ "${USE_GITHUB_MIRROR:-0}" != 1 ]; then
    git clone --quiet --depth 1 https://github.com/thetahealth/mirobody.git "$dir" </dev/null >>"$LOG" 2>&1 \
      || fail_log "Could not clone Mirobody." "无法下载 Mirobody。"
    return 0
  fi
  if [ -n "${LONGPI_MIROBODY_SOURCE:-}" ]; then
    fetch_source "$LONGPI_MIROBODY_SOURCE" "$dir" deploy.sh \
      || fail_log "Could not fetch Mirobody from LONGPI_MIROBODY_SOURCE." "无法从 LONGPI_MIROBODY_SOURCE 取得 Mirobody。"
    return 0
  fi
  fetch_github_archive thetahealth mirobody main "$dir" deploy.sh \
    || fail_log "Could not download Mirobody. Set LONGPI_MIROBODY_SOURCE to a tarball or git URL this machine can reach." \
                "无法下载 Mirobody。请把 LONGPI_MIROBODY_SOURCE 设成这台机器能访问的压缩包或 git 地址。"
}

is_lfs_pointer() {
  local path="$1" head
  [ -f "$path" ] || return 1
  head="$(head -c 24 "$path" 2>/dev/null || true)"
  case "$head" in
    "version https://git-lfs"*) return 0 ;;
  esac
  return 1
}

bundle_ready() {
  [ -f "$1" ] && ! is_lfs_pointer "$1"
}

loinc_from_wheel() {
  "$1" -c 'import os, sys
try:
    import mirobody
except Exception:
    sys.exit(0)
root = os.path.dirname(os.path.abspath(mirobody.__file__))
# Mirobody 1.5.1 moved the bundle to res/loinc/; older wheels keep it in res/.
p = next((c for c in (os.path.join(root, "res", "loinc", "fhir_loinc_bundle.tar.gz"),
                      os.path.join(root, "res", "fhir_loinc_bundle.tar.gz")) if os.path.isfile(c)), "")
if not p:
    sys.exit(0)
raw = open(p, "rb").read(24)
if raw.startswith(b"version https://git-lfs"):
    sys.exit(0)
print(p)
' </dev/null 2>>"$LOG" || true
}

loinc_bundle_path() {
  # Mirobody 1.5.1 moved the bundle to mirobody/res/loinc/ (its .gitattributes and _bundle.py say so);
  # an older checkout keeps it in mirobody/res/.
  if [ -d "$1/mirobody/res/loinc" ] || grep -q "res/loinc/" "$1/.gitattributes" 2>/dev/null; then
    printf '%s' "$1/mirobody/res/loinc/fhir_loinc_bundle.tar.gz"
  else
    printf '%s' "$1/mirobody/res/fhir_loinc_bundle.tar.gz"
  fi
}

ensure_loinc() {
  local dir="$1" py="$2"
  local bundle wheel
  bundle="$(loinc_bundle_path "$dir")"
  if bundle_ready "$bundle"; then
    return 0
  fi
  if [ -d "$dir/.git" ] && git lfs version </dev/null >/dev/null 2>&1; then
    if (cd "$dir" && git lfs install --local && git lfs pull) </dev/null >>"$LOG" 2>&1; then
      if bundle_ready "$bundle"; then
        ok "LOINC bundle from git-lfs" "LOINC 词表来自 git-lfs"
        return 0
      fi
    fi
    warn "git lfs pull did not produce the LOINC bundle." "git lfs pull 没有得到 LOINC 词表。"
  elif ! git lfs version </dev/null >/dev/null 2>&1; then
    warn "git-lfs is not installed; trying the LOINC fallback." "未安装 git-lfs，改用 LOINC 备用方式。"
  fi
  if [ -n "${LONGPI_LOINC_URL:-}" ]; then
    mkdir -p "$(dirname "$bundle")"
    if download_file "$LONGPI_LOINC_URL" "$bundle" && bundle_ready "$bundle"; then
      ok "LOINC bundle from LONGPI_LOINC_URL" "LOINC 词表来自 LONGPI_LOINC_URL"
      return 0
    fi
    warn "LONGPI_LOINC_URL did not yield a real bundle." "LONGPI_LOINC_URL 没有得到可用的词表。"
  fi
  wheel="$(loinc_from_wheel "$py")"
  if [ -n "$wheel" ] && bundle_ready "$wheel"; then
    mkdir -p "$(dirname "$bundle")"
    cp -f "$wheel" "$bundle"
    if bundle_ready "$bundle"; then
      ok "LOINC bundle copied from the installed mirobody wheel" "LOINC 词表已从已安装的 mirobody 包复制"
      return 0
    fi
  fi
  return 1
}

mirobody_native_start() {
  # Postgres in its container, Mirobody itself from a local venv: the app image does not build behind
  # some networks, and `thetahealth/mirobody` is not always published for the checkout's version.
  local dir="$1" base="$2" has_mcp="$3"
  local venv="$longpi_home/.mirobody-app" envfile="$longpi_home/mirobody-native.env" hostport host port name pgport
  hostport="${base#*://}"; hostport="${hostport%%/*}"
  host="${hostport%:*}"; port="${hostport##*:}"
  case "$port" in ''|*[!0-9]*) die "--mirobody-native needs a Mirobody address with a port, like http://127.0.0.1:18060 (got $base)." \
                                   "--mirobody-native 需要带端口的 Mirobody 地址，比如 http://127.0.0.1:18060（现在是 $base）。" ;; esac
  have openssl || die "--mirobody-native needs openssl to generate Mirobody's secrets." "--mirobody-native 需要 openssl 来生成 Mirobody 的密钥。"
  (
    cd "$dir" && umask 077 && touch .env && chmod 600 .env
    grep -q '^ENV=.' .env || printf 'ENV=localdb\n' >> .env
    grep -q '^MIROBODY_ENV_FILE=.' .env || printf 'MIROBODY_ENV_FILE=./.env\n' >> .env
    for name in PG_PASSWORD PG_ENCRYPTION_KEY CONFIG_ENCRYPTION_KEY LOG_ENCRYPTION_KEY JWT_KEY; do
      if ! grep -q "^${name}=." .env; then
        value="$(openssl rand -hex 32)"
        [ -n "$value" ] || exit 1
        grep -v "^${name}=" .env > .env.tmp || true
        printf '%s=%s\n' "$name" "$value" >> .env.tmp && mv .env.tmp .env && chmod 600 .env
      fi
    done
    docker compose up -d pg
  ) </dev/null >>"$LOG" 2>&1 || fail_log "Could not set Mirobody's secrets or start its Postgres container." "无法设置 Mirobody 的密钥或启动其 Postgres 容器。"
  pgport="$(sed -n 's/^PG_HOST_PORT=//p' "$dir/.env" | head -n 1)"
  pgport="${pgport:-${PG_HOST_PORT:-18062}}"
  if [ ! -x "$venv/bin/mirobody" ]; then
    ensure_uv || die "--mirobody-native needs uv to build $venv." "--mirobody-native 需要 uv 来创建 ${venv}。"
    uv venv --python 3.12 "$venv" </dev/null >>"$LOG" 2>&1 || fail_log "Could not create $venv." "无法创建 ${venv}。"
    run_uv_pip "$venv/bin/python" -e "$dir" || fail_log "Could not install Mirobody into $venv." "无法把 Mirobody 装进 ${venv}。"
  fi
  (
    umask 077
    {
      printf 'ENV=localdb\nPYTHONUNBUFFERED=1\nHTTP_HOST=%s\nHTTP_PORT=%s\n' "$host" "$port"
      # The demo account is seeded only when no --mcp-url was given (the installer connects it then).
      # No demo readings: LongPi pairs an account of its own, and the 健康 page has an example profile.
      printf 'SEED_DEMO_DATA=false\n'
      printf 'PG_HOST=127.0.0.1\nPG_PORT=%s\nPG_USER=holistic_user\nPG_DBNAME=holistic_db\n' "$pgport"
      printf 'PG_PASSWORD=%s\n' "$(sed -n 's/^PG_PASSWORD=//p' "$dir/.env" | head -n 1)"
    } > "$envfile"
  )
  chmod 600 "$envfile"
  # The logs carry personal MCP links: only this account may read them, also when Mirobody is already running.
  for name in serve worker; do
    [ -f "$longpi_home/mirobody-$name.log" ] && chmod 600 "$longpi_home/mirobody-$name.log" 2>/dev/null
  done
  for name in serve worker; do
    if [ -f "$longpi_home/mirobody-$name.pid" ] && kill -0 "$(cat "$longpi_home/mirobody-$name.pid")" 2>/dev/null; then
      continue
    fi
    # exec: the pid written is Mirobody's own, not a wrapper shell's
    # umask 077: the logs carry personal MCP links, so only this account may read them (0600).
    (cd "$dir"; umask 077; set -a; . "$envfile"; set +a; exec nohup "$venv/bin/mirobody" "$name" >"$longpi_home/mirobody-$name.log" 2>&1) </dev/null &
    echo $! > "$longpi_home/mirobody-$name.pid"
  done
  wait_for "$base/" 300 || fail_log "Mirobody (native) did not answer at $base within 5 minutes; see $longpi_home/mirobody-serve.log." \
                                     "Mirobody（原生）在 5 分钟内没有在 $base 响应，见 $longpi_home/mirobody-serve.log。"
}

install_analyst() {
  # The skill goes where dsh discovers skills; a checkout is kept in the LongPi home and linked.
  # Pinned to a release tag: the plugin needs the skill's la-export/1 and `la.py mirobody pull`.
  local repo="$1" home="$2" src="$longpi_home/longevity-analyst-skill" target ref="${LONGPI_ANALYST_REF:-v0.7.1}"
  if [ -d "$src/.git" ]; then
    (cd "$src" && GIT_TERMINAL_PROMPT=0 git fetch --depth 1 origin "refs/tags/$ref:refs/tags/$ref" && git checkout -q "$ref") </dev/null >>"$LOG" 2>&1 \
      || warn "Could not update $src to $ref; keeping the copy there." "无法把 $src 更新到 ${ref}，保留现有版本。"
  else
    GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$ref" "$repo" "$src" </dev/null >>"$LOG" 2>&1 || return 1
  fi
  [ -f "$src/skills/longevity-analyst/SKILL.md" ] || return 1
  mkdir -p "$home/skills"
  target="$home/skills/longevity-analyst"
  if [ -L "$target" ] || [ ! -e "$target" ]; then
    ln -sfn "$src/skills/longevity-analyst" "$target"
  else
    warn "$target exists and is not a link; left as it is." "$target 已存在且不是链接，未改动。"
  fi
  ok "$(pretty "$target") → $(pretty "$src")" "$(pretty "$target") → $(pretty "$src")"
}

install_coach() {
  # Pi's skill goes where dsh discovers skills, like the analyst: a checkout pinned to a release tag in the LongPi
  # home, linked into DSH_HOME/skills. LongPi's persona speaks as Pi either way; the skill adds the full method.
  local repo="$1" home="$2" src="$longpi_home/longevity-coach-skill" target ref="${LONGPI_COACH_REF:-v0.2.0}"
  if [ -d "$src/.git" ]; then
    (cd "$src" && GIT_TERMINAL_PROMPT=0 git fetch --depth 1 origin "refs/tags/$ref:refs/tags/$ref" && git checkout -q "$ref") </dev/null >>"$LOG" 2>&1 \
      || warn "Could not update $src to $ref; keeping the copy there." "无法把 $src 更新到 ${ref}，保留现有版本。"
  elif [ "${USE_GITHUB_MIRROR:-0}" = 1 ] && case "$repo" in *github.com[/:]*) true ;; *) false ;; esac; then
    # Mirror mode: GitHub is not reached directly, and Pi's skill is not on a mirror yet. Skipped, not fatal.
    warn "GitHub is not reachable in mirror mode, so longevity-coach was not installed; LongPi still speaks as Pi, without the full coaching method. Pass --coach-repo (or LONGPI_COACH_REPO) a git URL this machine can reach, for example a Gitee import." \
         "镜像模式下无法直接访问 GitHub，未安装 longevity-coach；LongPi 仍以 Pi 的口吻说话，只是没有完整的教练方法。可用 --coach-repo（或 LONGPI_COACH_REPO）指定这台机器能访问的 git 地址，例如导入 Gitee 后的地址。"
    return 0
  else
    GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$ref" "$repo" "$src" </dev/null >>"$LOG" 2>&1 || return 1
  fi
  [ -f "$src/skills/longevity-coach/SKILL.md" ] || return 1
  mkdir -p "$home/skills"
  target="$home/skills/longevity-coach"
  if [ -L "$target" ] || [ ! -e "$target" ]; then
    ln -sfn "$src/skills/longevity-coach" "$target"
  else
    warn "$target exists and is not a link; left as it is." "$target 已存在且不是链接，未改动。"
  fi
  ok "$(pretty "$target") → $(pretty "$src")" "$(pretty "$target") → $(pretty "$src")"
}

remove_coach() {
  # --without-coach: the link this installer made is removed (the checkout stays); anything else is left alone.
  local target="$1/skills/longevity-coach"
  if [ -L "$target" ] && case "$(readlink "$target")" in "$longpi_home/longevity-coach-skill/"*) true ;; *) false ;; esac; then
    rm -f "$target"
    ok "Pi turned off: $(pretty "$target") removed" "已关闭 Pi：已移除 $(pretty "$target")"
  fi
}

ensure_session_log_off() {
  # dsh's session-log-deepseek would attach the conversation (health and genetic data) to model requests.
  # Its own default is off; this row keeps it off whatever a profile says. A row the person wrote is kept.
  "$2" - "$1/cordis.patch.yml" <<'PY' >>"$LOG" 2>&1 || warn "Could not check the session-log setting in $1/cordis.patch.yml." "无法检查 $1/cordis.patch.yml 里的会话日志设置。"
import os, re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
if re.search(r"(?m)^\s*-\s*id:\s*['\"]?session-log-deepseek['\"]?\s*$", text):
    sys.exit(0)
block = ("# >>> dsh-plugin-longpi session log >>>\n"
         "# Health data must not be uploaded with DeepSeek session logs.\n"
         "- id: session-log-deepseek\n  config:\n    enabled: false\n"
         "# <<< dsh-plugin-longpi session log <<<\n")
os.makedirs(os.path.dirname(path), exist_ok=True)
tmp = path + ".tmp"
with open(tmp, "w", encoding="utf-8") as fh:
    fh.write((text.rstrip("\n") + "\n" if text.strip() else "") + block)
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY
}

docker_mirror_hint() {
  [ "${USE_DOCKER_MIRROR:-0}" = 1 ] || return 0
  warn "Treating Docker Hub (registry-1.docker.io) as unreachable. This installer does not rewrite the Docker daemon config." \
       "按 Docker Hub（registry-1.docker.io）不可达处理。安装程序不会改写 Docker 守护进程的配置。"
  info "Mirobody's deploy.sh pulls through the daemon and already tries docker.1ms.run when the Hub times out." \
       "Mirobody 的 deploy.sh 通过 Docker 守护进程拉镜像，Hub 超时时它自己会试 docker.1ms.run。"
  info "On Tencent Cloud the mirror that answered in the field test is https://mirror.ccs.tencentyun.com. https://docker.m.daocloud.io also answers the registry API." \
       "腾讯云上现场可用的镜像是 https://mirror.ccs.tencentyun.com。https://docker.m.daocloud.io 也能应答仓库 API。"
  info "Example /etc/docker/daemon.json: {\"registry-mirrors\":[\"https://mirror.ccs.tencentyun.com\"]} — then restart docker and rerun with --with-mirobody." \
       "可在 /etc/docker/daemon.json 写入 {\"registry-mirrors\":[\"https://mirror.ccs.tencentyun.com\"]}，重启 Docker 后再用 --with-mirobody 运行。"
}

plugin_tarball_without_library_dep() {
  local src="$1" stage packed dest
  stage="$(mktemp -d "${TMPDIR:-/tmp}/longpi-plugin.XXXXXX")"
  packed="$(mktemp -d "${TMPDIR:-/tmp}/longpi-plugin-pack.XXXXXX")"
  dest="${LONGPI_CACHE:-${TMPDIR:-/tmp}}/plugin-offline.tgz"
  mkdir -p "$(dirname "$dest")"
  extract_marked "$src" "$stage" package.json || { rm -rf "$stage" "$packed"; return 1; }
  python3 - "$stage/package.json" <<'PY' || { rm -rf "$stage" "$packed"; return 1; }
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding="utf-8"))
deps = data.get("dependencies") or {}
deps.pop("longevity-skills", None)
if deps:
    data["dependencies"] = deps
else:
    data.pop("dependencies", None)
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
PY
  mkdir -p "$packed/package"
  cp -R "$stage"/. "$packed/package"/
  tar -czf "$dest" -C "$packed" package
  rm -rf "$stage" "$packed"
  printf '%s\n' "$dest"
}

find_packaged_skills() {
  local dir
  for dir in "$@"; do
    [ -n "$dir" ] || continue
    [ -f "$dir/catalog.json" ] || continue
    [ -f "$dir/package.json" ] || continue
    if node -e 'const p=require(process.argv[1]); if(p.name!=="longevity-skills") process.exit(1)' "$dir/package.json" >/dev/null 2>&1; then
      printf '%s\n' "$dir"
      return 0
    fi
  done
  return 1
}

link_skills() {
  local src="$1" dest="$2" src_real dest_real
  [ -n "$src" ] && [ -d "$src" ] || return 1
  case "$dest" in
    "" | / | "$HOME" | "${LONGPI_HOME:-}") die "Refusing to replace $dest." "拒绝替换 ${dest}。" ;;
  esac
  src_real="$(cd "$src" && pwd -P)"
  if [ -L "$dest" ]; then
    dest_real="$(cd "$dest" && pwd -P 2>/dev/null || true)"
    if [ "$dest_real" = "$src_real" ]; then
      return 0
    fi
    rm -f "$dest"
  elif [ -d "$dest" ]; then
    dest_real="$(cd "$dest" && pwd -P)"
    if [ "$dest_real" = "$src_real" ]; then
      return 0
    fi
    if [ -d "$dest/.git" ]; then
      warn "Moving the git checkout at $dest aside so the packaged library can be used." "把 $dest 的 git 检出移到一旁，改用已打包的方法库。"
      mv "$dest" "${dest}.git-aside-$(date +%Y%m%d%H%M%S)"
    else
      rm -rf "$dest"
    fi
  fi
  ln -s "$src_real" "$dest"
}

read_pin() {
  local file pin
  for file in "$@"; do
    [ -n "$file" ] && [ -f "$file" ] || continue
    if pin="$(node -e 'const p=require(process.argv[1]); const raw=p.dependencies&&p.dependencies["longevity-skills"]; if(!raw) process.exit(2); const pin=String(raw).replace(/^[~^<>=\s]+/,"").trim(); if(!pin) process.exit(2); process.stdout.write(pin);' "$file" 2>/dev/null)"; then
      printf '%s' "$pin"
      return 0
    fi
  done
  printf '%s' "$SKILLS_PIN_DEFAULT"
}

catalog_version_of() {
  node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(p.version||"").trim());' "$1"
}

ensure_uv() {
  have uv && return 0
  local installer="${LONGPI_CACHE:-${TMPDIR:-/tmp}}/uv-install.sh"
  mkdir -p "$(dirname "$installer")"
  if ! download_file "https://astral.sh/uv/install.sh" "$installer"; then
    warn "Could not download uv; using a system Python 3.12 if one exists." "下载不了 uv，改用系统里的 Python 3.12（如果有）。"
    return 1
  fi
  if ! sh "$installer" </dev/null >>"${LOG:-/dev/null}" 2>&1; then
    warn "The uv installer failed; using a system Python 3.12 if one exists." "uv 安装失败，改用系统里的 Python 3.12（如果有）。"
    return 1
  fi
  case ":${PATH:-}:" in
    *":$HOME/.local/bin:"*) ;;
    *) export PATH="$HOME/.local/bin:$PATH" ;;
  esac
  have uv
}

run_uv_pip() {
  local py="$1"
  shift
  if [ "${USE_PYPI_MIRROR:-0}" != 1 ]; then
    uv pip install --python "$py" "$@" </dev/null >>"$LOG" 2>&1
    return
  fi
  if uv pip install --python "$py" --index-url "$PIP_INDEX_CN" "$@" </dev/null >>"$LOG" 2>&1; then
    return 0
  fi
  echo "pip index ${PIP_INDEX_CN} failed; trying ${PIP_INDEX_CN_FALLBACK}" >>"$LOG"
  warn "The pip index ${PIP_INDEX_CN} failed; trying ${PIP_INDEX_CN_FALLBACK}." \
       "pip 源 ${PIP_INDEX_CN} 失败，改试 ${PIP_INDEX_CN_FALLBACK}。"
  uv pip install --python "$py" --index-url "$PIP_INDEX_CN_FALLBACK" "$@" </dev/null >>"$LOG" 2>&1
}

install_python_requirements() {
  local py="$1" req="$2"
  if have uv; then
    run_uv_pip "$py" -r "$req" || return 1
    run_uv_pip "$py" mirobody || return 1
    return 0
  fi
  if "$py" -m pip --version </dev/null >/dev/null 2>&1; then
    if [ "${USE_PYPI_MIRROR:-0}" != 1 ]; then
      "$py" -m pip install --quiet --upgrade pip </dev/null >>"$LOG" 2>&1 || return 1
      "$py" -m pip install --quiet --upgrade -r "$req" mirobody </dev/null >>"$LOG" 2>&1 || return 1
    else
      pip_install_quiet "$py" -r "$req" mirobody </dev/null >>"$LOG" 2>&1 || return 1
    fi
    return 0
  fi
  run_uv_pip "$py" -r "$req" || return 1
  run_uv_pip "$py" mirobody || return 1
}

npm_view_field() {
  local spec="$1" field="$2"
  local cmd
  cmd=(npm view "$spec" "$field")
  if [ "${USE_NPM_MIRROR:-0}" = 1 ]; then
    cmd+=(--registry "$NPM_REGISTRY_CN")
  fi
  "${cmd[@]}" </dev/null 2>>"$LOG"
}

version_cmp() {
  node -e 'const [a,b]=process.argv.slice(1); function parse(v){const m=/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/.exec(v||""); if(!m) return null; return [Number(m[1]),Number(m[2]),Number(m[3]),m[4]||null]} const pa=parse(a), pb=parse(b); let n=0; if(!pa||!pb) n=a===b?0:(a>b?1:-1); else if(pa[0]!==pb[0]) n=pa[0]>pb[0]?1:-1; else if(pa[1]!==pb[1]) n=pa[1]>pb[1]?1:-1; else if(pa[2]!==pb[2]) n=pa[2]>pb[2]?1:-1; else if(pa[3]===pb[3]) n=0; else if(pa[3]===null) n=1; else if(pb[3]===null) n=-1; else n=pa[3]>pb[3]?1:-1; process.stdout.write(String(n))' "$1" "$2"
}

maybe_upgrade_plugin() {
  local installed="$1" current latest cmp url integrity archive spec
  PLUGIN_CHANGED=0
  [ "$COMMAND" = update ] || return 0
  [ -f "$installed/package.json" ] || return 0
  current="$(node -e 'process.stdout.write(String(require(process.argv[1]).version||""))' "$installed/package.json" 2>/dev/null || true)"
  [ -n "$current" ] || return 0
  latest="$(npm_view_field dsh-plugin-longpi version)" || {
    note "npm view dsh-plugin-longpi failed; keeping the installed plugin." "npm 查不到 dsh-plugin-longpi，保留已安装的插件。"
    return 0
  }
  latest="$(printf '%s\n' "$latest" | tail -n 1 | tr -d '[:space:]')"
  [ -n "$latest" ] || return 0
  cmp="$(version_cmp "$latest" "$current")"
  if [ "$cmp" != 1 ]; then
    info "Plugin $current is current (registry $latest)." "插件 ${current} 已是登记的版本（${latest}）。"
    return 0
  fi
  spec="dsh-plugin-longpi@${latest}"
  url="$(npm_view_field "$spec" dist.tarball)" || fail_log "Could not find a tarball for $spec." "找不到 ${spec} 的压缩包。"
  url="$(printf '%s\n' "$url" | awk '/^https?:\/\/.*\.tgz$/ { line = $0 } END { print line }')"
  [ -n "$url" ] || fail_log "No tarball URL for $spec." "没有 ${spec} 的压缩包地址。"
  integrity="$(npm_view_field "$spec" dist.integrity 2>/dev/null || true)"
  integrity="$(printf '%s\n' "$integrity" | awk '/^sha512-/ { line = $0 } END { print line }')"
  mkdir -p "$LONGPI_CACHE"
  archive="$LONGPI_CACHE/plugin-${latest}.tgz"
  download_file "$url" "$archive" || fail_log "Could not download $url." "无法下载 ${url}。"
  verify_tarball "$archive" "$url" "$integrity"
  PLUGIN_SPEC="$archive"
  PLUGIN_CHANGED=1
  note "Updating dsh-plugin-longpi $current -> $latest" "正在更新插件 ${current} -> ${latest}"
}

write_install_state() {
  python3 - "$@" <<'PY'
import json, sys
path, mirror, origin, req, spec, pin, resolved = sys.argv[1:8]
data = {
    "mirror": mirror,
    "skills_origin": origin,
    "requirements_sha256": req,
    "plugin_spec": spec,
    "skills_pin": pin,
    "skills_version": resolved,
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
PY
}

read_patch_value() {
  python3 - "$1" "$2" <<'PY'
import re, sys
path, key = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
start = text.find("# >>> dsh-plugin-longpi")
end = text.find("# <<< dsh-plugin-longpi")
block = text[start:end] if start >= 0 and end > start else text
match = re.search(r"(?m)^\s+%s:\s*(.*?)\s*$" % re.escape(key), block)
if not match:
    sys.exit(3)
raw = match.group(1).strip()
if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
    quote = raw[0]
    raw = raw[1:-1]
    if quote == "'":
        raw = raw.replace("''", "'")
sys.stdout.write(raw)
PY
}

version_check_json() {
  node -e 'const version=process.argv[1]||""; const pin=process.argv[2]||""; const clean=(v)=>String(v||"").trim().replace(/^v/,""); const want=clean(pin); const running=clean(version); const matches=want?running===want:null; const verified_allowed=matches!==false; let label="verified"; let refused=false; if(!verified_allowed){label="unverified-binding"; refused=true} const mismatch=matches===false?`running catalog ${running||"(none)"} is not the pinned ${want}; a result from this pair cannot be labelled verified`:""; const mismatch_zh=matches===false?`正在使用的方法库是 ${running||"（没有版本）"}，锁定版本是 ${want}，这次不能把结果标成已核对`:""; process.stdout.write(JSON.stringify({pinned:want,catalog:running,matches,verified_allowed,label,refused_verified:refused,mismatch,mismatch_zh}))' "$1" "$2"
}

do_status() {
  local longpi_home="$1" profile="$2" dsh_home="$3"
  local patch="$dsh_home/profiles/$profile/cordis.patch.yml"
  local state="$longpi_home/install-state.json"
  if [ ! -f "$patch" ]; then
    printf 'LongPi is not configured in %s\n' "$patch" >&2
    return 1
  fi
  local skills_home="" skills_pin="" catalog="" python="" mirror="" origin="" plugin="" plugin_json json
  skills_home="$(read_patch_value "$patch" skillsHome 2>/dev/null || true)"
  skills_pin="$(read_patch_value "$patch" skillsVersion 2>/dev/null || true)"
  python="$(read_patch_value "$patch" skillPython 2>/dev/null || true)"
  if [ -n "$skills_home" ] && [ -f "$skills_home/catalog.json" ]; then
    catalog="$(catalog_version_of "$skills_home/catalog.json")"
  fi
  if [ -z "$skills_pin" ]; then
    skills_pin="$(read_pin "${SCRIPT_DIR:-}/package.json")"
  fi
  plugin_json="$dsh_home/profiles/$profile/node_modules/dsh-plugin-longpi/package.json"
  if [ -f "$plugin_json" ]; then
    plugin="$(node -e 'process.stdout.write(String(require(process.argv[1]).version||""))' "$plugin_json" 2>/dev/null || true)"
  fi
  if [ -f "$state" ]; then
    mirror="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("mirror") or "")' "$state" 2>/dev/null || true)"
    origin="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("skills_origin") or "")' "$state" 2>/dev/null || true)"
  fi
  json="$(version_check_json "$catalog" "$skills_pin")"
  printf 'check=%s\n' "$json"
  printf 'skills_home=%s\n' "$skills_home"
  printf 'python=%s\n' "$python"
  printf 'plugin=%s\n' "$plugin"
  printf 'mirror=%s\n' "$mirror"
  printf 'origin=%s\n' "$origin"
  node -e 'const m=JSON.parse(process.argv[1]); if(m.matches===false) process.exit(2)' "$json"
}
WRITE_CONFIG='
import os, re, sys, time
argv = sys.argv[1:]
if len(argv) < 6:
    sys.exit("expected patch, skills home, python, set_mcp, mcp url, mcp token")
path, skills_home, python_bin, set_mcp, mcp_url, mcp_token = argv[:6]
skills_version = argv[6] if len(argv) > 6 else ""
mirobody_base = argv[7] if len(argv) > 7 else ""
coach_flag = argv[8] if len(argv) > 8 else ""
BEGIN = "# >>> dsh-plugin-longpi (written by install.sh; keep one value per line) >>>"
END = "# <<< dsh-plugin-longpi <<<"
KEYS = ["skillsHome", "skillsVersion", "mirobodyPluginHome", "pythonBin", "mirobodyHome", "mcpUrl", "mcpToken",
        "member", "timeoutMs", "skillPython", "skillTimeoutMs", "skillRuntimes", "dataDir", "maxSkillMatches", "bootstrapWorkspace",
        "mirobodyUrl", "coach"]
DEFAULTS = {"skillsVersion": "\x27\x27", "mirobodyHome": "\x27\x27", "mcpUrl": "\x27\x27", "mcpToken": "\x27\x27",
            "member": "\x27\x27", "timeoutMs": "30000", "skillTimeoutMs": "120000", "skillRuntimes": "{}",
            "dataDir": "\x27\x27", "maxSkillMatches": "8", "bootstrapWorkspace": "true",
            "mirobodyUrl": "\x27http://127.0.0.1:18060\x27", "coach": "true"}

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
if skills_version:
    values["skillsVersion"] = quote(skills_version)
values["mirobodyPluginHome"] = "\x27\x27"
if coach_flag in ("0", "1"):
    values["coach"] = "true" if coach_flag == "1" else "false"
if set_mcp == "1":
    values["mcpUrl"] = quote(mcp_url)
    values["mcpToken"] = quote(mcp_token)

# With a Mirobody this installer runs on this computer, LongPi pairs an account of its own with it, at that address.
# A link left by an older installer for that Mirobody without a token (the demo account, before 0.8.0) is dropped,
# so the pairing can happen; a link the person passed with --mcp-url this time is kept.
def host_of(url):
    match = re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)", url.strip())
    return match.group(1).lower() if match else ""

if mirobody_base:
    values["mirobodyUrl"] = quote(mirobody_base)
    if set_mcp != "1":
        old_url, old_token = unquote(values["mcpUrl"]), unquote(values["mcpToken"])
        if old_url and not old_token and host_of(old_url) == host_of(mirobody_base):
            values["mcpUrl"] = "\x27\x27"

# The LongPi block holds the LongPi row only. Up to 0.7.0 it also disabled the DeepSeek Harness wordmark row
# (ui-brand-official); rewriting the block whole, as below, removes that line from an older install.
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
KEEP = 3
backed = ""
if new_text != text:
    if text:
        # The backup can hold the MCP address and token: 0600 like the live file, created, never truncated.
        backed = path + ".bak-" + time.strftime("%Y%m%d%H%M%S")
        fd = os.open(backed, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as backup:
            backup.write(text)
        os.chmod(backed, 0o600)
    tmp = path + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        out.write(new_text)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
# Keep the newest backups only, and only ever remove files named the way this installer names them.
folder, base = os.path.split(path)
own = re.compile("^" + re.escape(base) + r"\.bak-\d{14}$")
backups = sorted(name for name in os.listdir(folder or ".") if own.match(name))
for name in backups[:-KEEP]:
    os.remove(os.path.join(folder, name))
for name in backups[-KEEP:]:
    os.chmod(os.path.join(folder, name), 0o600)
print("backups=%d %d" % (min(len(backups), KEEP), max(0, len(backups) - KEEP)))
url = unquote(values["mcpUrl"])
if url:
    shown = re.sub(r"(/mcp/)[^/?#]+", r"\1…", url)
    print("mcp=configured " + shown)
else:
    print("mcp=none")
'

main "$@"
