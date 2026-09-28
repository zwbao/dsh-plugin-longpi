import '../host-shims.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { asJson } from '../json.ts'
import { adviceFor } from './index.ts'

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

/** Concrete tiered advice. The model still writes the reply; this stops a bare refusal. */
export const adviseOnSubstance = defineTool({
  name: 'advise_on_substance',
  description: 'Look up LongPi\'s 4-tier advice for one supplement, diagnosis-first item, prescription or emergency. Returns population ranges, trial regimens as information, tests and departments, or first aid. Never an individual prescription and never a bare refusal. Use the returned sentences in the reply. Do not treat an animal study as human evidence.',
  parameters: {
    subject: { type: 'string', required: true, description: 'The substance or symptom, in the person\'s words, including any medicine they said they take.' },
  },
  output: jsonOut,
  timeoutMs: 5000,
  isConcurrencySafe: () => true,
  async execute(args) {
    const subject = String((args as { subject?: string }).subject ?? '')
    const advice = adviceFor(subject, null)
    if (!advice) {
      return asJson({
        ok: true,
        tier: null,
        say_zh: '这个问题可以具体回答：先说已知的公开范围或该做什么检查，再说明哪些决定要留给医生。不要只说不能回答。',
      })
    }
    return asJson({ ok: true, advice })
  },
})
