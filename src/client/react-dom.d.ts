// DSH shares react-dom with plugins through its platform module table, next to
// React; this repo has no @types/react-dom, so declare only the call LongPi
// makes. No top-level import or export, as in dsh-primitives.d.ts.

declare module 'react-dom' {
  export function createPortal(children: import('react').ReactNode, container: Element): import('react').ReactPortal
}
