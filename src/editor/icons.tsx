import type { ReactNode } from 'react'

// The editor's icons: one simple line style, 20px, drawn with the current text colour.
// Every icon sits next to a word or has a name, so none has to be guessed.

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const UndoIcon = () => <Icon><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>
export const RedoIcon = () => <Icon><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Icon>
export const EyeIcon = () => <Icon><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>
export const PenIcon = () => <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>
export const BoldIcon = () => <Icon><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7Z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7Z" /></Icon>
export const AlignLeftIcon = () => <Icon><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></Icon>
export const AlignCentreIcon = () => <Icon><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></Icon>
export const AlignRightIcon = () => <Icon><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></Icon>
export const ResetIcon = () => <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>
export const SlidersIcon = () => <Icon><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Icon>
export const CopyIcon = () => <Icon><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></Icon>
export const TrashIcon = () => <Icon><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Icon>
export const UpIcon = () => <Icon><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
export const DownIcon = () => <Icon><path d="M12 5v14M19 12l-7 7-7-7" /></Icon>
export const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>
export const LayersIcon = () => <Icon><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></Icon>
export const CheckIcon = () => <Icon><path d="m5 12 5 5 9-10" /></Icon>
export const CloseIcon = () => <Icon><path d="M6 6l12 12M18 6 6 18" /></Icon>
export const EyeOffIcon = () => <Icon><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Icon>
export const BoxStartIcon = () => <Icon><path d="M4 4v16" /><rect x="7" y="8" width="9" height="8" rx="1.5" /></Icon>
export const BoxCentreIcon = () => <Icon><path d="M12 4v4M12 16v4" /><rect x="7.5" y="8" width="9" height="8" rx="1.5" /></Icon>
export const BoxEndIcon = () => <Icon><path d="M20 4v16" /><rect x="8" y="8" width="9" height="8" rx="1.5" /></Icon>
// Two boxes, one dashed: "select more than one".
export const SelectMoreIcon = () => <Icon><rect x="3" y="3" width="11" height="11" rx="1.5" /><rect x="10" y="10" width="11" height="11" rx="1.5" strokeDasharray="2.5 2.5" /></Icon>
