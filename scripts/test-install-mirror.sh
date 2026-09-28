#!/usr/bin/env bash
# Fake-network harness for install.sh --mirror.
#
# PATH shims stand in for curl, git, npm, python, dsh, pnpm and docker.
# Blocked hosts time out the way a mainland link to GitHub, npmjs, PyPI or
# Docker Hub does. Nothing here touches a real registry or a real DSH profile.
#
#   bash scripts/test-install-mirror.sh
#   SKIP_LIVE=1 bash scripts/test-install-mirror.sh
#
# Bash 3.2 (the macOS /bin/bash) is the shell under test.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$ROOT/install.sh"
ORIGINAL_PATH="$PATH"
NODE_BIN="$(command -v node)"
NODE_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd)"

PASS=0

fail() {
  printf 'FAIL %s: %s\n' "${CASE:-setup}" "$*" >&2
  if [ -n "${OUT:-}" ] && [ -f "$OUT" ]; then
    printf '%s\n' '--- stdout ---' >&2
    cat "$OUT" >&2
  fi
  if [ -n "${ERR:-}" ] && [ -f "$ERR" ]; then
    printf '%s\n' '--- stderr ---' >&2
    cat "$ERR" >&2
  fi
  if [ -n "${TRACE:-}" ] && [ -f "$TRACE" ]; then
    printf '%s\n' '--- trace ---' >&2
    cat "$TRACE" >&2
  fi
  exit 1
}

need() {
  local file="$1" text="$2"
  grep -F -q -- "$text" "$file" || fail "missing [$text] in $(basename "$file")"
}

forbid() {
  local file="$1" text="$2"
  if grep -F -q -- "$text" "$file"; then
    fail "forbidden [$text] in $(basename "$file")"
  fi
}

# Build shims once. Each case points LONGPI_* at its own fixtures.
SHIM_SRC="$(mktemp -d "${TMPDIR:-/tmp}/longpi-shimsrc.XXXXXX")"

cat >"$SHIM_SRC/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >>"$LONGPI_FAKE_LOG"
url=""
out=""
prev=""
for a in "$@"; do
  case "$prev" in
    -o) out="$a"; prev=""; continue ;;
  esac
  case "$a" in
    -o) prev="-o"; continue ;;
    http://*|https://*) url="$a" ;;
  esac
done
host="${url#*://}"
host="${host%%/*}"
host="${host%%:*}"
blocked=0
case " ${LONGPI_BLOCK:-} " in
  *" ${host} "*) blocked=1 ;;
esac
echo "CURL host=${host} blocked=${blocked}" >>"$LONGPI_FAKE_LOG"
if [ "$blocked" = 1 ]; then
  case " $* " in
    *" %{http_code} "*) printf '000' ;;
  esac
  exit 28
fi
if [ "$host" = "127.0.0.1" ] || [ "$host" = "localhost" ]; then
  # deploy.sh touches LONGPI_FAKE_UP; after that the record server "answers".
  case "$url" in
    *18060*)
      if [ -n "${LONGPI_FAKE_UP:-}" ] && [ -f "$LONGPI_FAKE_UP" ]; then
        case "$url" in
          */email/verify) printf '%s' '{"data":{"access_token":"jwt"}}' ;;
          */personal/mcp) printf '%s' '{"data":{"url":"http://127.0.0.1:18060/mcp/secret"}}' ;;
        esac
        case " $* " in
          *" %{http_code} "*) printf '200' ;;
        esac
        exit 0
      fi
      ;;
  esac
  case " $* " in
    *" %{http_code} "*) printf '000' ;;
  esac
  exit 28
fi
# Probes and reachable() pass -o /dev/null. That is not a file we have to fill.
if [ -n "$out" ] && [ "$out" != "/dev/null" ]; then
  file=""
  if [ -n "${LONGPI_URL_MAP:-}" ] && [ -f "$LONGPI_URL_MAP" ]; then
    file="$(awk -F '\t' -v u="$url" '$1 == u { print $2; exit }' "$LONGPI_URL_MAP")"
  fi
  if [ -z "$file" ] || [ ! -f "$file" ]; then
    echo "CURL no-fixture ${url}" >>"$LONGPI_FAKE_LOG"
    exit 22
  fi
  cp "$file" "$out"
fi
case " $* " in
  *" %{http_code} "*) printf '200' ;;
esac
exit 0
EOF

cat >"$SHIM_SRC/git" <<'EOF'
#!/usr/bin/env bash
echo "git $*" >>"$LONGPI_FAKE_LOG"
if [ "$1" = "-C" ]; then
  exit 0
fi
if [ "$1" = "lfs" ]; then
  if [ "${LONGPI_NO_LFS:-}" = 1 ]; then
    exit 1
  fi
  if [ "$2" = "version" ]; then
    echo "git-lfs/3.4.0"
    exit 0
  fi
  case " ${LONGPI_BLOCK:-} " in
    *" github.com "*) exit 1 ;;
  esac
  if [ "$2" = "pull" ]; then
    bundle="$(pwd)/mirobody/res/fhir_loinc_bundle.tar.gz"
    if [ -f "$bundle" ]; then
      printf 'real-loinc-from-lfs\n' >"$bundle"
    fi
  fi
  exit 0
fi
if [ "$1" != "clone" ]; then
  exit 0
fi
url=""
dest=""
prev=""
skip=1
for a in "$@"; do
  if [ "$skip" = 1 ]; then
    skip=0
    continue
  fi
  case "$prev" in
    --depth) prev=""; continue ;;
  esac
  case "$a" in
    --depth) prev="--depth"; continue ;;
    --*) continue ;;
    *)
      if [ -z "$url" ]; then url="$a"; else dest="$a"; fi
      ;;
  esac
done
host="${url#*://}"
host="${host%%/*}"
case " ${LONGPI_BLOCK:-} " in
  *" ${host} "*)
    echo "GIT blocked ${host}" >>"$LONGPI_FAKE_LOG"
    exit 128
    ;;
esac
mkdir -p "$dest"
case "$url" in
  *longevity-skills*)
    printf '%s\n' '{"skills":[{"id":"fake"}],"version":"git"}' >"$dest/catalog.json"
    ;;
  *mirobody*)
    mkdir -p "$dest/mirobody/res"
    printf '%s\n' 'version https://git-lfs.github.com/spec/v1' 'oid sha256:abc' 'size 1' \
      >"$dest/mirobody/res/fhir_loinc_bundle.tar.gz"
    cat >"$dest/deploy.sh" <<'EOS'
#!/usr/bin/env bash
echo "deploy $*" >>"$LONGPI_FAKE_LOG"
if [ -n "${LONGPI_FAKE_UP:-}" ]; then
  touch "$LONGPI_FAKE_UP"
fi
exit 0
EOS
    chmod +x "$dest/deploy.sh"
    ;;
esac
mkdir -p "$dest/.git"
exit 0
EOF

cat >"$SHIM_SRC/npm" <<'EOF'
#!/usr/bin/env bash
echo "npm $*" >>"$LONGPI_FAKE_LOG"
sub=""
for a in "$@"; do
  case "$a" in
    prefix|install|view|pack) sub="$a"; break ;;
  esac
done
case "$sub" in
  prefix)
    printf '%s\n' "$LONGPI_NPM_PREFIX"
    exit 0
    ;;
  install)
    mkdir -p "$LONGPI_NPM_PREFIX/bin"
    case " $* " in
      *pnpm@10*)
        cp "$LONGPI_SHIMDIR/pnpm" "$LONGPI_NPM_PREFIX/bin/pnpm"
        chmod +x "$LONGPI_NPM_PREFIX/bin/pnpm"
        ;;
    esac
    case " $* " in
      *"@deepseek-ai/dsh"*)
        cp "$LONGPI_SHIMDIR/dsh" "$LONGPI_NPM_PREFIX/bin/dsh"
        chmod +x "$LONGPI_NPM_PREFIX/bin/dsh"
        ;;
    esac
    exit 0
    ;;
  view)
    name=""
    seen=0
    for a in "$@"; do
      if [ "$seen" = 1 ]; then
        name="$a"
        break
      fi
      [ "$a" = "view" ] && seen=1
    done
    if [ "$name" = "dsh-plugin-longpi" ] && [ -n "${LONGPI_NPM_TARBALL:-}" ]; then
      printf '%s\n' "$LONGPI_NPM_TARBALL"
      exit 0
    fi
    if [ "$name" = "longevity-skills" ] && [ -n "${LONGPI_SKILLS_TARBALL:-}" ]; then
      printf '%s\n' "$LONGPI_SKILLS_TARBALL"
      exit 0
    fi
    echo "npm error 404 '$name' is not in this registry" >&2
    exit 1
    ;;
  pack)
    name="dsh-plugin-longpi-0.5.2.tgz"
    tar -czf "$name" package.json
    printf '%s\n' "$name"
    exit 0
    ;;
esac
echo "npm shim: unhandled $*" >&2
exit 1
EOF

cat >"$SHIM_SRC/python3.12" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "-m" ] && [ "${2:-}" = "venv" ]; then
  dest="$3"
  mkdir -p "$dest/bin"
  cp "$0" "$dest/bin/python"
  chmod +x "$dest/bin/python"
  exit 0
fi
if [ "${1:-}" = "-m" ] && [ "${2:-}" = "pip" ]; then
  echo "pip $*" >>"$LONGPI_FAKE_LOG"
  if [ "${3:-}" = "--version" ]; then
    echo "pip 24.0"
    exit 0
  fi
  if [ -n "${LONGPI_PIP_FAIL:-}" ]; then
    case " $* " in
      *" ${LONGPI_PIP_FAIL} "*) exit 1 ;;
    esac
  fi
  exit 0
fi
if [ "${1:-}" = "-c" ]; then
  case "$2" in
    *sys.version_info*) exit 0 ;;
    *mirobody.__version__*) printf '1.5.0\n'; exit 0 ;;
    *fhir_loinc_bundle.tar.gz*)
      if [ -n "${LONGPI_WHEEL_BUNDLE:-}" ]; then
        printf '%s\n' "$LONGPI_WHEEL_BUNDLE"
      fi
      exit 0
      ;;
  esac
  exec /usr/bin/python3 "$@"
fi
echo "python shim: unhandled $*" >&2
exit 1
EOF

cat >"$SHIM_SRC/dsh" <<'EOF'
#!/usr/bin/env bash
echo "dsh $*" >>"$LONGPI_FAKE_LOG"
if [ "${1:-}" = "--version" ] || [ "${1:-}" = "-V" ]; then
  echo "0.1.5-rc.3"
  exit 0
fi
if [ "${1:-}" = "plugin" ]; then
  profile="web"
  spec=""
  prev=""
  for a in "$@"; do
    case "$prev" in
      --profile) profile="$a"; prev=""; continue ;;
    esac
    case "$a" in
      --profile) prev="--profile"; continue ;;
      add) prev="add"; continue ;;
    esac
    if [ "$prev" = "add" ]; then
      spec="$a"
      prev=""
    fi
  done
  root="${DSH_HOME:-$HOME/.dsh}/profiles/${profile}/node_modules/dsh-plugin-longpi"
  mkdir -p "$root/lib" "$root/vendor/dsh-plugin-mirobody/bridge"
  printf '%s\n' '{"version":"0.5.2"}' >"$root/package.json"
  printf '%s\n' 'ok' >"$root/lib/index.js"
  printf '%s\n' 'ok' >"$root/vendor/dsh-plugin-mirobody/bridge/dsh_bridge.py"
  exit 0
fi
if [ "${1:-}" = "--profile" ]; then
  echo "== dsh-plugin-longpi, patched by test"
  exit 0
fi
exit 0
EOF

cat >"$SHIM_SRC/pnpm" <<'EOF'
#!/usr/bin/env bash
echo "pnpm $*" >>"$LONGPI_FAKE_LOG"
if [ "${1:-}" = "--version" ] || [ "${1:-}" = "-v" ]; then
  echo "10.0.0"
  exit 0
fi
exit 0
EOF

cat >"$SHIM_SRC/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >>"$LONGPI_FAKE_LOG"
exit 0
EOF

chmod +x "$SHIM_SRC"/*

make_tarball() {
  local dest="$1" root="$2"
  local tmp
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/$root"
  shift 2
  while [ $# -gt 0 ]; do
    printf '%s' "$2" >"$tmp/$root/$1"
    shift 2
  done
  tar -czf "$dest" -C "$tmp" "$root"
  rm -rf "$tmp"
}

# run_case NAME [installer args...]
# Honour env already set by the caller: LONGPI_BLOCK, LONGPI_NPM_TARBALL,
# LONGPI_SKILLS_TARBALL, LONGPI_URL_MAP, LONGPI_NO_LFS, LONGPI_WHEEL_BUNDLE,
# LONGPI_PIP_FAIL, LONGPI_PLUGIN_URL, LONGPI_SKILLS_URL, LONGPI_MIROBODY_SOURCE,
# LONGPI_GITHUB_MIRROR, HIDE_TOOLS=1.
run_case() {
  CASE="$1"
  shift
  local base shim
  base="$(mktemp -d "${TMPDIR:-/tmp}/longpi-case.XXXXXX")"
  shim="$base/shim"
  mkdir -p "$shim" "$base/home" "$base/prefix/bin"
  cp "$SHIM_SRC/curl" "$SHIM_SRC/git" "$SHIM_SRC/npm" "$SHIM_SRC/python3.12" "$SHIM_SRC/docker" "$shim/"
  if [ "${HIDE_TOOLS:-}" != 1 ]; then
    cp "$SHIM_SRC/pnpm" "$SHIM_SRC/dsh" "$shim/"
  fi
  chmod +x "$shim"/*
  TRACE="$base/trace.log"
  OUT="$base/out"
  ERR="$base/err"
  : >"$TRACE"
  export LONGPI_FAKE_LOG="$TRACE"
  export LONGPI_FAKE_UP="$base/mirobody-up"
  rm -f "$LONGPI_FAKE_UP"
  export LONGPI_NPM_PREFIX="$base/prefix"
  export LONGPI_SHIMDIR="$SHIM_SRC"
  export HOME="$base/home"
  export DSH_HOME="$base/home/.dsh"
  export LONGPI_HOME="$base/longpi"
  export PATH="$shim:/usr/bin:/bin:/usr/sbin:/sbin:$NODE_DIR"
  # A caller-supplied map or tarball env is already exported.
  set +e
  /bin/bash "$INSTALL" --home "$LONGPI_HOME" "$@" >"$OUT" 2>"$ERR"
  local code=$?
  set -e
  if [ "${EXPECT_FAIL:-}" = 1 ]; then
    unset EXPECT_FAIL
    if [ "$code" = 0 ]; then
      fail "install.sh should have refused a bad sha256"
    fi
    if ! grep -q 'sha256' "$ERR" "$OUT"; then
      fail "the refusal did not mention sha256"
    fi
    printf 'ok %s\n' "$CASE"
    PASS=$((PASS + 1))
    return 0
  fi
  if [ "$code" != 0 ]; then
    fail "install.sh exited $code"
  fi
  CAT="$LONGPI_HOME/longevity-skills/catalog.json"
  [ -f "$CAT" ] || fail "catalog.json was not installed"
  printf 'ok %s\n' "$CASE"
  PASS=$((PASS + 1))
}

bash -n "$INSTALL" || fail "bash -n install.sh"
HELP_OUT="$(mktemp)"
/bin/bash "$INSTALL" --help >"$HELP_OUT"
need "$HELP_OUT" "--mirror"
need "$HELP_OUT" "LONGPI_PLUGIN_URL"
need "$HELP_OUT" "LONGPI_PLUGIN_SHA256"
need "$HELP_OUT" "LONGPI_LOINC_URL"
printf 'ok help\n'
PASS=$((PASS + 1))

# --- fixtures --------------------------------------------------------------
FIX="$(mktemp -d "${TMPDIR:-/tmp}/longpi-fix.XXXXXX")"
make_tarball "$FIX/skills-npm.tgz" package catalog.json '{"skills":[{"id":"from-npm"}],"version":"npm"}'
python3 - <<PY
import os, tarfile
root = "$FIX"
plugin = os.path.join(root, "plugin-npm.tgz")
tmp = os.path.join(root, "pkg")
os.makedirs(os.path.join(tmp, "package", "lib"))
open(os.path.join(tmp, "package", "package.json"), "w").write('{"name":"dsh-plugin-longpi","version":"0.5.2"}\n')
open(os.path.join(tmp, "package", "lib", "index.js"), "w").write("ok\n")
with tarfile.open(plugin, "w:gz") as tf:
    tf.add(os.path.join(tmp, "package"), arcname="package")
skills = os.path.join(root, "skills-git.tgz")
sdir = os.path.join(root, "longevity-skills-main")
os.makedirs(sdir)
open(os.path.join(sdir, "catalog.json"), "w").write('{"skills":[{"id":"from-proxy"}],"version":"proxy"}\n')
with tarfile.open(skills, "w:gz") as tf:
    tf.add(sdir, arcname="longevity-skills-main")
pdir = os.path.join(root, "dsh-plugin-longpi-main")
os.makedirs(pdir)
open(os.path.join(pdir, "package.json"), "w").write('{"name":"dsh-plugin-longpi","version":"0.5.2"}\n')
with tarfile.open(os.path.join(root, "plugin-git.tgz"), "w:gz") as tf:
    tf.add(pdir, arcname="dsh-plugin-longpi-main")
PY

SKILLS_URL="https://registry.npmmirror.com/longevity-skills/-/longevity-skills-2026.39.0.tgz"
PLUGIN_URL="https://registry.npmmirror.com/dsh-plugin-longpi/-/dsh-plugin-longpi-0.5.2.tgz"
PROXY_SKILLS="https://mirror.test/https://github.com/zwbao/longevity-skills/archive/refs/heads/main.tar.gz"
PROXY_PLUGIN="https://mirror.test/https://github.com/zwbao/dsh-plugin-longpi/archive/refs/heads/main.tar.gz"

MAP_NPM="$FIX/map-npm.tsv"
printf '%s\t%s\n' "$SKILLS_URL" "$FIX/skills-npm.tgz" >"$MAP_NPM"
printf '%s\t%s\n' "$PLUGIN_URL" "$FIX/plugin-npm.tgz" >>"$MAP_NPM"

MAP_PROXY="$FIX/map-proxy.tsv"
printf '%s\t%s\n' "$PROXY_SKILLS" "$FIX/skills-git.tgz" >"$MAP_PROXY"
printf '%s\t%s\n' "$PROXY_PLUGIN" "$FIX/plugin-git.tgz" >>"$MAP_PROXY"

LOCAL_SKILLS="$FIX/local-skills"
mkdir -p "$LOCAL_SKILLS"
printf '%s\n' '{"skills":[{"id":"local"}],"version":"local"}' >"$LOCAL_SKILLS/catalog.json"
LOCAL_PLUGIN="$FIX/local-plugin.tgz"
cp "$FIX/plugin-npm.tgz" "$LOCAL_PLUGIN"

MIRO_SRC="$FIX/mirobody-src"
mkdir -p "$MIRO_SRC/mirobody/res"
printf '%s\n' 'version https://git-lfs.github.com/spec/v1' 'oid sha256:abc' 'size 1' \
  >"$MIRO_SRC/mirobody/res/fhir_loinc_bundle.tar.gz"
cat >"$MIRO_SRC/deploy.sh" <<'EOS'
#!/usr/bin/env bash
echo "deploy $*" >>"$LONGPI_FAKE_LOG"
if [ -n "${LONGPI_FAKE_UP:-}" ]; then
  touch "$LONGPI_FAKE_UP"
fi
exit 0
EOS
chmod +x "$MIRO_SRC/deploy.sh"
WHEEL="$FIX/wheel-loinc.tar.gz"
printf 'REAL_WHEEL_LOINC\n' >"$WHEEL"

# --- 1. default: public hosts, no probes, no mirror flags -------------------
PLUGIN_SHA="$(shasum -a 256 "$FIX/plugin-npm.tgz" | awk '{ print $1 }')"
SKILLS_SHA="$(shasum -a 256 "$FIX/skills-npm.tgz" | awk '{ print $1 }')"
PLUGIN_GIT_SHA="$(shasum -a 256 "$FIX/plugin-git.tgz" | awk '{ print $1 }')"
SKILLS_GIT_SHA="$(shasum -a 256 "$FIX/skills-git.tgz" | awk '{ print $1 }')"

unset LONGPI_MIRROR LONGPI_BLOCK LONGPI_NPM_TARBALL LONGPI_SKILLS_TARBALL LONGPI_URL_MAP \
  LONGPI_NO_LFS LONGPI_WHEEL_BUNDLE LONGPI_PIP_FAIL LONGPI_PLUGIN_URL LONGPI_SKILLS_URL \
  LONGPI_MIROBODY_SOURCE LONGPI_GITHUB_MIRROR LONGPI_LOINC_URL \
  LONGPI_PLUGIN_SHA256 LONGPI_SKILLS_SHA256 || true
HIDE_TOOLS=1
run_case default
need "$TRACE" "git clone --quiet https://github.com/zwbao/longevity-skills.git"
need "$TRACE" "dsh plugin --profile web add github:zwbao/dsh-plugin-longpi"
need "$TRACE" "npm install -g --no-fund --no-audit --loglevel=error pnpm@10"
forbid "$TRACE" "--registry"
forbid "$TRACE" "registry.npmmirror.com"
forbid "$TRACE" "mirrors.cloud.tencent.com"
forbid "$TRACE" "registry-1.docker.io"
forbid "$OUT" "Mirrors"
need "$TRACE" "pip -m pip install --quiet --upgrade mirobody numpy scipy openpyxl"
forbid "$TRACE" " -i "

# --- 2. --mirror cn via npm tarballs on npmmirror ---------------------------
export LONGPI_BLOCK="github.com registry.npmjs.org pypi.org registry-1.docker.io"
export LONGPI_NPM_TARBALL="$PLUGIN_URL"
export LONGPI_SKILLS_TARBALL="$SKILLS_URL"
export LONGPI_URL_MAP="$MAP_NPM"
export LONGPI_PLUGIN_SHA256="$PLUGIN_SHA"
export LONGPI_SKILLS_SHA256="$SKILLS_SHA"
HIDE_TOOLS=1
run_case cn-npm --mirror cn
need "$OUT" "npm=1 pypi=1 github=1 docker=1"
need "$TRACE" "npm view longevity-skills dist.tarball --registry https://registry.npmmirror.com"
need "$TRACE" "npm view dsh-plugin-longpi dist.tarball --registry https://registry.npmmirror.com"
need "$TRACE" "--registry https://registry.npmmirror.com"
need "$TRACE" "pip -m pip install --quiet --upgrade -i https://mirrors.cloud.tencent.com/pypi/simple --trusted-host mirrors.cloud.tencent.com mirobody numpy scipy openpyxl"
need "$TRACE" "dsh plugin --profile web add "
need "$LONGPI_HOME/longevity-skills/catalog.json" "from-npm"
# The added spec is the downloaded tarball, not a github: spec.
need "$TRACE" "plugin-download.tgz"
forbid "$TRACE" "git clone"
forbid "$TRACE" "CURL host=github.com"
forbid "$TRACE" "CURL host=registry.npmjs.org"
forbid "$TRACE" "CURL host=pypi.org"
forbid "$TRACE" "CURL host=registry-1.docker.io"
forbid "$TRACE" "add github:"

# --- 3. --mirror auto, official hosts down: same mirrors, probes first ------
run_case auto-blocked --mirror auto
need "$TRACE" "CURL host=github.com blocked=1"
need "$TRACE" "CURL host=registry.npmjs.org blocked=1"
need "$TRACE" "CURL host=pypi.org blocked=1"
need "$TRACE" "CURL host=registry-1.docker.io blocked=1"
need "$OUT" "npm=1 pypi=1 github=1 docker=1"
forbid "$TRACE" "git clone"
need "$TRACE" "registry.npmmirror.com"
need "$LONGPI_HOME/longevity-skills/catalog.json" "from-npm"

# --- 4. --mirror auto, every host answers: identical to the default path ----
unset LONGPI_BLOCK
HIDE_TOOLS=1
run_case auto-open --mirror auto
need "$TRACE" "CURL host=github.com blocked=0"
need "$TRACE" "CURL host=registry.npmjs.org blocked=0"
need "$TRACE" "CURL host=pypi.org blocked=0"
need "$TRACE" "CURL host=registry-1.docker.io blocked=0"
need "$TRACE" "git clone --quiet https://github.com/zwbao/longevity-skills.git"
need "$TRACE" "dsh plugin --profile web add github:zwbao/dsh-plugin-longpi"
forbid "$TRACE" "registry.npmmirror.com"
forbid "$TRACE" "mirrors.cloud.tencent.com"
forbid "$OUT" "Mirrors"
need "$TRACE" "pip -m pip install --quiet --upgrade mirobody numpy scipy openpyxl"
forbid "$TRACE" " -i "

# --- 5. npm 404, then a configurable GitHub archive proxy -------------------
unset LONGPI_NPM_TARBALL LONGPI_SKILLS_TARBALL
export LONGPI_BLOCK="github.com registry.npmjs.org pypi.org registry-1.docker.io"
export LONGPI_GITHUB_MIRROR="https://mirror.test/https://github.com"
export LONGPI_URL_MAP="$MAP_PROXY"
export LONGPI_PLUGIN_SHA256="$PLUGIN_GIT_SHA"
export LONGPI_SKILLS_SHA256="$SKILLS_GIT_SHA"
HIDE_TOOLS=
run_case cn-proxy --mirror cn
need "$LONGPI_HOME/install.log" "404"
need "$ERR" "${PROXY_SKILLS}"
need "$ERR" "${PROXY_PLUGIN}"
need "$LONGPI_HOME/longevity-skills/catalog.json" "from-proxy"
need "$TRACE" "dsh-plugin-longpi-0.5.2.tgz"
need "$TRACE" "npm pack --ignore-scripts"
forbid "$TRACE" "git clone"
forbid "$TRACE" "CURL host=github.com"

export LONGPI_PLUGIN_SHA256="0000000000000000000000000000000000000000000000000000000000000000"
EXPECT_FAIL=1
run_case cn-proxy-badsha --mirror cn
export LONGPI_PLUGIN_SHA256="$PLUGIN_GIT_SHA"

# --- 6. operator-supplied local URLs (Gitee import, internal tarball, ...) --
unset LONGPI_GITHUB_MIRROR LONGPI_URL_MAP
export LONGPI_SKILLS_URL="$LOCAL_SKILLS"
export LONGPI_PLUGIN_URL="$LOCAL_PLUGIN"
HIDE_TOOLS=
run_case cn-local --mirror cn
need "$LONGPI_HOME/longevity-skills/catalog.json" '"id":"local"'
need "$TRACE" "dsh plugin --profile web add ${LOCAL_PLUGIN}"
forbid "$TRACE" "npm view"
forbid "$TRACE" "git clone"
forbid "$TRACE" "ghfast.top"

# --- 7. Tencent pip fails, Aliyun is the fallback ---------------------------
export LONGPI_PIP_FAIL="https://mirrors.cloud.tencent.com/pypi/simple"
run_case cn-pip-fallback --mirror cn
need "$TRACE" "https://mirrors.cloud.tencent.com/pypi/simple"
need "$TRACE" "https://mirrors.aliyun.com/pypi/simple"
need "$LONGPI_HOME/install.log" "trying https://mirrors.aliyun.com/pypi/simple"
unset LONGPI_PIP_FAIL

# --- 8. --with-mirobody, default: git clone + git lfs, no docker hint -------
unset LONGPI_BLOCK LONGPI_SKILLS_URL LONGPI_PLUGIN_URL LONGPI_MIROBODY_SOURCE LONGPI_NO_LFS LONGPI_WHEEL_BUNDLE
HIDE_TOOLS=
run_case default-mirobody --with-mirobody
need "$TRACE" "git clone --quiet --depth 1 https://github.com/thetahealth/mirobody.git"
need "$TRACE" "git lfs pull"
need "$LONGPI_HOME/mirobody/mirobody/res/fhir_loinc_bundle.tar.gz" "real-loinc-from-lfs"
need "$TRACE" "deploy "
forbid "$OUT" "registry-mirrors"
forbid "$OUT" "mirror.ccs.tencentyun.com"
forbid "$TRACE" " -i "

# --- 9. git-lfs missing: copy the bundle out of the mirobody wheel ----------
export LONGPI_BLOCK="github.com registry.npmjs.org pypi.org registry-1.docker.io"
export LONGPI_SKILLS_URL="$LOCAL_SKILLS"
export LONGPI_PLUGIN_URL="$LOCAL_PLUGIN"
export LONGPI_MIROBODY_SOURCE="$MIRO_SRC"
export LONGPI_NO_LFS=1
export LONGPI_WHEEL_BUNDLE="$WHEEL"
run_case cn-loinc --mirror cn --with-mirobody
need "$LONGPI_HOME/mirobody/mirobody/res/fhir_loinc_bundle.tar.gz" "REAL_WHEEL_LOINC"
forbid "$LONGPI_HOME/mirobody/mirobody/res/fhir_loinc_bundle.tar.gz" "version https://git-lfs"
need "$OUT" "mirror.ccs.tencentyun.com"
need "$OUT" "docker.1ms.run"
need "$OUT" "registry-mirrors"
need "$TRACE" "deploy "
need "$TRACE" "docker info"
forbid "$TRACE" "git clone"
forbid "$TRACE" "git lfs pull"

# --- 10. a bad mode is rejected before any install --------------------------
CASE="bad-mirror"
set +e
BAD_OUT="$(mktemp)"
/bin/bash "$INSTALL" --mirror somewhere --home "$(mktemp -d)" >"$BAD_OUT" 2>&1
bad_code=$?
set -e
[ "$bad_code" != 0 ] || fail "--mirror somewhere should fail"
grep -E -q 'cn or auto|cn 或 auto' "$BAD_OUT" || fail "bad mirror message was: $(cat "$BAD_OUT")"
printf 'ok bad-mirror\n'
PASS=$((PASS + 1))

echo "fake-network: ${PASS} cases passed"
export PATH="$ORIGINAL_PATH"

# --- live: the URLs the script really calls, from this machine --------------
if [ "${SKIP_LIVE:-}" = 1 ]; then
  echo "live skipped"
  exit 0
fi

live_code() {
  local url="$1" code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 5 "$url" 2>/dev/null)" || code=000
  printf '%s %s\n' "$code" "$url"
}

echo "live probes (same timeouts as --mirror auto):"
live_code "https://github.com/"
live_code "https://registry.npmjs.org/"
live_code "https://pypi.org/simple/pip/"
live_code "https://registry-1.docker.io/v2/"
live_code "https://registry.npmmirror.com/@deepseek-ai/dsh"
live_code "https://mirrors.cloud.tencent.com/pypi/simple/mirobody/"
live_code "https://mirrors.aliyun.com/pypi/simple/mirobody/"

CASE="live"
OUT=""
ERR=""
TRACE=""
LIVE_TGZ="$(mktemp)"
curl -fsSL --retry 2 --connect-timeout 5 --max-time 90 -o "$LIVE_TGZ" \
  "https://ghfast.top/https://github.com/zwbao/dsh-plugin-longpi/archive/refs/heads/main.tar.gz"
# pipefail would turn tar's SIGPIPE (grep -q exits early) into a false failure.
set +o pipefail
if ! tar -tzf "$LIVE_TGZ" | grep -q 'package.json'; then
  file "$LIVE_TGZ" >&2 || true
  fail "ghfast archive has no package.json"
fi
set -o pipefail
echo "live ghfast plugin archive ok ($(wc -c <"$LIVE_TGZ" | tr -d ' ') bytes)"
rm -f "$LIVE_TGZ"

# npmmirror really does not have these packages yet. The installer must keep
# going to the archive proxy; this pins that fact so the docs stay honest.
if npm view dsh-plugin-longpi version --registry https://registry.npmmirror.com >/dev/null 2>&1; then
  echo "live note: dsh-plugin-longpi is now on npmmirror; the tarball path will be taken first"
else
  echo "live note: dsh-plugin-longpi is not on npmmirror (404), archive proxy is the automatic fallback"
fi
if npm view longevity-skills version --registry https://registry.npmmirror.com >/dev/null 2>&1; then
  echo "live note: longevity-skills is now on npmmirror"
else
  echo "live note: longevity-skills is not on npmmirror (404)"
fi

echo "all checks passed"
