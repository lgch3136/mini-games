export function drawLogicGrid(context, { cols, rows }, { ox, oy, cell }) {
  context.save();
  context.strokeStyle = '#385d4b70';
  context.lineWidth = Math.max(0.65, Math.min(1, cell / 24));
  context.setLineDash([]);
  context.beginPath();
  for (let column = 1; column < cols; column++) {
    const x = ox + column * cell;
    context.moveTo(x, oy);
    context.lineTo(x, oy + rows * cell);
  }
  for (let row = 1; row < rows; row++) {
    const y = oy + row * cell;
    context.moveTo(ox, y);
    context.lineTo(ox + cols * cell, y);
  }
  context.stroke();
  context.restore();
}
