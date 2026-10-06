/** Monograma MD: as pernas do M se cruzam e se fecham num losango, como na peça da marca. */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Maria Dolores">
      <defs>
        <linearGradient id="md-ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3ab66" />
          <stop offset="0.45" stopColor="#c58941" />
          <stop offset="1" stopColor="#8f5d2b" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#md-ouro)" strokeWidth="7" strokeLinejoin="miter" strokeLinecap="butt">
        {/* perna esquerda e diagonal que desce até o losango */}
        <path d="M14 76 V12 L66 66" />
        {/* perna direita e diagonal que desce até o losango */}
        <path d="M86 76 V12 L34 66" />
        {/* losango vazado */}
        <path d="M50 50 L66 66 L50 82 L34 66 Z" />
      </g>
    </svg>
  )
}
