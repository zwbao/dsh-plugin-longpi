# awesome-dsh-plugin 投稿文件（待提交）

这一步是当前性价比最高的动作：仓库**目前根本不在 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 目录里**（`data/plugins/` 下没有 `zwbao__*` 条目），等于零曝光。

## 怎么提

列表数据源在 `data/plugins/`，一个插件一个 YAML 文件，README 由脚本生成。所以投稿 = **只加一个文件**：

1. fork `awesome-dsh-plugin/awesome-dsh-plugin`
2. 新建 `data/plugins/zwbao__dsh-plugin-longpi.yml`，内容就是下面的代码块（逐字复制）
3. 开 PR，标题例如 `Add dsh-plugin-longpi (longevity concierge)`

不要手工改 README——CI 会在 main 上重新生成。

## 文件内容

```yaml
url: https://github.com/zwbao/dsh-plugin-longpi
name: zwbao/dsh-plugin-longpi
category: tools
description:
  en: 'Longevity concierge: a biological-age dashboard whose PhenoAge (Levine 2018) result is recomputable from the repo and pinned by a golden test, nine blood markers, a 12-locus genome panel with VCF ingest, five omics layers, and s2f-agent routing that hands GPU work off instead of running it.'
  zh: '长寿管家：生物年龄看板，其 PhenoAge（Levine 2018）结果可从仓库复算并由黄金测试锁死；含九项血液标志物、12 位点基因组面板与 VCF 摄入、五层组学，以及把 GPU 计算交出去的 s2f-agent 路由。'
```

## 自查（对照 `contributing.md`）

| 要求 | 状态 |
|---|---|
| `package.json` 声明 `dsh.bundle` | ✅ |
| 仓库根有 `cordis.patch.yml` | ✅ |
| 可用 `dsh plugin add` 安装 | ✅ |
| GitHub topic `dsh-plugin` | ✅ |
| `description.en` 存在、以句号结尾 | ✅ |
| 含 `: ` 的描述已加引号 | ✅（`en` 与 `zh` 都用了单引号） |
| 一个 PR 最多 3 条 | ✅（只 1 条） |
| 分类取值合法 | ✅ `tools` |

## 注意事项

- `url` 必须与仓库完全一致，不要带尾部斜杠。
- `name` 是列表里显示的链接文字；单包仓库用 `owner/repo` 即可，不用 `#subname`。
- 中文 `zh` 是可选的（缺了维护者会补），但给了更好。
- 提之前先确认 `dsh plugin --profile web add github:zwbao/dsh-plugin-longpi` 在干净机器上真的能装上——CI 只校验 manifest 声明，实际安装失败会在 review 里被抓出来。
