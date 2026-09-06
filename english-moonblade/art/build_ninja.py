"""Original Moonblade rigid-joint GLB assets. Blender 4.5 LTS, offline only.
Y-up helper coordinates; vertex-colored single-material parts keep draw calls low.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parents[1]/'assets'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def xyz(p):return (p[0],-p[2],p[1])
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def mat(name,c,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*[linear(v) for v in c],1);b.inputs['Roughness'].default_value=.57;b.inputs['Metallic'].default_value=metal
    return m
def node(name,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def done(o,p,m):
    o.parent=p;o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o
def loft(p,m,rings,n=12):
    vs=[];fs=[]
    for y,rx,rz,ox in rings:
        for j in range(n):
            a=j*math.tau/n;vs.append(xyz((ox+math.cos(a)*rx,y,math.sin(a)*rz)))
    for i in range(len(rings)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,a+n,b+n,b))
    fs.extend([tuple(range(n)),tuple((len(rings)-1)*n+j for j in reversed(range(n)))])
    mesh=bpy.data.meshes.new('Sculpt');mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('Surface',mesh);bpy.context.collection.objects.link(o);return done(o,p,m)
def ball(p,m,pos,size,n=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=8,location=xyz(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return done(o,p,m)
def box(p,m,pos,size):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft edges','BEVEL');mod.width=.025;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name);return done(o,p,m)
def rod(p,m,a,b,r):
    d=Vector(xyz(b))-Vector(xyz(a));bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(Vector(xyz(a))+Vector(xyz(b)))/2);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');return done(o,p,m)
def merge(p,surface):
    meshes=[o for o in p.children if o.type=='MESH']
    if not meshes:return
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        colors=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for poly in o.data.polygons:
            col=o.data.materials[poly.material_index].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
            for i in poly.loop_indices:colors.data[i].color=col
        o.data.materials.clear();o.data.materials.append(surface);o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name=p.name+'_mesh';o.data.materials.clear();o.data.materials.append(surface)
    for f in o.data.polygons:f.material_index=0

for idx,name in enumerate(['shinobi','warden','abbot']):
    root=node(name)
    surface=mat(name+'_vertex',(.85,.85,.85));b=surface.node_tree.nodes.get('Principled BSDF');vc=surface.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';surface.node_tree.links.new(vc.outputs['Color'],b.inputs['Base Color'])
    cloth=mat(name+'_indigo',[(.16,.24,.33),(.31,.27,.29),(.36,.17,.18)][idx]);dark=mat(name+'_shadow',(.06,.085,.13));red=mat(name+'_scarf',[(.74,.13,.18),(.57,.38,.13),(.81,.50,.16)][idx]);wrap=mat(name+'_wrap',(.6,.64,.65));gold=mat(name+'_brass',(.72,.5,.22));skin=mat(name+'_skin',(.74,.51,.34));steel=mat(name+'_steel',(.73,.85,.9));ink=mat(name+'_ink',(.01,.018,.026))
    names=['pelvis','torso','head','upperArmF','forearmF','handF','upperArmB','forearmB','handB','thighF','shinF','footF','thighB','shinB','footB','scarfA','scarfB','sword']
    p={k:node(name+'__'+k,root) for k in names}
    loft(p['pelvis'],dark,[(-.14,.28,.22,0),(.12,.30,.22,0),(.24,.26,.21,0)])
    loft(p['torso'],cloth,[(0,.23,.18,0),(.3,.30,.23,0),(.65,.37,.22,.01),(.89,.34,.21,0),(.98,.14,.13,0)],16)
    # Individual lamellar chest plates and visible tailored edge seams.
    for y,w in [(.22,.43),(.38,.49),(.54,.53),(.70,.53)]:box(p['torso'],dark,(.015,y,.223),(w,.135,.065));rod(p['torso'],gold,(-w/2,y-.06,.262),(w/2,y-.06,.262),.009)
    rod(p['torso'],wrap,(-.26,.83,.245),(.20,.04,.253),.031)
    box(p['torso'],red,(0,.05,0),(.55,.15,.48));box(p['torso'],gold,(.14,.06,.25),(.095,.105,.03))
    h=p['head'];ball(h,cloth,(0,.19,0),(.23,.35,.215),16)
    ball(h,skin,(.115,.23,.17),(.125,.072,.043));rod(h,ink,(.035,.255,.207),(.16,.245,.199),.013);ball(h,ink,(.143,.24,.21),(.018,.017,.012))
    loft(h,dark,[(-.1,.11,.12,0),(.02,.19,.21,.06),(.19,.23,.235,.015)],16)
    rod(h,red,(-.23,.39,.17),(.18,.39,.18),.031)
    # Enemy silhouettes: broad iron hat, and the boss's taller horned headguard.
    if idx==1:loft(h,dark,[(.39,.48,.43,0),(.53,.29,.28,0),(.70,.02,.02,0)],18)
    if idx==2:
        for x in [-.19,.19]:rod(h,gold,(x,.35,.08),(x*1.6,.70,.03),.038)
        box(h,gold,(.01,.36,.215),(.09,.22,.045))
    for s in ['F','B']:
        loft(p['upperArm'+s],cloth,[(0,.19,.18,0),(.17,.205,.19,0),(.45,.15,.14,0),(.59,.125,.125,0)])
        ball(p['upperArm'+s],dark,(0,.59,0),(.13,.13,.13))
        loft(p['upperArm'+s],dark,[(.02,.22,.21,0),(.21,.225,.21,0),(.30,.195,.18,0)])
        loft(p['forearm'+s],cloth,[(0,.13,.13,0),(.2,.16,.145,0),(.55,.10,.10,0)])
        for y in [.30,.36,.42,.48,.54]:loft(p['forearm'+s],wrap,[(y,.135-(y-.3)*.10,.13,0),(y+.028,.132-(y-.3)*.1,.13,0)])
        box(p['hand'+s],dark,(0,.035,0),(.23,.20,.22));ball(p['hand'+s],skin,(.11,.01,.04),(.045,.078,.052))
        loft(p['thigh'+s],cloth,[(0,.20,.20,0),(.22,.215,.20,0),(.57,.18,.17,0),(.77,.135,.135,0)])
        ball(p['thigh'+s],dark,(0,.77,0),(.15,.145,.15))
        loft(p['shin'+s],cloth,[(0,.135,.135,0),(.2,.16,.15,0),(.55,.11,.12,0),(.77,.085,.105,0)])
        for y in [.49,.55,.61,.67,.73]:loft(p['shin'+s],wrap,[(y,.123,.13,0),(y+.03,.122,.13,0)])
        box(p['foot'+s],dark,(.11,.12,0),(.46,.22,.25));rod(p['foot'+s],wrap,(-.06,.05,.13),(.31,.05,.13),.011)
    for n,l in [('scarfA',.48),('scarfB',.46)]:loft(p[n],red,[(0,.082,.027,0),(l*.5,.095,.022,.025),(l,.07,.017,.04)],8)
    rod(p['sword'],dark,(0,-.2,0),(0,.08,0),.046);box(p['sword'],gold,(0,.07,0),(.24,.035,.10))
    loft(p['sword'],steel,[(.08,.039,.02,0),(.55,.033,.016,.04),(1.02,.027,.012,.13),(1.28,.001,.003,.22)],8)
    # Sheathed second blade behind the torso, not an unrelated floating prop.
    rod(p['torso'],dark,(-.31,-.12,-.24),(.33,1.02,-.24),.055);rod(p['torso'],gold,(.25,.88,-.24),(.39,1.12,-.24),.047)
    for n in names:merge(p[n],surface)
    rests={'pelvis':(0,1.55,0),'torso':(0,1.55,0),'head':(.06,2.77,0),'upperArmF':(.1,2.47,.25),'forearmF':(.34,1.93,.28),'handF':(.66,2.37,.32),'upperArmB':(-.15,2.46,-.25),'forearmB':(-.4,1.92,-.24),'handB':(-.1,2.34,-.2),'thighF':(.05,1.55,.18),'shinF':(.55,.96,.18),'footF':(.49,0,.18),'thighB':(-.05,1.55,-.18),'shinB':(-.12,.78,-.18),'footB':(-.56,0,-.18),'scarfA':(-.14,2.70,-.16),'scarfB':(-.60,2.6,-.16),'sword':(.67,2.37,.33)}
    for k,pos in rests.items():p[k].location=xyz(pos)
    for a,bn in [('upperArmF','forearmF'),('forearmF','handF'),('upperArmB','forearmB'),('forearmB','handB'),('thighF','shinF'),('shinF','footF'),('thighB','shinB'),('shinB','footB')]:p[a].rotation_mode='QUATERNION';p[a].rotation_quaternion=(p[bn].location-p[a].location).to_track_quat('Z','Y')
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False)
    root.location.x=idx*3.8
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'moonblade-cast.blend'))
print('MOONBLADE_ASSETS_READY')
