// Only names the existing navigation target; never changes objectives or routes.
export function guidanceStrings(bearing, restored) {
  const target = `${bearing.direction} ${bearing.label} ${Math.round(bearing.distance)} m`;
  const count = `${restored} / 3 已恢复`;
  return {
    base: `${target} · ${count}`,
    expanded: bearing.otherSide ? `${target} · ${bearing.otherSide} · ${count}` : '',
  };
}
export function createGuidanceLabel(node, container, doc = document, computed = getComputedStyle) {
  let previous = '', previousRoom = -1, accepted = false, dirty = true;
  return {
    invalidate() { dirty = true; },
    format(bearing, restored) {
      const {base, expanded} = guidanceStrings(bearing, restored);
      if (!expanded) return base;
      // The label fills the parent's content box; do not use its padded container's border box.
      // Read the current available width on each HUD update, even when text is unchanged.
      const style = computed(node), rect = node.getBoundingClientRect();
      const px = value => Number.parseFloat(value) || 0;
      const room = Math.max(0, rect.width - px(style.paddingLeft) - px(style.paddingRight)
        - px(style.borderLeftWidth) - px(style.borderRightWidth));
      if (dirty || expanded !== previous || room !== previousRoom) {
        const probe = doc.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        Object.assign(probe.style, {position:'fixed',visibility:'hidden',pointerEvents:'none',whiteSpace:'nowrap',
          font:style.font,fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,
          fontStyle:style.fontStyle,fontStretch:style.fontStretch,fontVariant:style.fontVariant,
          letterSpacing:style.letterSpacing,lineHeight:style.lineHeight,textTransform:style.textTransform});
        probe.textContent = expanded;
        doc.body.appendChild(probe);
        try {
          const width = probe.getBoundingClientRect().width;
          accepted = width > 0 && room > 0 && width <= room;
        } finally { probe.remove(); }
        dirty = false; previous = expanded; previousRoom = room;
      }
      return accepted ? expanded : base;
    },
  };
}
