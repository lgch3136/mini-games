import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const roots=['index.html','style.css','shared',...fs.readdirSync(root).filter(p=>p.startsWith('english-'))];
const files=[];
function walk(p){const s=fs.statSync(p);if(s.isDirectory()){for(const n of fs.readdirSync(p))if(!['art','tests'].includes(n))walk(path.join(p,n));}else if(/\.(?:html|css|mjs|js)$/.test(p)&&!p.includes('/vendor/'))files.push(p);}
roots.forEach(r=>walk(path.join(root,r)));
const failures=[];let checked=0;
for(const file of files){
 const source=fs.readFileSync(file,'utf8');
 const refs=[];
 if(file.endsWith('.html'))for(const m of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))refs.push(m[1]);
 if(/\.(?:mjs|js)$/.test(file))for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g))refs.push(m[1]);
 if(file.endsWith('.css'))for(const m of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))refs.push(m[1]);
 for(const ref of refs){
  if(/^(?:[a-z]+:|\/\/|#)/i.test(ref)||!ref||ref.includes('${')||(!ref.includes('/')&&!ref.includes('.')))continue;
  const clean=ref.split(/[?#]/)[0];if(!clean)continue;
  const target=path.resolve(path.dirname(file),clean);
  if(!target.startsWith(root+path.sep)&&target!==root){failures.push(`${path.relative(root,file)} → outside root: ${ref}`);continue;}
  checked++;
  if(!fs.existsSync(target))failures.push(`${path.relative(root,file)} → missing: ${ref}`);
 }
}
console.log(`${files.length} production source files; ${checked} local resource/import references checked`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('All checked references resolve');
