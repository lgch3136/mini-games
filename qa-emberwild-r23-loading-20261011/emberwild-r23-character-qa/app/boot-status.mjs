// Page-local loading status only. No network, persistence or telemetry here.
const assets = { rig: '骨骼', hero: '人物', sword: '武器' };
const phases = { request: '连接', download: '下载', hash: '校验', decode: '解码', validate: '模型检查', textures: '贴图检查' };
export function showHeroLoadProgress(progress, doc = globalThis.document) {
  const label = doc?.querySelector('#loading');
  if (!label || progress.state === 'failed') return;
  const asset = assets[progress.asset] ?? '人物资源';
  if (progress.state === 'ready') { label.textContent = '人物资源已校验，正在准备场景…'; return; }
  if (progress.state === 'retrying') { label.textContent = `${asset}连接暂时中断，重新下载（第 ${progress.attempt} 次）…`; return; }
  if (progress.phase === 'download') {
    const received = Math.max(0, Number(progress.receivedBytes) || 0), total = Math.max(received, Number(progress.expectedBytes) || 0);
    label.textContent = `正在下载${asset}：${(received / 1048576).toFixed(2)} / ${(total / 1048576).toFixed(2)} MB；随后校验与解码…`;
  } else label.textContent = `正在${phases[progress.phase] ?? '准备'}${asset}…`;
}
export function showBootFailure(error, { document: doc = globalThis.document, reload = () => globalThis.location.reload() } = {}) {
  const primary = error?.cause?.code ? error.cause : error;
  const where = primary?.asset ? `${assets[primary.asset] ?? '人物资源'}${phases[primary.phase] ?? '加载'}` : '场景启动';
  const reasons = { NETWORK_TIMEOUT: '网络长时间没有收到数据', TIMEOUT: '已达到本次加载总时限', PHASE_TIMEOUT: '处理阶段超时', NETWORK: '网络连接中断', HTTP: `服务器返回 ${primary?.status ?? '异常状态'}`, HASH: '资源校验失败', SIZE: '资源字节长度不符', CONTRACT: '模型或贴图检查失败', STREAM: '资源数据流异常', ABORTED: '加载已取消' };
  const detail = reasons[primary?.code] ?? String(primary?.message ?? primary ?? '未知错误').slice(0, 220);
  const status = doc.querySelector('#loading'), start = doc.querySelector('#start');
  if (status) status.textContent = `${where}未完成：${detail}${primary?.code ? `（${primary.code} · ${primary.asset ?? 'boot'}/${primary.phase ?? 'load'}）` : ''}。可重新加载再试，测试存档保留。`;
  doc.querySelector('#screen')?.classList.remove('hidden');
  if (start) {
    let restarting = false;
    start.textContent = '重新加载'; start.disabled = false;
    start.onclick = () => {
      if (restarting) return;
      restarting = true; start.disabled = true; start.textContent = '正在重新加载…';
      // A full document reload recreates disposed owners and rejected ESM state.
      reload();
    };
  }
}
export async function startGame({ load = () => import('./game.mjs?v=r23-progress-load-a1'), ...ui } = {}) {
  try { return await load(); }
  catch (error) { console.error(error); showBootFailure(error, ui); return null; }
}
