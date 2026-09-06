"""Original low-cost beveled hard-surface assets. Blender 4.5, no external assets."""
import bpy, math, os
from mathutils import Vector
bpy.context.preferences.filepaths.save_version=0
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../shared/first-person/assets'))
def mat(name,c,metal=0,rough=.5,em=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if em:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=em
    return m
def reset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mesh(name,loc,size,m,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        b=o.modifiers.new('Machined edge','BEVEL');b.width=min(bevel,min(size)*.22);b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name);n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=n.name)
    return o
def cylinder(name,loc,r,depth,m,rot=(0,0,0),vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.data.materials.append(m)
    b=o.modifiers.new('Rim bevel','BEVEL');b.width=min(r*.1,.025);b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name);n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=n.name);return o
def rod(name,a,b,r,m):
    d=Vector(b)-Vector(a);o=cylinder(name,(Vector(a)+Vector(b))/2,r,d.length,m);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def export(name):
    # Immutable parts share a draw call per material; do not ship dozens of cubes.
    groups={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
    for key,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=key
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,name+'.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,name+'.glb'),export_format='GLB',export_yup=True,export_materials='EXPORT',export_animations=False)
paint=mat('Pearl ceramic',(.64,.75,.77),.62,.27);dark=mat('Graphite',(.025,.045,.055),.38,.36);rubber=mat('Tread rubber',(.014,.021,.027),.0,.8);glass=mat('Smoked glass',(.035,.105,.14),.7,.19);silver=mat('Brushed alloy',(.45,.54,.59),.8,.3);red=mat('Tail red',(.95,.048,.023),.2,.28,2);cyan=mat('Ion teal',(.13,.85,.92),.1,.25,2.3);amber=mat('Amber warning',(1,.42,.08),.1,.3,1.5);orange=mat('Warm ceramic',(.79,.34,.11),.42,.38)
reset()
# Blender -Y is forward; exported glTF +Z is forward, rotated by game for -Z.
mesh('Chassis',(0,0,.65),(1.86,4.35,.48),paint,.14);mesh('Undertray',(0,0,.41),(1.79,4.12,.22),dark,.08)
mesh('Bonnet',(0,-1.26,.97),(1.79,1.68,.24),paint,.1);c=mesh('Canopy',(0,.14,1.24),(1.49,1.64,.69),glass,.19);c.rotation_euler.x=.08
mesh('Roof',(0,.22,1.62),(1.37,1.12,.075),paint,.08)
for side in [-1,1]:
    mesh('Sill',(side*.96,0,.54),(.12,3.35,.22),dark,.025);mesh('Mirror',(side*1.07,-.42,1.29),(.3,.36,.19),paint,.05)
    for y in [-1.28,1.28]:
        cylinder('Tyre',(side*.94,y,.44),.4,.27,rubber,(0,math.pi/2,0),24);cylinder('Wheel rim',(side*1.085,y,.44),.26,.03,silver,(0,math.pi/2,0),12);cylinder('Hub',(side*1.11,y,.44),.1,.04,dark,(0,math.pi/2,0))
    mesh('Headlight',(side*.62,-2.19,.9),(.43,.055,.09),cyan,.02);mesh('Taillight',(side*.61,2.18,.84),(.57,.05,.105),red,.02)
    mesh('Spoiler support',(side*.57,1.77,1.08),(.065,.18,.5),dark,.018)
mesh('Wing',(0,1.9,1.31),(1.94,.36,.09),dark,.025)
for x in [-.24,.24]:mesh('Hood vent',(x,-1.45,1.096),(.22,.6,.016),dark,.005)
export('apex-car')
reset()
mesh('Receiver',(0,0,0),(.24,.72,.25),dark,.055);mesh('Ceramic shell',(0,-.08,.035),(.285,.46,.17),paint,.035);mesh('Front shroud',(0,-.49,-.015),(.21,.4,.18),dark,.035)
cylinder('Barrel',(0,-.77,.006),.044,.27,silver,(math.pi/2,0,0));cylinder('Muzzle',(0,-.94,.006),.07,.08,dark,(math.pi/2,0,0));cylinder('Bore',(0,-.987,.006),.034,.01,rubber,(math.pi/2,0,0))
mesh('Magazine',(0,.13,-.24),(.15,.21,.29),dark,.027).rotation_euler.x=-.14
mesh('Grip',(0,.37,-.22),(.14,.2,.32),dark,.035).rotation_euler.x=.2
mesh('Stock',(0,.56,-.04),(.21,.34,.21),dark,.05);mesh('Recoil pad',(0,.73,-.04),(.22,.08,.26),rubber,.035)
for x in [-.148,.148]:
    mesh('Ion chamber',(x,-.13,.03),(.014,.3,.035),cyan,.004)
    for y in [-.58,-.50,-.42,-.34]:mesh('Cooling rib',(x*.76,y,.093),(.01,.028,.11),silver,.004)
mesh('Sight base',(0,-.02,.18),(.12,.21,.055),dark,.01)
for x in [-.055,.055]:mesh('Sight post',(x,-.09,.245),(.018,.04,.12),dark,.005)
mesh('Sight crossbar',(0,-.09,.304),(.12,.035,.017),dark,.004)
mesh('Sight glass',(0,-.09,.248),(.09,.007,.072),glass,.0)
mesh('Upper rail',(0,-.37,.14),(.09,.37,.028),silver,.006)
for y in [-.5,-.43,-.36,-.29]:mesh('Rail notch',(0,y,.16),(.12,.022,.016),dark,.003)
export('pulse-rifle')
reset()
mesh('Drone core',(0,0,0),(.83,.6,.4),orange,.12);mesh('Drone face',(0,-.32,0),(.56,.08,.2),dark,.04);mesh('Drone eye',(0,-.369,.02),(.38,.014,.09),red,.013)
for x in [-.64,.64]:
    rod('Arm',(x*.55,0,0),(x,0,.035),.07,dark);cylinder('Turbine',(x,0,.05),.29,.16,dark);cylinder('Turbine rim',(x,0,.14),.24,.04,silver);cylinder('Rotor',(x,0,.17),.19,.025,rubber);cylinder('Ion engine',(x,0,-.06),.19,.018,cyan)
mesh('Sensor',(0,0,.29),(.13,.14,.19),dark,.02);export('ion-drone')
reset()
mesh('Crawler shell',(0,0,.0),(.93,.71,.41),dark,.1);mesh('Crawler armor',(0,.02,.19),(.75,.64,.16),orange,.09);mesh('Crawler eye',(0,-.38,.035),(.51,.034,.1),red,.02)
for s in [-1,1]:
    for j in [-1,0,1]:
        a=(s*.38,j*.23,0);b=(s*.82,j*.38,.12);c=(s*1.06,j*.49,-.48)
        rod('Upper leg',a,b,.055,silver);rod('Lower leg',b,c,.055,dark);cylinder('Joint',b,.09,.11,silver,(math.pi/2,0,0));mesh('Foot',c,(.17,.19,.07),rubber,.02)
export('crawler')
reset()
cylinder('Base',(0,0,.2),.58,.4,dark);cylinder('Collar',(0,0,.48),.32,.2,silver);mesh('Turret',(0,-.02,.78),(.83,.71,.55),orange,.12);mesh('Mask',(0,-.4,.8),(.71,.1,.29),dark,.05)
for x in [-.22,.22]:cylinder('Gun barrel',(x,-.67,.75),.072,.47,dark,(math.pi/2,0,0));cylinder('Tip',(x,-.91,.75),.046,.02,red,(math.pi/2,0,0))
mesh('Eye',(0,-.464,.95),(.4,.02,.06),red,.01);export('sentry')
print('Exported five original model families to',ROOT)
