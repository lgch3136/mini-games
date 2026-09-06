// All visible surfaces meet the collider's foot plane (p.y), but the wall,
// cornice and roof must not have coincident top faces. In the old layout the
// wall, cap and stone tiles all ended at p.y, causing depth-test flicker.
export function platformLayers(p, city) {
  const height = p.oneWay ? 0.35 : Math.min(5.5, p.h);
  const capHeight = 0.16,
    capTop = p.oneWay ? 0 : -0.085;
  const wallTop = capTop - capHeight;
  return {
    wall: { center: p.y + (wallTop - height) / 2, height: height + wallTop },
    cap: {
      center: p.y + capTop - capHeight / 2,
      height: capHeight,
      top: p.y + capTop,
    },
    tile: p.oneWay
      ? null
      : { center: p.y - (city ? 0.08 : 0.04), top: p.y, bottom: p.y - 0.08 },
  };
}
