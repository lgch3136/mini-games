import { GardenRenderer } from './render.mjs?v=qa-snake-word-order-20261104-r1-render';

export class WordOrderRenderer extends GardenRenderer {
  draw(game, extra = 0) {
    super.draw(game, extra);
    const c=this.ctx, s=this.cell;
    c.save();
    c.setTransform(this.dpr,0,0,this.dpr,0,0);

    // Text + circle/square badges distinguish words without relying on color.
    // These are labels, never suggested movement paths.
    for (const tile of game.tiles) {
      const cat=tile.group==='cat', x=this.ox+(tile.x+.72)*s, y=this.oy+(tile.y+.79)*s;
      const rx=Math.max(7,s*.24), ry=Math.max(4.5,s*.15);
      c.fillStyle=cat ? '#eaf5ff' : '#fff1dd';
      c.strokeStyle=cat ? '#285c83' : '#875321';
      c.lineWidth=Math.max(.75,s*.025);
      c.beginPath();
      if (cat) c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
      else c.rect(x-rx,y-ry,rx*2,ry*2);
      c.fill(); c.stroke();
      c.fillStyle=cat ? '#214d6e' : '#70431e';
      c.font=`800 ${Math.max(7,s*.20)}px system-ui`; c.textAlign='center'; c.textBaseline='middle';
      c.fillText(`${cat?'C':'D'}${tile.id+1}`,x,y+s*.006);
    }
    c.restore();
  }
}
