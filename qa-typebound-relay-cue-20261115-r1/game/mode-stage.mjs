// Exactly one renderer owns the canvas; destroy removes asynchronous image callbacks.
export function stageKindFor(mode) {
  return mode === 'journey' ? 'journey' : 'focus';
}
export function selectModeStage(current, mode, canvas, types) {
  const Type = types[stageKindFor(mode)];
  if (current instanceof Type) return current;
  const reduced = current?.reduced ?? false;
  current?.destroy();
  const next = new Type(canvas);
  next.reduced = reduced;
  return next;
}
