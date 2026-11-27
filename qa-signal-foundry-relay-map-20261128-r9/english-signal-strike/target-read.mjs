// Paint around the existing projected target center, never move the aim or show a hidden target.
export function targetGlyph(kind, x, y, projectedRadius, viewportHeight) {
  const r = Math.min(Math.max(7, viewportHeight*.056), Math.max(4, projectedRadius));
  const fly = kind === 'drone';
  const paths = fly
    ? [[[-1,.25],[-.40,-.52],[-.17,-.52]],[[.17,-.52],[.40,-.52],[1,.25]],
       [[-.81,.39],[-.60,.64],[-.24,.64]],[[.24,.64],[.60,.64],[.81,.39]]]
    : [[[-1,-.12],[-1,-.66],[-.47,-.66]],[[.47,-.66],[1,-.66],[1,-.12]],
       [[1,.12],[1,.66],[.47,.66]],[[-.47,.66],[-1,.66],[-1,.12]]];
  return { paths:paths.map(path=>path.map(([u,v])=>[x+r*u,y+r*v])),
    dot:[x,y,Math.min(3,Math.max(1.25,r*.13))], r };
}
