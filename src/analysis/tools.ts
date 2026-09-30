// M12 tools: prepare a deep analysis run, import its result, read the imported result.
// The analysis itself is the longevity-analyst skill running in this dsh session.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { CoreDeps } from '../contracts/index.ts'
import { asJson } from '../json.ts'
import { jsonOut } from '../core/tool-kit.ts'
import { SKILL_NAME, currentSummary, importLatest, planReadBack, startRun, statusNow } from './service.ts'

export function registerAnalysisTools(ctx: Context, deps: CoreDeps): void {
  ctx.tools.register(defineTool({
    name: 'run_deep_analysis',
    description: `Prepare a deep multi-omics analysis for this person (biological age, organ checkup table, disease risks, gene-vs-lab insights, a question board and an intervention plan) with the ${SKILL_NAME} skill. Checks consent, age/sex and that the skill is installed, creates the run folder, and returns the exact request to carry out. Use when the person asks for 深度分析 / 全面分析 / 多组学报告. It does not run the analysis: after it returns ok, load the ${SKILL_NAME} skill yourself and do what prompt_zh says.`,
    parameters: {
      data_folder: { type: 'string', description: 'Folder with the person\'s omics/checkup files if they gave one; omit to use only what Mirobody holds.' },
    },
    output: jsonOut,
    timeoutMs: 30_000,
    isConcurrencySafe: () => false,
    async execute(args: { data_folder?: string }) {
      const res = await startRun(deps, { dataFolder: args.data_folder ?? null })
      if (!res.ok) return asJson({ ok: false, reply_zh: res.reply_zh, missing: res.missing, how_to_use: 'Say reply_zh to the person and stop; do not start the skill.' })
      return asJson({
        ...res,
        how_to_use: `Load the ${SKILL_NAME} skill and carry out prompt_zh as the person's request (it is written in their voice). Never print the MCP URL file's contents. When la.py report is done, call import_analysis.`,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'import_analysis',
    description: 'Bring a finished deep analysis into LongPi: its report, organ table, question board and readouts appear on the 健康 page (深度分析). Returns the plan read back for the person. The plan is saved only after they confirm it: then call save_intervention_plan with the returned plan (confirm:false first, read it back, then confirm:true), or they click 接受方案 on the page.',
    parameters: {
      run_id: { type: 'string', description: 'A run id from run_deep_analysis; omit for the latest finished run.' },
    },
    output: jsonOut,
    timeoutMs: 60_000,
    isConcurrencySafe: () => false,
    async execute(args: { run_id?: string }) {
      const res = await importLatest(deps, args.run_id ?? null)
      if (!res.ok) return asJson({ ...res, how_to_use: 'Say error_zh; the problems list is for you, not the person.' })
      return asJson({
        ...res,
        plan_for_save: res.read_back.plan,
        how_to_use: 'Tell the person the result is on the 健康 page under 深度分析. Read the plan items back in plain words (no doses) and ask whether to adopt it; only on a yes, save it through save_intervention_plan with plan_for_save.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_deep_analysis',
    description: 'The imported deep analysis (readouts, organ table, question board with verdicts, the plan and retests) and the progress of any run still going. Read-only. Use when the person asks about their deep analysis report or a question on its board.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    async execute() {
      const status = statusNow(deps)
      const current = currentSummary(deps.dataDir())
      return asJson({
        runs: status.runs.map((r) => ({ id: r.id, started_at: r.started_at, done: `${r.done}/${r.stages.length}`, report_ready: r.report_ready })),
        current,
        plan_read_back: current ? await planReadBack(deps) : null,
        how_to_read: 'AI 估计 readouts are estimates with ranges, not measurements; a genetic percentile is a tendency, not a diagnosis; a ClinVar finding needs clinical confirmation and genetic counselling. Quote numbers as they are here.',
      })
    },
  }))
}
