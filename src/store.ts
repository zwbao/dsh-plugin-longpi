export interface AppointmentRequest {
  id: string
  type: 'consult' | 'full_panel' | 'followup'
  preferred_slots: { date: string; period: 'am' | 'pm' }[]
  note?: string
  created_at: string
}

export interface Handoff {
  id: string
  reason_zh: string
  created_at: string
}

export interface LongpiStore {
  appointments: AppointmentRequest[]
  handoffs: Handoff[]
}

const store: LongpiStore = {
  appointments: [],
  handoffs: [],
}

export function getStore(): LongpiStore {
  return store
}

export function addAppointment(row: Omit<AppointmentRequest, 'id' | 'created_at'>): AppointmentRequest | { error: true; code: string; message_zh: string } {
  if (store.appointments.length >= 1) {
    return { error: true, code: 'RATE_LIMIT', message_zh: '本次演示每位团员仅可提交 1 条预约意向。' }
  }
  const created: AppointmentRequest = {
    ...row,
    id: `apt-${store.appointments.length + 1}`,
    created_at: new Date().toISOString(),
  }
  store.appointments.push(created)
  return created
}

export function addHandoff(reason_zh: string): Handoff | { error: true; code: string; message_zh: string } {
  if (store.handoffs.length >= 1) {
    return { error: true, code: 'RATE_LIMIT', message_zh: '本次演示每位团员仅可提交 1 次顾问转接。' }
  }
  const created: Handoff = {
    id: `hof-${store.handoffs.length + 1}`,
    reason_zh,
    created_at: new Date().toISOString(),
  }
  store.handoffs.push(created)
  return created
}
