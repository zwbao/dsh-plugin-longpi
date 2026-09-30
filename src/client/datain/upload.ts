// Upload a checkup from the page, in pieces small enough for the route's body limit, with progress.

import React from 'react'
import { Btn } from '../ui.ts'
import { Icon } from '../icons.ts'
import { errorText, postJson } from '../api.ts'

const h = React.createElement
const PIECE = 24 * 1024

interface UploadAnswer {
  ok?: boolean
  id?: string
  total?: number
  read_back_zh?: string
  progress?: string[]
  error?: string
  duplicate?: boolean
  wrong_person?: boolean
}

function fileToBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

type StoreKind = '' | 'methylation' | 'taxa' | 'proteins' | 'conditions'

/** `simple`: one 上传报告 button for a checkup report only (onboarding); otherwise the full form (档案 tab). */
export function ReportUpload(props: { onDone?: (readBack: string) => void; simple?: boolean }): React.ReactElement {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')
  const [kind, setKind] = React.useState<StoreKind>('')
  const [confirmStore, setConfirmStore] = React.useState(false)

  async function send(file: File): Promise<void> {
    if (file.size > 32 * 1024 * 1024) {
      setError('超过 32 MB。叙述版基因报告请发到健康对话，不要从这里整本上传。')
      return
    }
    if (kind && !confirmStore) {
      setError('请先确认：这份表只留在这台电脑上，不送进体检记录。')
      return
    }
    setBusy(true)
    setError('')
    setStatus('正在准备…')
    try {
      const bytes = new Uint8Array(await fileToBuffer(file))
      const started = await postJson<UploadAnswer>('/api/longpi/upload', {
        op: 'start', filename: file.name, content_type: file.type || 'application/octet-stream', size: bytes.length,
        ...(kind ? { type: kind, confirm: true } : {}),
      })
      const id = started.id
      const total = started.total ?? 1
      if (!id) throw new Error('没有开始上传')
      for (let index = 0; index < total; index += 1) {
        const slice = bytes.subarray(index * PIECE, (index + 1) * PIECE)
        let binary = ''
        for (const byte of slice) binary += String.fromCharCode(byte)
        setStatus(`正在上传 ${index + 1}/${total}`)
        await postJson('/api/longpi/upload', { op: 'chunk', id, index, b64: btoa(binary) })
      }
      setStatus('正在读这份报告…')
      const done = await postJson<UploadAnswer>('/api/longpi/upload', { op: 'finish', id })
      setStatus(done.read_back_zh || '已读取这份报告')
      props.onDone?.(done.read_back_zh || '')
    } catch (err) {
      setError(`这份报告没有读取成功：${errorText(err, '原因不明')}。可以换一张更清晰的照片再试。`)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const fileInput = (hidden: boolean) => h('input', {
    id: 'lp-report-file', type: 'file', ref: fileRef, className: hidden ? 'lp-sr' : 'lp-input', tabIndex: hidden ? -1 : undefined,
    accept: hidden ? 'application/pdf,image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,.csv,.tsv,.txt,.json',
    disabled: busy,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) void send(file)
      event.target.value = ''
    },
  })
  if (props.simple) {
    return h('div', { className: 'lp-upload-simple' },
      fileInput(true),
      h(Btn, { onClick: () => fileRef.current?.click(), disabled: busy }, h(Icon, { name: 'plus', size: 14 }), busy ? '正在读取…' : '上传报告'),
      h('span', { className: 'lp-caption' }, '照片或 PDF'),
      busy ? h('p', { className: 'lp-caption lp-upload-status', role: 'status' }, `${status} 通常需要 1–2 分钟。`) : status ? h('p', { className: 'lp-upload-status', role: 'status' }, status) : null,
      error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null)
  }
  return h('div', { id: 'lp-report-upload' },
    h('label', { className: 'lp-fine', htmlFor: 'lp-upload-kind' }, '文件类型'),
    h('select', {
      id: 'lp-upload-kind', className: 'lp-input', value: kind, disabled: busy,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setKind(event.target.value as StoreKind),
    },
      h('option', { value: '' }, '体检报告（PDF 或照片）'),
      h('option', { value: 'methylation' }, '甲基化位点表'),
      h('option', { value: 'taxa' }, '菌群表'),
      h('option', { value: 'proteins' }, '蛋白表'),
      h('option', { value: 'conditions' }, '诊断编码')),
    kind ? h('label', { className: 'lp-check', htmlFor: 'lp-upload-confirm' },
      h('input', {
        id: 'lp-upload-confirm', type: 'checkbox', checked: confirmStore, disabled: busy,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setConfirmStore(event.target.checked),
      }),
      '确认后记在这台电脑上，不送进体检记录') : null,
    fileInput(false),
    status ? h('p', { className: 'lp-muted', role: 'status', id: 'lp-upload-status' }, status) : null,
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('p', { className: 'lp-fine' }, '也可以直接把 PDF 或照片发到健康对话。'))
}
