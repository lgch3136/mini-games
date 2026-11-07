// One tiny baked sprite. No shimmer timers, particle pool, gradients or filters.
export const EMBER_ART=Object.freeze({width:18,height:18,anchor:9});
export function makeEmberSprite(canvasOf){
 const image=canvasOf(18,18),c=image.getContext('2d');
 function face(points,color){c.fillStyle=color;c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();c.fill();}
 // Dark silhouette and asymmetrical facets remain distinct from round hostile shots.
 face([[9,1],[16,7],[16,10],[9,17],[2,10],[2,7]],'#342e27');
 face([[9,2],[15,8],[9,15],[3,8]],'#ce9d50');
 face([[9,2],[9,8],[3,8]],'#ffe6a4');
 face([[9,2],[15,8],[9,8]],'#edbd6e');
 face([[3,8],[9,8],[9,15]],'#d0a052');
 face([[9,8],[15,8],[9,15]],'#946c38');
 c.strokeStyle='#fff1c1';c.lineWidth=1;c.beginPath();c.moveTo(5,7);c.lineTo(9,3);c.lineTo(11,5);c.stroke();
 return image;
}
