// DSH shares its UI kit with plugins at runtime (the module loader's require);
// there is no npm types package, so declare only what LongPi uses. No
// top-level import or export here: that would turn this into an augmentation
// of a module TypeScript cannot resolve.

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export interface ModalProps {
    open: boolean
    onClose: () => void
    /** Also the dialog's aria-label, in every mode. */
    title: string
    /** Render children directly in the card (no header, close button or body chrome). */
    headless?: boolean
    className?: string
    contentClassName?: string
    description?: string
    closeLabel?: string
    footer?: import('react').ReactNode
    children?: import('react').ReactNode
  }

  export function Modal(props: ModalProps): import('react').ReactElement | null

  // A type, not an interface: an interface cannot extend an import() type.
  export type ButtonProps = import('react').ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
    size?: 'md' | 'sm'
    icon?: import('react').ReactNode
    'data-modal-autofocus'?: boolean
  }

  export function Button(props: ButtonProps): import('react').ReactElement
}
