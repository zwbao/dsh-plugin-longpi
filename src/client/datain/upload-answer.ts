// What the page shows after an upload: a failure never reads as success, and a timeout says the state is unknown
// instead of claiming the service did or did not save the report. Pure, so the wording is tested without a browser.

export interface UploadAnswerLike {
  ok?: boolean
  timed_out?: boolean
  duplicate?: boolean
  read_back_zh?: string
  error?: string
}

export interface UploadAnswerText {
  ok: boolean
  /** The line shown as the upload's status (empty for a failure). */
  status: string
  /** The line shown as the upload's error (empty for a success). */
  error: string
}

/** The one place that decides whether an upload answer may be shown as read. */
export function uploadAnswerText(answer: UploadAnswerLike | null | undefined): UploadAnswerText {
  // An answer that says timed_out is unknown even if a buggy sender also set ok.
  if (answer?.timed_out) {
    return {
      ok: false,
      status: '',
      error: '上传等待超时：还不能确认健康数据服务是否已收到并保存这份报告。请稍后在健康页查看是否出现；若没有，再重新上传。',
    }
  }
  if (answer?.ok === false) return { ok: false, status: '', error: answer.error || '这份报告没有读取成功。' }
  // A missing ok is not a success: an old or broken answer must not be shown as「已读取」.
  if (answer?.ok !== true) return { ok: false, status: '', error: '没有收到这份报告的处理结果，请重新上传。' }
  const fallback = answer.duplicate ? '该报告此前已上传，未重复保存。' : '已读取这份报告'
  return { ok: true, status: answer.read_back_zh || fallback, error: '' }
}
