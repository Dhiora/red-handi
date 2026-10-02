"""Build Red Handi's editable 3D cartoon, bake its animation, and export a web GLB.
Run: Blender --background --python art/restaurant/build_scene.py -- PROJECT_ROOT
Coordinates: Blender +Z up; host faces -Y. Timeline: 1–241 welcome, 241–481 delivery.
"""
import bpy, math, random, sys
from pathlib import Path
from mathutils import Vector
R=Path(sys.argv[sys.argv.index('--')+1]).resolve()
OUT=R/'frontend/public/models';OUT.mkdir(parents=True,exist_ok=True)
ART=R/'art/restaurant';ART.mkdir(parents=True,exist_ok=True)
random.seed(27)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=481

def mat(name,color,metal=0,rough=.65,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
skin=mat('Warm caramel skin',(.64,.32,.15));skinlight=mat('Palm highlights',(.78,.43,.23));black=mat('Black cotton uniform',(.012,.016,.022));pants=mat('Black trousers',(.019,.023,.031));hair=mat('Espresso hair',(.028,.018,.021));white=mat('Warm ivory',(.96,.90,.77));eye=mat('Eyes white',(.99,.985,.93),rough=.24);pupil=mat('Espresso pupils',(.028,.016,.012),rough=.18);red=mat('Red Handi red',(.40,.009,.006));copper=mat('Brushed copper',(.62,.24,.07),.62,.3);gold=mat('Brass details',(.73,.46,.12),.65,.3);wood=mat('Walnut wood',(.19,.067,.026));oak=mat('Honey oak',(.42,.20,.07));cream=mat('Warm plaster',(.33,.22,.13));green=mat('Deep forest tile',(.028,.095,.082),rough=.36);darkgreen=mat('Cabinet green',(.018,.053,.045));grout=mat('Grout',(.2,.22,.17));floorA=mat('Terracotta floor',(.43,.22,.13));floorB=mat('Sand floor',(.55,.34,.20));lamp=mat('Warm bulbs', (1,.56,.17), emission=3);leaf=mat('Fresh coriander',(.07,.22,.025));rice=mat('Basmati rice',(.92,.72,.33));saffron=mat('Saffron rice',(.9,.35,.02));pink=mat('Lip & ear warmth',(.46,.16,.1));steam=mat('Soft cream steam',(.78,.75,.66));steel=mat('Steel',(.3,.34,.33),.7,.35)

def parent(obj,p):
 if p:obj.parent=p
 return obj

def empty(name,loc=(0,0,0),p=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;return parent(o,p)

def finish(o,name,loc,scale,m,p=None):
 o.name=name;o.location=loc;o.scale=scale;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return parent(o,p)

def ball(name,loc,scale,m,p=None,seg=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=12);return finish(bpy.context.object,name,loc,scale,m,p)

def box(name,loc,scale,m,p=None,bevel=.06):
 bpy.ops.mesh.primitive_cube_add();o=finish(bpy.context.object,name,loc,scale,m,p)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Soft cartoon corners','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def cyl(name,loc,r,depth,m,p=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=depth);return finish(bpy.context.object,name,loc,(1,1,1),m,p)

def rod(name,a,b,r,m,p=None):
 mid=(Vector(a)+Vector(b))/2;o=cyl(name,mid,r,(Vector(b)-Vector(a)).length,m,p);o.rotation_mode='QUATERNION';o.rotation_quaternion=(Vector(b)-Vector(a)).to_track_quat('Z','Y');return o

def torus(name,loc,r,t,m,p=None,rot=None):
 bpy.ops.mesh.primitive_torus_add(major_segments=36,minor_segments=8,major_radius=r,minor_radius=t);o=finish(bpy.context.object,name,loc,(1,1,1),m,p)
 if rot:o.rotation_euler=rot
 return o

def text(name,value,loc,size,m,p=None):
 curve=bpy.data.curves.new(name,'FONT');curve.body=value;curve.align_x='CENTER';curve.size=size;curve.extrude=.004;curve.bevel_depth=.0015
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(m);parent(o,p)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

def curve(name,pts,r,m,p=None):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,co in zip(sp.bezier_points,pts):b.co=co;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);cu.materials.append(m);parent(o,p);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

# The full room extends past the camera; no floating card or frame.
box('Floor base',(0,0,-.18),(12,12,.16),floorA,bevel=.02)
for x in range(-7,8):
 for y in range(-5,7):box('Floor tile',(x*1.08,y*1.08,-.01),(.532,.532,.02),floorA if (x+y)%2 else floorB,bevel=.012)
box('Back plaster wall',(0,5.05,3.2),(9,.18,3.2),cream)
box('Left plaster wall',(-7,0,3.2),(.18,5.1,3.2),cream)
box('Kitchen tiled wall',(0,4.82,1.8),(6.2,.04,1.45),grout)
for x in range(-10,11):
 for z in range(6):box('Glazed green subway tile',(x*.57+(z%2)*.285,4.75,.5+z*.44),(.277,.055,.212),green,bevel=.025)
box('Kitchen cabinet',(0,3.8,.82),(3.35,.65,.8),darkgreen)
for x in [-2.75,-1.65,-.55,.55,1.65,2.75]:
 box('Cabinet frame',(x,3.135,.85),(.50,.035,.65),green);rod('Brass handle',(x-.15,3.075,1.15),(x+.15,3.075,1.15),.022,gold)
box('Stone counter',(0,3.8,1.7),(3.52,.77,.1),white)
# The central cooking island is behind the host, chef visible above it.
box('Island',(1,2.6,.77),(1.6,.48,.73),darkgreen)
for x in [-.25,.4,1.05,1.7,2.35]:box('Island fluting',(x,2.1,.79),(.022,.026,.65),gold,bevel=.012)
box('Island counter',(1,2.6,1.54),(1.75,.61,.1),white)
box('RedHandi sign',(0,4.68,3.72),(1.58,.09,.52),red,bevel=.16)
text('Wall brand','REDHANDI',(0,4.57,3.79),.38,white);text('Wall tagline','DUM. SPICE. EVERYTHING NICE.',(0,4.57,3.5),.095,gold)
for x in [-3.8,3.8]:
 box('Shelf',(x,4.37,3.2),(.8,.38,.05),wood)
 for i in range(4):
  px=x-.6+i*.39;cyl('Spice jar',(px,4.32,3.43),.125,.38,[red,saffron,rice,leaf][i]);cyl('Jar lid',(px,4.32,3.63),.135,.045,gold)
for x in [-3.2,3.3]:
 rod('Pendant cord',(x,1.6,4.25),(x,1.6,6),.017,black)
 bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.5,radius2=.15,depth=.36);finish(bpy.context.object,'Copper pendant',(x,1.6,4.3),(1,1,1),copper)
 cyl('Pendant glow',(x,1.6,4.11),.42,.025,lamp)
# Left seating, arch-like recess, plants and wall art.
box('Velvet banquette',(-4.65,2.15,.54),(1.3,.58,.22),red,bevel=.18);box('Banquette back',(-4.65,2.63,1.2),(1.3,.15,.68),red,bevel=.15)
for x in [-5.5,-4.95,-4.4,-3.85]:box('Seat seam',(x,2.46,1.23),(.015,.013,.5),gold,bevel=.01)
cyl('Dining table',(-4.65,.8,1.1),1,.12,oak);cyl('Table pedestal',(-4.65,.8,.55),.095,1.1,black);cyl('Table foot',(-4.65,.8,.04),.45,.07,black)
for x in [-5.0,-4.3]:
 cyl('Dining plate',(x,.8,1.18),.24,.035,white);torus('Plate rim',(x,.8,1.2),.2,.015,gold)
for x,y in [(4.6,3.7),(-3.5,4.1)]:
 cyl('Terracotta plant pot',(x,y,.32),.3,.62,copper)
 for i in range(9):
  a=i*2.4;rod('Plant stem',(x,y,.5),(x+.4*math.cos(a),y+.35*math.sin(a),1.6+random.random()*.5),.016,leaf)
  o=ball('Broad plant leaf',(x+.4*math.cos(a),y+.35*math.sin(a),1.55+random.random()*.5),(.17,.055,.42),leaf);o.rotation_euler=(.3*math.cos(a),.5*math.sin(a),a)
# Biryani pot: individually modeled rice and garnish.
cyl('Burner',(1,2.55,1.68),.62,.09,black);torus('Gas fire',(1,2.55,1.76),.44,.03,lamp)
ball('Copper handi',(1,2.55,2.02),(.66,.61,.39),copper);cyl('Handi opening',(1,2.55,2.24),.57,.07,rice);torus('Handi lip',(1,2.55,2.28),.59,.055,gold)
for dx in [-.76,.76]:torus('Pot handle',(1+dx,2.55,2.12),.17,.038,gold,rot=(math.pi/2,0,0))
for i in range(150):
 a=random.random()*math.tau;r=.52*math.sqrt(random.random());o=ball('Basmati grain',(1+r*math.cos(a),2.55+r*math.sin(a),2.28+random.random()*.065),(.018,.052,.015),rice if i%4 else saffron,seg=8);o.rotation_euler.z=random.random()*math.tau
for i in range(9):
 a=i*2.4;r=.35;o=ball('Biryani spice',(1+r*math.cos(a),2.55+r*math.sin(a),2.32),(.07,.09,.035),leaf if i%2 else copper,seg=12)
for x in [-.15,2.1]:
 cyl('Prep bowl',(x,2.4,1.72),.2,.16,white);ball('Fresh garnish',(x,2.4,1.81),(.17,.17,.035),leaf)

# Rich reference set: red feature wall, wood, menu boards, copper and an open kitchen.
box('Red feature wall',(-4.65,4.58,2.9),(1.36,.07,2.45),red,bevel=.035)
decal_dummy=None
# Large typographic wall logo and handi emblem are real extruded geometry.
text('Feature RED','RED',(-4.65,4.47,3.66),.66,white)
text('Feature HANDI','HANDI',(-4.65,4.47,3.00),.53,white)
text('Feature CHICKEN BIRYANI','CHICKEN BIRYANI',(-4.65,4.47,2.66),.125,gold)
curve('Feature steam',[(-4.75,4.43,4.24),(-4.62,4.43,4.43),(-4.73,4.43,4.62)],.035,gold)
curve('Feature handi',[(-5.1,4.43,4.17),(-4.65,4.43,4.01),(-4.2,4.43,4.17)],.04,white)
rod('Feature handi rim',(-5.10,4.43,4.2),(-4.20,4.43,4.2),.04,white)
# Wooden counter panels and rail replace the plain central island.
for x in [-.3,.3,.9,1.5,2.1]:
 box('Oak island panel',(x,2.065,.82),(.285,.035,.60),wood,bevel=.025)
 for i in range(3):rod('Wood grain',(x-.19+i*.17,2.021,.3),(x-.20+i*.17,2.021,1.30),.004,oak)
text('Counter brand','RED HANDI',(1,2.012,.87),.20,white)
text('Counter tagline','CHICKEN BIRYANI',(1,2.011,.66),.073,gold)
# Stainless extractor hood and overhead open shelving.
box('Stainless extractor hood',(1.3,4.28,3.52),(1.15,.37,.15),steel,bevel=.06)
box('Extractor chimney',(1.3,4.65,4.23),(.53,.18,.58),steel,bevel=.04)
for x in [.5,.7,.9,1.1,1.3,1.5,1.7,1.9,2.1]:box('Hood vent',(x,3.9,3.51),(.025,.009,.07),black,bevel=.005)
# Shelves of stacked dishes and copper jars.
for x in [-2.5,3.45]:
 box('Lower kitchen shelf',(x,4.2,2.42),(.65,.34,.04),oak)
 for j in range(3):
  px=x-.42+j*.42;cyl('Copper jar',(px,4.1,2.62),.13,.31,copper);cyl('Copper jar lid',(px,4.1,2.79),.14,.035,gold);ball('Copper jar knob',(px,4.1,2.835),(.04,.04,.035),gold)
rod('Utensil rail',(-2.9,4.25,3.02),(-1.7,4.25,3.02),.022,gold)
for x in [-2.7,-2.35,-2.0]:
 rod('Hanging utensil',(x,4.23,3),(x,4.23,2.62),.018,steel);ball('Utensil bowl',(x,4.23,2.57),(.065,.025,.1),steel)
# Foreground tables, upholstered chairs and menu stands.
def dining_set(x,y):
 box('Square wood tabletop',(x,y,1.03),(.72,.56,.065),oak,bevel=.055);cyl('Table post',(x,y,.5),.07,1,black);cyl('Table round foot',(x,y,.045),.35,.06,black)
 for side in [-1,1]:
  cx=x+side*.96;box('Red chair cushion',(cx,y,.53),(.29,.29,.09),red,bevel=.07)
  box('Red chair back',(cx+side*.23,y,1.02),(.065,.29,.40),red,bevel=.07)
  for dy in [-.23,.23]:
   for dx in [-.23,.23]:rod('Chair wood leg',(cx+dx,y+dy,.04),(cx+dx*.95,y+dy*.95,.51),.035,wood)
  for dy in [-.17,0,.17]:rod('Upholstery piping',(cx+side*.163,y+dy,.73),(cx+side*.163,y+dy,1.3),.006,gold)
 # Table menu: branded tent stand with actual local food photography.
 box('Menu tent',(x+.22,y+.12,1.30),(.115,.03,.20),black,bevel=.008)
 text('Menu stand title','RED HANDI',(x+.22,y+.084,1.4),.034,gold)
 cyl('Table plant pot',(x-.30,y+.12,1.20),.095,.21,copper)
 for i in range(5):
  a=i*1.26;o=ball('Table plant leaf',(x-.3+math.cos(a)*.07,y+.12+math.sin(a)*.07,1.40),(.025,.045,.14),leaf);o.rotation_euler.y=math.cos(a)*.6
 for xx in [x-.35,x+.35]:cyl('Table plate',(xx,y-.23,1.12),.17,.026,white)
dining_set(-3.0,-1.6);dining_set(4.3,.5)
# Food menu boards above the kitchen, with the existing restaurant photo as a texture.
foodmat=mat('Food photography',(1,1,1));tn=foodmat.node_tree.nodes.new('ShaderNodeTexImage');tn.image=bpy.data.images.load(str(R/'frontend/public/food.jpg'));tn.image.pack();foodmat.node_tree.links.new(tn.outputs['Color'],foodmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for x in [-2.25,2.25]:
 box('Framed food board',(x,4.56,4.62),(.87,.075,.57),wood,bevel=.03)
 bpy.ops.mesh.primitive_plane_add(size=1);o=finish(bpy.context.object,'Biryani menu photo',(x,4.477,4.67),(1.58,.87,1),foodmat);o.rotation_euler=(math.pi/2,0,0)
 text('Board description','DUM BIRYANI',(x,4.47,4.20),.09,gold)
# Move center sign up to the menu-board row.
for name in ['RedHandi sign','Wall brand','Wall tagline']:bpy.data.objects[name].location.z+=.87
# Character modeling follows the supplied Red Handi reference: polo, cap, apron, sneakers.
def logo_material(name,white_logo=False):
 m=mat(name,(1,1,1));n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(R/'frontend/public/logo.png'),check_existing=True);n.image.pack();pr=m.node_tree.nodes.get('Principled BSDF')
 if not white_logo:m.node_tree.links.new(n.outputs['Color'],pr.inputs['Base Color'])
 m.node_tree.links.new(n.outputs['Alpha'],pr.inputs['Alpha']);m.surface_render_method='DITHERED';return m
brand=logo_material('Actual RedHandi logo');capbrand=logo_material('White embroidered logo',True)
def decal(name,loc,size,m,p):
 bpy.ops.mesh.primitive_plane_add(size=1);o=finish(bpy.context.object,name,loc,(size,size,size),m,p);o.rotation_euler=(math.pi/2,0,0);return o

def garment(name,rings,m,p):
 verts=[];faces=[];N=32
 for z,rx,ry in rings:
  for i in range(N):a=i*math.tau/N;verts.append((rx*math.cos(a),ry*math.sin(a),z))
 for row in range(len(rings)-1):
  for i in range(N):j=(i+1)%N;faces.append((row*N+i,row*N+j,(row+1)*N+j,(row+1)*N+i))
 faces.append(tuple(reversed(range(N))));faces.append(tuple((len(rings)-1)*N+i for i in range(N)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(m);parent(o,p)
 for f in mesh.polygons:f.use_smooth=True
 return o

def character(name,loc,chef=False,scale=1):
 root=empty(name,loc);root.scale=(scale,)*3;body=empty(name+'_body',(0,0,0),root);uniform=white if chef else red
 ball(name+'_hips',(0,0,1.42),(.31,.205,.21),pants,body)
 garment(name+'_tailored_shirt',[(1.42,.31,.20),(1.62,.34,.23),(2.05,.39,.24),(2.23,.40,.21),(2.40,.24,.16)],uniform,body)
 cyl(name+'_neck',(0,0,2.44),.115,.24,skin,body)
 # Folded polo collar and placket.
 for side in [-1,1]:
  o=box(name+'_collar',(side*.13,-.16,2.36),(.105,.035,.13),uniform,body,bevel=.025);o.rotation_euler.y=side*-.4
 box(name+'_shirt_placket',(0,-.239,2.22),(.025,.008,.15),uniform,body,bevel=.01)
 for z in [2.29,2.19]:ball(name+'_shirt_button',(0,-.254,z),(.017,.012,.017),black,body,seg=12)
 head=empty(name+'_head',(0,0,2.82),body);head.scale=(.80,)*3
 ball(name+'_face',(0,0,0),(.415,.325,.48),skinlight,head)
 for side in [-1,1]:
  ball(name+'_ear',(side*.414,0,-.015),(.087,.065,.13),skin,head);ball(name+'_ear_inner',(side*.44,-.046,-.015),(.035,.018,.065),pink,head)
  ball(name+'_eye_white',(side*.16,-.286,.045),(.109,.053,.127),eye,head)
  ball(name+'_iris',(side*.15,-.334,.03),(.058,.029,.072),pupil,head)
  ball(name+'_eye_glint',(side*.15-.018,-.360,.06),(.016,.008,.02),eye,head,seg=12)
  curve(name+'_brow',[(side*.25,-.3,.215),(side*.18,-.326,.24),(side*.09,-.316,.215)],.025,hair,head)
 ball(name+'_nose',(0,-.324,-.085),(.07,.085,.077),skinlight,head)
 if chef:
  # Thick shaped beard with an inset smiling mouth.
  ball('Chef full beard',(0,-.09,-.26),(.355,.285,.24),hair,head)
  ball('Chef mouth inset',(0,-.344,-.195),(.15,.035,.095),skin,head)
  ball('Chef moustache L',(-.09,-.367,-.13),(.12,.04,.045),hair,head);ball('Chef moustache R',(.09,-.367,-.13),(.12,.04,.045),hair,head)
  cyl('Chef hat band',(0,0,.44),.38,.20,white,head)
  for x,y,z in [(-.25,0,.65),(0,-.06,.75),(.26,0,.65),(0,.17,.68)]:ball('Chef hat puff',(x,y,z),(.28,.27,.27),white,head)
 else:
  ball('Hair cap',(0,.045,.22),(.422,.325,.25),hair,head)
  for i in range(6):
   x=-.29+i*.10;o=ball('Side swept fringe',(x,-.23,.25+.055*math.sin(i*.7)),(.10,.12,.14),hair,head);o.rotation_euler.y=-.35
  for side in [-1,1]:ball('Sideburn',(side*.376,-.045,.085),(.043,.135,.18),hair,head)
  ball('Red baseball cap crown',(0,.02,.37),(.456,.35,.29),red,head)
  bill=ball('Curved baseball cap brim',(0,-.36,.26),(.43,.36,.038),red,head);bill.rotation_euler.x=.08
  torus('Cap band',(0,.02,.29),.415,.015,red,head).scale.y=.76
  ball('Cap top button',(0,.02,.651),(.035,.035,.024),red,head,seg=12)
  for x in [-.24,.24]:curve('Cap panel seam',[(x,-.23,.39),(x*.7,-.17,.54),(0,.02,.65)],.006,red,head)
  decal('Cap embroidery',(0,-.318,.44),.21,capbrand,head)
 curve(name+'_smile',[(-.14,-.305,-.20),(0,-.346,-.245),(.14,-.305,-.20)],.015,pink,head)
 ball(name+'_teeth',(0,-.335,-.213),(.107,.02,.031),eye,head)
 # Bib apron, skirt, straps, brass rivets, waist tie and pocket.
 box(name+'_apron_bib',(0,-.258,1.96),(.25,.032,.30),black,body,bevel=.035)
 box(name+'_apron_skirt',(0,-.243,1.44),(.325,.03,.32),black,body,bevel=.035)
 for side in [-1,1]:
  rod(name+'_apron_strap',(side*.22,-.26,2.20),(side*.23,-.13,2.4),.024,black,body)
  ball(name+'_apron_rivet',(side*.21,-.295,2.19),(.019,.01,.019),gold,body,seg=12)
  rod(name+'_waist_tie',(side*.32,-.22,1.73),(side*.31,.20,1.73),.02,black,body)
 box(name+'_apron_pocket',(0,-.28,1.38),(.18,.012,.105),pants,body,bevel=.015)
 curve(name+'_pocket_stitch',[(-.17,-.294,1.46),(-.17,-.294,1.29),(.17,-.294,1.29),(.17,-.294,1.46)],.004,oak,body)
 for side in [-1,1]:
  curve(name+'_back_bow',[(0,.225,1.74),(side*.14,.25,1.83),(side*.12,.26,1.7),(0,.225,1.74),(side*.08,.24,1.43)],.017,black,body)
 decal(name+'_apron_brand',(0,-.294,1.91),.35,brand,body)
 text(name+'_apron_wordmark','RED HANDI',(0,-.296,1.70),.053,white,body)
 limbs={}
 for side in [-1,1]:
  tag='left' if side<0 else 'right';shoulder=empty(name+'_'+tag+'_shoulder',(side*.38,0,2.23),body)
  ball(name+'_sleeve',(0,0,-.13),(.165,.18,.24),uniform,shoulder)
  rod(name+'_upper_arm',(0,0,-.18),(0,0,-.48),.088,skinlight,shoulder)
  elbow=empty(name+'_'+tag+'_elbow',(0,0,-.48),shoulder)
  rod(name+'_forearm',(0,0,0),(0,0,-.4),.073,skinlight,elbow);ball(name+'_elbow',(0,0,0),(.08,.08,.09),skinlight,elbow)
  hand=empty(name+'_'+tag+'_hand',(0,0,-.43),elbow);ball(name+'_palm',(0,0,-.06),(.10,.053,.12),skinlight,hand)
  for i in range(4):rod(name+'_finger',(-.065+i*.043,0,-.13),(-.065+i*.043,-.008,-.235+abs(i-1.5)*.018),.019,skinlight,hand)
  rod(name+'_thumb',(side*.07,0,-.06),(side*.145,0,-.13),.03,skinlight,hand)
  if side<0 and not chef:
   cyl('Watch strap',(0,0,-.34),.083,.075,black,elbow);ball('Watch face',(0,-.077,-.34),(.055,.018,.055),steel,elbow)
  hip=empty(name+'_'+tag+'_hip',(side*.175,0,1.44),body)
  rod(name+'_trousers',(0,0,-.03),(0,0,-1.10),.137,pants,hip)
  curve(name+'_trouser_seam',[(side*.134,0,-.14),(side*.134,0,-.55),(side*.134,0,-1.08)],.006,black,hip)
  ball(name+'_sneaker',(0,-.11,-1.28),(.16,.27,.12),black,hip);box(name+'_rubber_sole',(0,-.105,-1.35),(.16,.26,.028),white,hip,bevel=.033)
  for y in [-.08,-.14,-.20]:rod(name+'_shoelace',(-.075,y,-1.18),(.075,y,-1.18),.008,white,hip)
  limbs[tag]=(shoulder,elbow,hand,hip)
 return root,body,head,limbs
host,body,head,limbs=character('Host',(.8,-.65,0))
chef,cb,ch,cl=character('Chef',(1.7,3.65,0),True,1.04)
# A physical ticket travels with the hand. Three.js writes the confirmed order number on its face.
hand=limbs['left'][2];slip=empty('OrderSlip',(.02,-.1,-.02),hand)
box('Ticket paper',(0,0,0),(.18,.012,.27),white,slip,bevel=.01)
bpy.ops.mesh.primitive_plane_add(size=1);o=finish(bpy.context.object,'TicketFace',(0,-.014,0),(.34,.51,1),white,slip);o.rotation_euler=(math.pi/2,0,0)
# Ladle follows chef's right hand.
rod('Wooden ladle',(0,0,0),(0,-.6,-.25),.035,oak,cl['right'][2]);ball('Ladle bowl',(0,-.62,-.26),(.14,.16,.035),oak,cl['right'][2])
# Soft stylized curls of steam, keyframed in Blender.
steams=[]
for i in range(6):
 o=empty('Steam_'+str(i),(1+(i%3-1)*.22,2.55,2.37));curve('Steam wisp',[(0,0,0),(.06,0,.12),(-.04,0,.25),(.03,0,.38)],.016,steam,o);steams.append(o)

def key(o,field,frame):o.keyframe_insert(data_path=field,frame=frame)
# Bake a 16-second scene; clips are split into two named glTF animations after export.
for f in range(1,482,3):
 t=(f-1)/30;order=f>=241;u=max(0,min(1,(t-8)/6));smooth=u*u*(3-2*u)
 entrance=min(1,t/3.6);ease=entrance*entrance*(3-2*entrance)
 host.location=(.8-.65*smooth,-.65+2.18*smooth,0) if order else (.25+.55*ease,1.53-2.18*ease,0)
 host.rotation_euler.z=math.pi*min(1,u*3) if order else -.14*(1-ease)
 walking=(order and u<1) or (not order and entrance<1)
 body.location.z=.016*math.sin(t*math.tau)+(.027*abs(math.sin(t*9)) if walking else 0)
 head.rotation_euler=(.045*math.sin(t*2),.035*math.sin(t*1.5),.025*math.sin(t*1.3))
 for side,(shoulder,elbow,hand,hip) in limbs.items():
  if not order and entrance<1:
   phase=t*9+(math.pi if side=='left' else 0)
   shoulder.rotation_euler=(-.20*math.sin(phase),.08 if side=='left' else -.08,0)
   elbow.rotation_euler=(-.2,0,0)
   hip.rotation_euler=(.26*math.sin(phase),0,0)
  elif not order:
   shoulder.rotation_euler=(.12,.45 if side=='left' else -.48,0)
   elbow.rotation_euler=(0,1.45+.12*math.sin(t*2) if side=='left' else -.7+.1*math.sin(t*2),0)
   hip.rotation_euler=(0,.02*math.sin(t*2),0)
  else:
   moving=u<1;phase=t*9+(math.pi if side=='left' else 0)
   shoulder.rotation_euler=(.3*math.sin(phase) if moving and side=='right' else -.6,0,0)
   elbow.rotation_euler=(-1.5 if side=='left' else -.12,0,0)
   hip.rotation_euler=(.33*math.sin(phase) if moving else 0,0,0)
  key(shoulder,'rotation_euler',f);key(elbow,'rotation_euler',f);key(hip,'rotation_euler',f)
 slip.scale=(1,1,1) if order else (.001,.001,.001);key(slip,'scale',f)
 key(host,'location',f);key(host,'rotation_euler',f);key(body,'location',f);key(head,'rotation_euler',f)
 for side,(shoulder,elbow,hand,hip) in cl.items():
  shoulder.rotation_euler=(-.7+.12*math.sin(t*2),.15 if side=='right' else -.3,.12*math.cos(t*2));elbow.rotation_euler=(-.9,0,0);key(shoulder,'rotation_euler',f);key(elbow,'rotation_euler',f)
 ch.rotation_euler.z=.09*math.sin(t);key(ch,'rotation_euler',f)
 for i,o in enumerate(steams):
  phase=(t*.45+i/6)%1;o.location.z=2.35+phase*.8;o.scale=(1+phase*.5,)*3
  key(o,'location',f);key(o,'scale',f)
# Lights/camera are editable in the .blend; browser uses equivalent mobile-tuned lighting.
world=bpy.data.worlds.new('Kitchen ambience');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.26,.20,.15,1);world.node_tree.nodes['Background'].inputs[1].default_value=.25;scene.world=world
for name,loc,power,size,color in [('Soft key',(0,-4,6),1000,5,(1,.76,.53)),('Kitchen light',(2,2,5),750,4,(1,.63,.32)),('Cool fill',(-5,-1,4),420,5,(.66,.81,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,1,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.7,-9.8,4.6));cam=bpy.context.object;cam.name='Cinema Camera';cam.rotation_euler=(Vector((0,1.2,1.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=39;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.frame_set(55)
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'redhandi-restaurant.blend'))
# Join nonanimated geometry by parent to reduce draw calls, leaving the editable source untouched.
from collections import defaultdict
groups=defaultdict(list)
for obj in list(scene.objects):
 if obj.type=='MESH' and not obj.animation_data and obj.name!='TicketFace':groups[obj.parent].append(obj)
for p,objects in groups.items():
 if len(objects)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(OUT/'redhandi-restaurant.glb'),export_format='GLB',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True,export_frame_step=2,export_cameras=False,export_lights=False,export_apply=True)
# Poster is a fallback only; supported browsers render the actual interactive Blender geometry.
scene.frame_set(55);scene.render.filepath=str(OUT/'restaurant-poster.jpg');scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=85;bpy.ops.render.render(write_still=True)
print('REDHANDI_EXPORT_COMPLETE')
