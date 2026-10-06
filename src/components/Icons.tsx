import type { SVGProps } from 'react'

const base = (d: string | string[]) => (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {(Array.isArray(d) ? d : [d]).map((x, i) => <path key={i} d={x} />)}
  </svg>
)

export const IcHome = base(['M3 11l9-7 9 7', 'M5 10v10h14V10', 'M10 20v-6h4v6'])
export const IcTeam = base(['M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1', 'M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7', 'M21 20v-1a4 4 0 0 0-3-3.9', 'M15 4.1a3.5 3.5 0 0 1 0 6.8'])
export const IcStore = base(['M4 9l1.5-5h13L20 9', 'M4 9v11h16V9', 'M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0', 'M10 20v-5h4v5'])
export const IcMoney = base(['M3 6h18v12H3z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M6 9v.01', 'M18 15v.01'])
export const IcReturn = base(['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'])
export const IcAlert = base(['M12 9v4', 'M12 17h.01', 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'])
export const IcCard = base(['M3 5h18v14H3z', 'M3 10h18', 'M7 15h4'])
export const IcGift = base(['M20 12v9H4v-9', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z'])
export const IcCalendar = base(['M3 5h18v16H3z', 'M16 3v4', 'M8 3v4', 'M3 10h18'])
export const IcFunnel = base(['M3 4h18l-7 8v6l-4 2v-8z'])
export const IcMegaphone = base(['M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z', 'M16 8a5 5 0 0 1 0 8', 'M19 5a9 9 0 0 1 0 14'])
export const IcMap = base(['M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14', 'M15 6v14'])
export const IcSettings = base(['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'])
export const IcAgenda = base(['M8 2v4', 'M16 2v4', 'M3 8h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 14l2 2 4-4'])
export const IcPlus = base(['M12 5v14', 'M5 12h14'])
export const IcDownload = base(['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'])
export const IcUpload = base(['M12 21V9', 'M7 14l5-5 5 5', 'M5 3h14'])
export const IcEdit = base(['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'])
export const IcTrash = base(['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'])
export const IcMenu = base(['M3 6h18', 'M3 12h18', 'M3 18h18'])
export const IcMoon = base(['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'])
export const IcSun = base(['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10', 'M12 1v2', 'M12 21v2', 'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4', 'M1 12h2', 'M21 12h2', 'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4'])
export const IcChevL = base('M15 18l-6-6 6-6')
export const IcChevR = base('M9 18l6-6-6-6')
export const IcSparkle = base(['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z'])
