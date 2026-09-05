"""Original articulated fighter assets. Run with Blender 4.5 LTS --background --python.
No downloaded character meshes or commercial game assets. Coordinates in the helper
API are game X/right, Y/up, Z/toward camera; glTF export converts Blender Z-up.
Every named part is a rigid skeletal segment with a fixed length. Runtime two-bone
IK drives those same segments without morphing between unrelated image cels.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / 'assets'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def xyz(p): return (p[0], -p[2], p[1])
def material(name, color, roughness=.75, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness;bs.inputs['Metallic'].default_value=metal
    return m
def empty(name,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def finish(o,parent,mat,smooth=True):
    o.parent=parent;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=smooth
    return o
def ellipsoid(parent,mat,center,scale,segments=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=(0,0,0))
    o=bpy.context.object;o.location=xyz(center);o.scale=(scale[0],scale[2],scale[1]);
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,parent,mat)
def box(parent,mat,center,size,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(center));o=bpy.context.object;o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Tailored edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,parent,mat,False)
def loft(parent,mat,rings,n=12):
    vertices=[];faces=[]
    for y,rx,rz,ox in rings:
        for j in range(n):
            a=2*math.pi*j/n;vertices.append(xyz((ox+math.cos(a)*rx,y,math.sin(a)*rz)))
    for i in range(len(rings)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;faces.append((a,a+n,b+n,b))
    faces.append(tuple(range(n)));faces.append(tuple((len(rings)-1)*n+j for j in reversed(range(n))))
    mesh=bpy.data.meshes.new('Tailored mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new('Surface',mesh);bpy.context.collection.objects.link(o);return finish(o,parent,mat)
def bar(parent,mat,a,b,r=.03):
    d=Vector(xyz(b))-Vector(xyz(a));bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=d.length,location=(Vector(xyz(a))+Vector(xyz(b)))/2)
    o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');return finish(o,parent,mat)
def merge_part(part):
    meshes=[o for o in part.children if o.type=='MESH']
    if not meshes:return
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();meshes[0].name=part.name+'_surface'

COLORS=[('lin',(0.16,.58,.57),(.035,.105,.16),(.67,.37,.22),(.017,.025,.047)),
        ('mei',(.7,.17,.27),(.16,.038,.095),(.81,.51,.32),(.028,.018,.035)),
        ('shan',(.73,.44,.12),(.09,.12,.16),(.52,.29,.17),(.028,.024,.035))]
roots=[]
for idx,(name,col,dark,skin,hair) in enumerate(COLORS):
    root=empty(name+'_rig');roots.append(root)
    mats={'cloth':material(name+'_jacket',col),'pants':material(name+'_trousers',dark),'skin':material(name+'_skin',skin),
          'hair':material(name+'_hair',hair),'ivory':material(name+'_wraps',(.79,.74,.6)),
          'sole':material(name+'_sole',(.026,.035,.047)), 'gold':material(name+'_brass',(.64,.39,.13),.3,.6),
          'eyes':material(name+'_eyeWhite',(.91,.87,.72)), 'ink':material(name+'_ink',(.012,.018,.025))}
    parts={k:empty(name+'__'+k,root) for k in ['pelvis','torso','head','upperArmF','forearmF','handF','upperArmB','forearmB','handB','thighF','shinF','footF','thighB','shinB','footB','tail']}
    cloth=mats['cloth'];pants=mats['pants'];sk=mats['skin'];iv=mats['ivory'];ink=mats['ink'];gold=mats['gold'];sole=mats['sole']
    # Pelvis, tailored jacket, layered V lapels, undershirt, brass toggles and belt.
    loft(parts['pelvis'],pants,[(-.13,.27,.23,0),(0,.32,.24,0),(.23,.3,.22,0)])
    loft(parts['torso'],cloth,[(0,.25,.2,0),(.2,.29,.22,0),(.65,.37,.23,.025),(.87,.33,.21,.035),(.95,.17,.15,.03)])
    box(parts['torso'],pants,(.05,.7,.207),(.27,.5,.05),.015)
    bar(parts['torso'],iv,(-.23,.85,.20),(.05,.30,.245),.046)
    bar(parts['torso'],iv,(.25,.84,.20),(.05,.30,.245),.046)
    box(parts['torso'],iv,(0,.08,0),(.58,.11,.47),.02)
    box(parts['torso'],gold,(.08,.085,.25),(.14,.1,.035),.015)
    for yy in [.31,.44,.57]:box(parts['torso'],gold,(.26,yy,.22),(.045,.025,.035),.005)
    if idx==2:
        box(parts['torso'],pants,(-.15,.7,.248),(.12,.4,.045),.02)
        box(parts['torso'],gold,(-.15,.85,.28),(.065,.04,.025),.005)
    # Face is a dimensional sculpt, not a billboard: jaw, brow, nose, ears and hair tufts.
    h=parts['head'];loft(h,sk,[(-.13,.11,.12,.025),(-.035,.17,.18,.03),(.1,.215,.22,.015),(.27,.23,.21,0),(.42,.19,.18,-.01),(.48,.08,.075,-.025)],16)
    ellipsoid(h,sk,(-.035,-.20,0),(.115,.18,.12),12,8)
    ellipsoid(h,sk,(-.18,.17,.14),(.047,.073,.052))
    ellipsoid(h,sk,(.218,.17,.09),(.038,.058,.052),12,8)
    # Two inset almond-shaped eyes, not rectangular floating panels.
    ellipsoid(h,mats['eyes'],(.085,.253,.198),(.074,.032,.018),12,6)
    ellipsoid(h,ink,(.11,.251,.215),(.021,.027,.009),10,6)
    ellipsoid(h,mats['eyes'],(.218,.254,-.015),(.017,.028,.052),12,6)
    ellipsoid(h,ink,(.234,.251,-.002),(.009,.025,.018),10,6)
    bar(h,mats['hair'],(.012,.300,.198),(.15,.278,.169),.018)
    bar(h,mats['hair'],(.215,.292,-.058),(.237,.278,.025),.017)
    bar(h,ink,(.13,.017,.145),(.212,.02,.084),.008)
    ellipsoid(h,mats['hair'],(-.065,.40,-.015),(.28,.19,.28))
    for i in range(8):
        a=i*2.399
        bpy.ops.mesh.primitive_cone_add(vertices=5,radius1=.105,radius2=.012,depth=.31,location=xyz((-.03+math.cos(a)*.21,.48+(.025*(i%3)),math.sin(a)*.2)))
        o=bpy.context.object;o.rotation_euler[1]=-.3-(i%3)*.18;finish(o,h,mats['hair'],False)
    bar(h,cloth,(-.23,.33,.21),(.16,.34,.21),.039)
    if idx==1:
        for y,x in [(0.19,-.33),(-.04,-.39),(-.28,-.42)]:ellipsoid(h,mats['hair'],(x,y,-.1),(.105,.19,.105))
        box(h,gold,(-.33,.22,.01),(.06,.09,.035),.009)
    # Overlapping anatomical joints, tapered limbs, separate cuffs and actual knuckle geometry.
    for side in ['F','B']:
        p=parts['upperArm'+side];loft(p,sk,[(0,.175,.18,0),(.14,.22,.2,0),(.38,.19,.17,0),(.59,.14,.14,0)])
        ellipsoid(p,sk,(0,.59,0),(.145,.145,.145),12,8)
        loft(p,cloth,[(-.015,.20,.2,0),(.08,.235,.215,0),(.27,.213,.195,0),(.32,.196,.185,0)])
        p=parts['forearm'+side];loft(p,sk,[(0,.145,.145,0),(.12,.177,.16,0),(.34,.15,.145,0),(.55,.11,.115,0)])
        loft(p,iv,[(.32,.154,.149,0),(.47,.136,.135,0),(.56,.12,.128,0)])
        for y in [.36,.415,.47,.53]:loft(p,pants,[(y,.15-(y-.36)*.16,.148-(y-.36)*.11,0),(y+.012,.15-(y-.36)*.16,.148-(y-.36)*.11,0)])
        p=parts['hand'+side];box(p,cloth,(0,.04,0),(.285,.24,.255),.07)
        for x in [-.085,-.027,.032,.09]:ellipsoid(p,iv,(x,.155,.027),(.035,.06,.095),10,6)
        ellipsoid(p,sk,(.145,-.003,.04),(.065,.10,.07),10,6)
        p=parts['thigh'+side];loft(p,pants,[(0,.215,.22,0),(.13,.25,.23,0),(.47,.235,.21,0),(.77,.16,.165,0)])
        ellipsoid(p,pants,(0,.77,0),(.168,.165,.173),12,8)
        bar(p,cloth,(-.135,.12,.185),(-.135,.64,.17),.028)
        for yy in [.24,.38]:bar(p,ink,(.16,yy,.18),(.12,yy+.09,.18),.012)
        p=parts['shin'+side];loft(p,pants,[(0,.16,.165,0),(.18,.18,.17,0),(.47,.145,.15,0),(.77,.095,.115,0)])
        loft(p,iv,[(.54,.134,.146,0),(.76,.106,.13,0),(.80,.105,.13,0)])
        for yy in [.57,.63,.69,.75]:loft(p,pants,[(yy,.132-(yy-.57)*.13,.145-(yy-.57)*.065,0),(yy+.013,.13-(yy-.57)*.13,.145-(yy-.57)*.065,0)])
        p=parts['foot'+side];box(p,sole,(.13,.08,.0),(.56,.14,.29),.055)
        box(p,cloth,(.13,.19,0),(.51,.19,.275),.06)
        box(p,iv,(.29,.2,.001),(.15,.14,.278),.035)
        for x in [.04,.105,.17]:bar(p,iv,(x,.288,-.09),(x,.288,.09),.016)
    loft(parts['tail'],cloth,[(0,.073,.026,0),(.2,.064,.025,.04),(.55,.05,.024,.12),(.67,.015,.018,.15)])
    for p in parts.values():merge_part(p)
    # Editable source pose: axes and named control nodes form the rigid animation rig.
    rests={'pelvis':(0,1.56,0),'torso':(0,1.65,0),'head':(.08,2.77,0),
        'upperArmF':(.1,2.52,.30),'forearmF':(.36,2.01,.34),'handF':(.65,2.45,.4),
        'upperArmB':(-.15,2.5,-.26),'forearmB':(-.27,1.93,-.23),'handB':(.06,2.38,.03),
        'thighF':(.1,1.55,.17),'shinF':(.52,.91,.18),'footF':(.54,0,.18),
        'thighB':(-.1,1.55,-.17),'shinB':(-.28,.80,-.17),'footB':(-.65,0,-.17),'tail':(-.17,1.67,-.23)}
    for key,pos in rests.items():parts[key].location=xyz(pos)
    for key,child in [('upperArmF','forearmF'),('forearmF','handF'),('upperArmB','forearmB'),('forearmB','handB'),('thighF','shinF'),('shinF','footF'),('thighB','shinB'),('shinB','footB')]:
        parts[key].rotation_mode='QUATERNION';parts[key].rotation_quaternion=(parts[child].location-parts[key].location).to_track_quat('Z','Y')
    parts['tail'].rotation_euler[1]=math.pi
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'-rig-v2.glb')),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
    root.location.x=(idx-1)*3.8

# The .blend is retained as the source asset: posed lineup and studio setup, not a runtime dependency.
floor_mat=material('Studio slate',(.08,.115,.14))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.data.materials.append(floor_mat)
for loc,energy,size in [((2,-5,7),1500,7),((-6,-2,4),950,5),((3,4,6),1900,5)]:
    bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=energy;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1.8))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,-16,5.8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=12.5
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1440;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world.color=(.23,.25,.28)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'crosswind-fighters.blend'))
print('FURY_ASSETS_DONE',[(p.name,p.stat().st_size) for p in OUT.glob('*-rig-v2.glb')])
