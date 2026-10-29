// Return a live game to keyboard input after a discrete toolbar action.
// Menus, form fields and open native dialogs keep their normal focus behavior.
export function bindGameplayFocus(canvas, isPlaying, { root = document, signal } = {}) {
  canvas.tabIndex = 0;
  const restore = () => {
    if (isPlaying() && !root.querySelector?.('dialog[open]')?.open)
      canvas.focus?.({ preventScroll: true });
  };
  root.addEventListener('click', event => {
    if (event.target?.closest?.('button, [role="button"]') || event.target?.tagName === 'BUTTON') restore();
  }, signal ? { signal } : undefined);
  canvas.addEventListener('pointerdown', restore, signal ? { signal } : undefined);
  return restore;
}
