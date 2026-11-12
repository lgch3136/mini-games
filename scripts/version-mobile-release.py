"""Propagate a release query through changed local JS/CSS dependencies.
Preserves historic v= prefixes relied upon by older test fixtures; never changes
remote URLs or published state. Run only after all implementation edits settle.
"""
from pathlib import Path
import subprocess,re,sys
root=Path(__file__).resolve().parents[1]
revision=sys.argv[1] if len(sys.argv)>1 else '20260930-quality-r2'
changed=set(subprocess.check_output(['git','diff','--name-only'],cwd=root,text=True).splitlines())
changed.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
files=[p for p in root.rglob('*') if p.is_file() and p.suffix in ('.mjs','.js','.html','.css') and not any(x in p.relative_to(root).parts for x in ('.git','tests','tools','docs','scripts','vendor'))]
pattern=re.compile(r'''(["'])([^"'\s]+?\.(?:mjs|js|css))(?:\?([^"'\s]*))?\1''')
touched=set()
for iteration in range(len(files)+1):
 round_changes=0
 for file in files:
  source=file.read_text()
  def update(m):
   quote,ref,query=m.groups()
   if ':' in ref or ref.startswith('//'):return m[0]
   target=(file.parent/ref).resolve()
   try:relative=str(target.relative_to(root))
   except ValueError:return m[0]
   if relative not in changed:return m[0]
   params=[x for x in (query or '').split('&') if x and not x.startswith('mobile=')]
   params.append('mobile='+revision)
   return quote+ref+'?'+'&'.join(params)+quote
  result=pattern.sub(update,source)
  if result!=source:
   file.write_text(result);relative=str(file.relative_to(root));changed.add(relative);touched.add(relative);round_changes+=1
 if not round_changes:break
else:raise SystemExit('Dependency query propagation did not settle')
print(f'Cache revision {revision}: {len(touched)} production source files updated')
