/** Renders a QR matrix as a crisp SVG (one path, 1-module quiet zone). */
export default function QrCode({ matrix, size = '28mm', title }) {
  const count = matrix.length;
  const path = matrix.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + 1} ${y + 1}h1v1h-1z` : ''))).join('');
  return (
    <svg
      viewBox={`0 0 ${count + 2} ${count + 2}`}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      style={{ display: 'block', background: 'white' }}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}
