"""Three original mobile arcade dioramas, authored procedurally in Blender."""
import bpy,math,os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
def mat(name,c,metal=0,rough=.32,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission
 return m
def cube(name,loc,scale,m,bevel=.1):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:a=o.modifiers.new('Rounded edges','BEVEL');a.width=bevel;a.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def sphere(name,loc,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=r,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(m);bpy.ops.object.shade_smooth();return o
def rod(a,b,r,m):
 vec=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=vec.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_euler=vec.to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def start(name,bg):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=160;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.035;s.cycles.max_bounces=4;s.cycles.use_denoising=False;s.render.resolution_x=960;s.render.resolution_y=640;s.render.resolution_percentage=100;s.world.color=(.10,.12,.16);s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.film_transparent=False
 floor=mat('backdrop',bg,rough=.7);cube('ground',(0,0,-.65),(200,200,.2),floor,0)
 for loc,power,size,color in [((-5,-3,10),1500,7,(.76,.90,1)),((5,4,8),1900,6,(1,.68,.36)),((0,4,4),850,4,(.4,1,.9))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(8,-11,11));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.35))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=10.7;s.camera=cam
 return s
def render(s,name):
 if os.environ.get("COVER") and os.environ["COVER"]!=name:return
 s.render.filepath=os.path.join(ROOT,'shared/mobile-art',name+'-diorama.png');bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'tools/mobile-art',name+'-diorama.blend'))
navy=mat('midnight blue',(.024,.06,.115),.2);mint=mat('mint enamel',(.035,.72,.52),.35);gold=mat('apricot',(.98,.37,.085),.2);white=mat('ceramic',(.8,.91,.91));black=mat('graphite',(.01,.018,.027),.6);glow=mat('energy',(.13,.9,.68),.3,emission=.6)
s=start('bomber',(.016,.036,.057));cube('island',(0,0,-.32),(6.6,6.6,.5),navy,.2)
for x in range(-3,4):
 for y in range(-3,4):
  cube('tile',(x*.89,y*.89,-.03),(.83,.83,.14),mint if (x+y)%2 else navy,.035)
  if x%2==0 and y%2==0 and not(x==0 and y==0):cube('wall',(x*.89,y*.89,.43),(.78,.78,.8),navy,.08)
for x,y in [(-1,2),(1,2),(2,1),(-2,-1),(0,1),(2,-1)]:
 cube('copper crate',(x*.89,y*.89,.32),(.68,.68,.68),gold,.04)
 for dz in [-.16,.16]:cube('crate strap',(x*.89,y*.89-.351,.32+dz),(.6,.025,.045),white,.012)
for x,y,r in [(1,-1,.40),(-1,1,.30)]:
 sphere('bomb',(x*.89,y*.89,.43),r,black);rod((x*.89,y*.89,.7),(x*.89+.10,y*.89,.99),.035,gold);sphere('fuse spark',(x*.89+.1,y*.89,1),.095,glow)
# Original friendly round courier, not a licensed character.
cube('courier torso',(-.9,-1.8,.55),(.5,.36,.54),mint,.14);sphere('helmet',(-.9,-1.8,1.05),.38,white)
for x in [-1.02,-.78]:sphere('dark visor eye',(x,-2.12,1.10),.061,black)
for x in [-1.08,-.72]:cube('boots',(x,-1.87,.21),(.24,.40,.20),gold,.09)
render(s,'bomber')
s=start('miner',(.028,.055,.054));s.camera.data.ortho_scale=13.0;s.camera.rotation_euler=(Vector((0,0,1.0))-s.camera.location).to_track_quat('-Z','Y').to_euler();stone=mat('slate rock',(.08,.17,.18),.1,.55);sand=mat('warm rock',(.28,.17,.07),.1,.5)
for i in range(4):cube('mine tier',(0,.15*i,-.28+i*.26),(7-i*.85,5.8-i*.72,.46),stone if i%2 else sand,.23)
# Big quartz clusters placed along a clear mine face.
for x,y,z,r in [(-2,-1,.7,.38),(1.7,.4,1.1,.52),(1,-1.3,.8,.32),(-.6,.6,1.35,.45)]:
 for j in range(3):
  bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r*.62,radius2=r*.28,depth=r*1.8,location=(x+(j-1)*r*.5,y+(j%2)*r*.25,z+r*.45));o=bpy.context.object;o.rotation_euler[1]=(j-1)*.23;o.data.materials.append(glow if j%2==0 else mint)
  bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r*.28,radius2=0,depth=r*.5,location=(o.location.x,o.location.y,o.location.z+r*1.15));bpy.context.object.data.materials.append(glow)
for x in [-2.6,2.6]:rod((x,1.8,.2),(x,1.8,3.5),.16,gold)
rod((-2.8,1.8,3.5),(2.8,1.8,3.5),.19,gold)
rod((-.5,1.8,3.45),(-.5,.2,1.95),.032,black)
for dx in [-.38,.38]:rod((-.5,.2,1.95),(-.5+dx,.2,1.5),.075,gold);rod((-.5+dx,.2,1.5),(-.5+dx*.3,.2,1.15),.075,gold)
render(s,'miner')
s=start('breaker',(.014,.028,.06));blue=mat('sapphire',(.04,.18,.66),.45);pink=mat('raspberry',(.74,.06,.25),.3);yellow=mat('butterscotch',(.99,.57,.06),.3)
cube('arena plinth',(0,0,-.25),(7,6,.45),navy,.22)
for x in [-3.3,3.3]:cube('edge rail',(x,0,.16),(.14,5.7,.3),blue,.05)
colors=[mint,blue,pink,yellow]
for y in range(4):
 for x in range(6):
  if y==0 and x in [2,3]:continue
  cube('breakable enamel brick',((x-2.5)*.91,1.9-y*.6,.4),(.83,.46,.45),colors[y],.075)
cube('paddle',(0,-2.1,.28),(2.0,.42,.35),white,.16);cube('paddle core',(0,-2.12,.47),(1.35,.25,.045),mint,.08)
sphere('ball',(.1,-.5,.55),.23,white)
for i in range(1,6):sphere('trail',(.1-i*.16,-.5-i*.22,.55),.15*(1-i*.13),glow)
render(s,'breaker')
