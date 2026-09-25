/**
 * Procedural category artwork (SVG, decorative). Each motif expresses what the category does:
 * website builders → architectural layout grid; design → layered geometric canvas;
 * CRM → connected contact nodes; marketing → signal waves; project management → modular timeline.
 */
export function CategoryArt({ slug }: { slug: string }) {
  switch (slug) {
    case "website-builders":
      return (
        <svg viewBox="0 0 280 150" aria-hidden="true">
          <rect className="a1" x="20" y="16" width="240" height="118" rx="6" />
          <path className="a1" d="M20 36h240" />
          <circle className="a3 loop-pulse" cx="32" cy="26" r="3" /><circle className="a2 loop-pulse" cx="44" cy="26" r="3" style={{ animationDelay: "-1.4s" }} />
          <rect className="a2 loop-scan" x="22" y="38" width="236" height="2" rx="1" opacity="0.5" />
          <g className="anim"><rect className="a3 loop-float" x="34" y="48" width="96" height="44" rx="3" /><rect className="a5" x="140" y="48" width="106" height="20" rx="3" /><rect className="a5 loop-slide" x="140" y="72" width="70" height="20" rx="3" /></g>
          <g className="anim-y"><rect className="a2" x="34" y="102" width="60" height="20" rx="3" /><rect className="a5" x="102" y="102" width="60" height="20" rx="3" /><rect className="a5" x="170" y="102" width="76" height="20" rx="3" /></g>
          <path className="a4" d="M34 48v74M140 48v44M246 48v74" strokeDasharray="2 4" />
        </svg>
      );
    case "design":
      return (
        <svg viewBox="0 0 280 150" aria-hidden="true">
          <rect className="a5" x="24" y="18" width="232" height="114" rx="4" />
          <g className="anim"><circle className="a3 loop-float" cx="112" cy="76" r="42" /></g>
          <g className="anim-y"><g className="loop-float-b"><rect className="a2" x="134" y="40" width="72" height="72" rx="4" transform="rotate(12 170 76)" /></g></g>
          <polygon className="a1" points="196,30 250,118 142,118" />
          <path className="a4" d="M30 132 L250 18" strokeDasharray="3 5" />
          <circle className="a1 loop-spin" cx="112" cy="76" r="54" strokeDasharray="1 5" />
        </svg>
      );
    case "crm": {
      const nodes = [[50, 40], [110, 28], [170, 50], [230, 34], [80, 100], [150, 110], [215, 100], [130, 70]];
      const edges = [[0, 7], [1, 7], [2, 7], [3, 2], [4, 7], [5, 7], [6, 2], [4, 5], [5, 6], [0, 1]];
      return (
        <svg viewBox="0 0 280 150" aria-hidden="true">
          {edges.map(([a, b], i) => <line key={i} className="a1 loop-wave" x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />)}
          <g className="anim">{nodes.map(([x, y], i) => <circle key={i} className={`${i === 7 ? "a3" : i % 3 === 0 ? "a2" : "a5"} loop-pulse`} style={{ animationDelay: `${i * -0.35}s` }} cx={x} cy={y} r={i === 7 ? 14 : 8} />)}</g>
          {nodes.map(([x, y], i) => i !== 7 && <circle key={`o${i}`} className="a1" cx={x} cy={y} r="8" />)}
        </svg>
      );
    }
    case "marketing":
      return (
        <svg viewBox="0 0 280 150" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <path key={i} className={`${i % 2 ? "a4" : "a1"} loop-wave`} style={{ animationDuration: `${2.4 + i * 0.6}s` }} d={`M10 ${75 + (i - 1.5) * 16} C 60 ${30 + i * 8}, 110 ${120 - i * 8}, 160 ${75 + (i - 1.5) * 10} S 250 ${40 + i * 12}, 272 ${70 + i * 6}`} />)}
          <g className="anim-y">{[40, 70, 100, 130, 160, 190, 220, 250].map((x, i) => <rect key={x} className={`${i === 5 ? "a3" : "a5"} loop-grow`} style={{ animationDelay: `${i * -0.4}s` }} x={x - 6} y={130 - (12 + ((i * 37) % 60))} width="12" height={12 + ((i * 37) % 60)} rx="2" />)}</g>
          <circle className="a2 loop-pulse" cx="190" cy="54" r="6" />
        </svg>
      );
    case "project-management":
      return (
        <svg viewBox="0 0 280 150" aria-hidden="true">
          {[40, 80, 120, 160, 200, 240].map((x) => <path key={x} className="a1" d={`M${x} 14v122`} strokeDasharray="1 5" />)}
          <g className="anim">
            <rect className="a3" x="30" y="24" width="110" height="16" rx="8" />
            <rect className="a2 loop-slide" x="96" y="50" width="96" height="16" rx="8" />
            <rect className="a5" x="150" y="76" width="100" height="16" rx="8" />
            <rect className="a3" x="60" y="102" width="70" height="16" rx="8" />
            <rect className="a2 loop-slide" x="170" y="102" width="80" height="16" rx="8" style={{ animationDelay: "-2s" }} />
          </g>
          <path className="a4" d="M140 32 C 150 32, 150 58, 96 58" /><path className="a4" d="M192 58 C 205 58, 205 84, 150 84" />
          <circle className="a3 loop-pulse" cx="250" cy="84" r="5" />
          <path className="a4 loop-scan-x" d="M40 14v122" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 280 150" aria-hidden="true">
          <circle className="a1" cx="140" cy="75" r="50" /><circle className="a3" cx="140" cy="75" r="16" />
        </svg>
      );
  }
}
