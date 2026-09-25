/**
 * ArchMind outline icon set — one family for the whole public portal:
 * 24px grid, 1.75 stroke, round caps/joins, geometric. Decorative by default.
 */
import { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17.5 9 4.5 9-4.5" opacity=".55" /></>,
  repository: <><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6" /><path d="M4.5 11.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6" /></>,
  views: <><circle cx="5.5" cy="6" r="2.5" /><circle cx="18.5" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 6h8M7 8l3.7 7.8M17 8l-3.7 7.8" /></>,
  review: <><path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.3 7.5 9.5 4.4-1.2 7.5-5.1 7.5-9.5V6L12 3Z" /><path d="m8.8 12 2.2 2.2 4.3-4.4" /></>,
  evidence: <><path d="M6 3h8l4 4v6" /><path d="M6 3v18h6" /><path d="M14 3v4h4" /><circle cx="16.5" cy="17" r="3" /><path d="m18.7 19.2 2.3 2.3" /></>,
  planning: <><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M7 18h5a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h-.5" /><path d="M9 6h2M5 10v2" /></>,
  scenarios: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="9.5" y="8" width="5" height="12" rx="1.5" /><rect x="16" y="12" width="5" height="8" rx="1.5" /></>,
  decision: <><path d="M12 4v16M6 20h12" /><path d="M5 8h14" /><path d="m5 8-2.5 6h5L5 8ZM19 8l-2.5 6h5L19 8Z" /></>,
  architects: <><circle cx="12" cy="7" r="3" /><path d="M6 20v-1.5A4.5 4.5 0 0 1 10.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20" /><path d="M19 9.5 21 8M5 9.5 3 8" /></>,
  radar: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18 6" /><circle cx="15" cy="9.5" r="1" /></>,
  fragmented: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M14 6.5h4a2 2 0 0 1 2 2V10M10 17.5H6a2 2 0 0 1-2-2V14" strokeDasharray="2 2.5" /></>,
  manual: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  visibility: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  framework: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.3 7.5 9.5 4.4-1.2 7.5-5.1 7.5-9.5V6L12 3Z" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.3 3.5 5.2 3.5 8.5s-1 6.2-3.5 8.5c-2.5-2.3-3.5-5.2-3.5-8.5s1-6.2 3.5-8.5Z" /></>,
}

export type IconName = keyof typeof paths

export default function Icon({ name, size = 22, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {paths[name]}
    </svg>
  )
}
