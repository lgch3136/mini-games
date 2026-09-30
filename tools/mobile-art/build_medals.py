"""Original low-poly enamel mastery medals. Blender 4.3+, Cycles CPU. No external art."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'shared/mobile-art');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=40;s.cycles.use_denoising=False
s.render.resolution_x=256;s.render.resolution_y=256;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.film_transparent=True
s.world.color=(.22,.24,.28)
s.view_settings.view_transform='AgX'
def mat(name,color,metal=.0,rough=.3):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
def bevel(o,r=.055):
 m=o.modifiers.new('soft machined edges','BEVEL');m.width=r;m.segments=3;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
def cylinder(name,r,depth,z,material,vertices=64):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(material);bevel(o);return o
metal=mat('warm alloy',(.78,.39,.12),.78,.22);enamel=mat('deep teal enamel',(.013,.095,.12),.25,.22);white=mat('ivory engraving',(.94,.90,.70),.48,.21)
base=cylinder('medal body',1,.2,0,metal)
face=cylinder('inset enamel',.83,.08,.13,enamel)
bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=12,location=(0,0,.22),major_radius=.88,minor_radius=.046);ring=bpy.context.object;ring.data.materials.append(metal)
# Extruded five-point star, front face catches a different bevel highlight.
verts=[]
for z in [.20,.34]:
 for i in range(10):
  a=math.pi/2+i*math.pi/5;r=.60 if i%2==0 else .285;verts.append((math.cos(a)*r,math.sin(a)*r,z))
faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
mesh=bpy.data.meshes.new('star');mesh.from_pydata(verts,[],faces);mesh.update();star=bpy.data.objects.new('mastery star',mesh);bpy.context.collection.objects.link(star);star.data.materials.append(metal);bevel(star,.035)
# Distinct raised tick marks: recognizable at 40 CSS px.
for i in range(16):
 a=math.tau*i/16;bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.023,location=(.738*math.cos(a),.738*math.sin(a),.19));bpy.context.object.data.materials.append(white)
# Premium cloth tails visible below the medallion.
for side in [-1,1]:
 v=[(side*.12,-.55,-.06),(side*.62,-.55,-.06),(side*.68,-1.23,-.06),(side*.39,-1.04,-.06),(side*.16,-1.23,-.06)]
 mesh=bpy.data.meshes.new('ribbon');mesh.from_pydata(v,[],[(0,1,2,3,4)]);mesh.update();o=bpy.data.objects.new('enamel ribbon',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(enamel);m=o.modifiers.new('cloth thickness','SOLIDIFY');m.thickness=.06;bevel(o,.025)
def light(name,loc,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
light('softbox',(-3,4,5),480,4,(1,.90,.75));light('cool edge',(3,1,2),350,3,(.65,.82,1));light('bottom fill',(0,-4,3),180,2,(1,.67,.34))
bpy.ops.object.camera_add(location=(.0,-1.75,7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.12,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.78;s.camera=cam
for name,alloy,tint in [('bronze',(.65,.28,.105),(.14,.037,.023)),('silver',(.69,.79,.88),(.028,.105,.19)),('gold',(.95,.64,.16),(.026,.12,.095)),('prism',(.58,.78,1),(.11,.039,.24))]:
 for m,c in [(metal,alloy),(enamel,tint)]:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1)
 s.render.filepath=os.path.join(OUT,'medal-'+name+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'tools/mobile-art/mastery-medals.blend'))
