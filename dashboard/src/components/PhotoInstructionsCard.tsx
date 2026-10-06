const STEPS = [
  'Photograph ONE marked block: the black-and-white square tag with the 4 plants around it.',
  'Hold the phone flat, pointing straight down, about 40 cm above the plants.',
  'Put the tag in the centre of the photo.',
  'All 4 plants must be fully in the picture, none touching the edge.',
  "Only one tag in the photo; don't cover the tag with leaves.",
  'Use the normal camera, no filters, no zoom.',
]

export function PhotoInstructionsCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        How to take the photo
      </h2>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1.5 flex-1">
          {STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        <PhotoDiagram />
      </div>
    </div>
  )
}

function PhotoDiagram() {
  return (
    <svg
      viewBox="0 0 160 160"
      className="w-32 h-32 shrink-0 text-gray-300"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      {/* phone, pointing straight down at the tag */}
      <rect x={66} y={8} width={28} height={16} rx={3} className="text-gray-400" stroke="currentColor" />
      <line x1={80} y1={24} x2={80} y2={62} strokeDasharray="4 4" />

      {/* tag, centered, checkerboard to suggest black/white */}
      <g className="text-gray-400">
        <rect x={64} y={64} width={32} height={32} stroke="currentColor" />
        <rect x={64} y={64} width={16} height={16} fill="currentColor" stroke="none" />
        <rect x={80} y={80} width={16} height={16} fill="currentColor" stroke="none" />
      </g>

      {/* 4 plants around the tag */}
      <circle cx={80} cy={30} r={12} />
      <circle cx={80} cy={130} r={12} />
      <circle cx={30} cy={80} r={12} />
      <circle cx={130} cy={80} r={12} />
    </svg>
  )
}
