// Failure is a real terminal startup state, never an endless disabled start button.
export function showStartupFailure(document, error) {
  const panel = document.getElementById('startup-error');
  if (!panel) return;
  panel.hidden = false;
  const detail = document.getElementById('startup-error-detail');
  if (detail) detail.textContent = /webgl|context|renderer/i.test(String(error?.message || error))
    ? '当前浏览器无法创建 3D 画面。此页面需要 WebGL；可以先返回合集体验其他游戏。'
    : '古道资源没有准备好。检查网络后重试，或先返回合集。';
  const start = document.getElementById('start-btn');
  if (start) { start.disabled = true; start.textContent = '暂时无法启动'; }
  document.getElementById('startup-home')?.focus?.({ preventScroll: true });
}
