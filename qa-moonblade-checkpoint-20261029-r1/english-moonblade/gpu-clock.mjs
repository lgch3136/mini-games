// Optional developer-only, asynchronous GPU timing. Never gl.finish/readPixels
// and never wait for a query: an unavailable result stays in a bounded queue.
export class GpuClock {
  constructor(gl, enabled = false) {
    this.gl = gl;
    this.ext = enabled ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    this.pending = [];
    this.values = [];
    this.frame = 0;
    this.summary = { supported: !!this.ext, samples: 0 };
  }
  begin() {
    if (!this.ext || ++this.frame % 8) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.pending.shift();
      if (!disjoint) this.values.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query);
    }
    if (this.values.length > 120) this.values.splice(0, this.values.length - 120);
    if (this.values.length) {
      const sorted = [...this.values].sort((a, b) => a - b);
      this.summary = { supported: true, samples: sorted.length, median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor((sorted.length - 1) * 0.95)], worst: sorted.at(-1) };
    }
    if (this.pending.length >= 4 || disjoint) return;
    this.current = gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.current);
  }
  end() {
    if (!this.current) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.current); this.current = null;
  }
  dispose() {
    this.end();
    this.pending.forEach(q => this.gl.deleteQuery(q)); this.pending.length = 0;
  }
}
