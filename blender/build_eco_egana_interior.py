"""Editable, furnished interpretation of the official Eco Egaña Norte C plan.

Run: blender -b --python blender/build_eco_egana_interior.py
Run only manifest: python blender/build_eco_egana_interior.py --manifest-only
All linear dimensions are inferred. Only the areas are officially published.
"""
from pathlib import Path
import math
import json
import sys
import random

ROOT=Path(__file__).resolve().parent.parent
MODELS=ROOT/'public/models'
OUT=ROOT/'blender'
MODELS.mkdir(parents=True,exist_ok=True)
random.seed(18)

def rect(x0,x1,z0,z1):
    return [{'x':x0,'z':z0},{'x':x1,'z':z0},{'x':x1,'z':z1},{'x':x0,'z':z1}]

walls=[]
def wall(id,x,z,width,depth,height=2.65,base=0,category='partition'):
    walls.append({'id':id,'objectName':'Wall_'+id,'x':x,'z':z,'width':width,'depth':depth,
                  'height':height,'base':base,'rotation':0,'category':category})

# Main shell has a recessed centre entrance and a full-width front terrace.
wall('external_left',-4.55,0,.15,6.15,category='external')
wall('external_right',4.55,0,.15,6.15,category='external')
wall('rear_left',-3.125,-3.075,2.85,.15,category='external')
wall('rear_right',3.55,-3.075,2.1,.15,category='external')
wall('entry_left_return',-1.725,-3.40,.15,.8,category='external')
wall('entry_right_return',2.475,-3.40,.15,.8,category='external')
wall('entry_rear_left',-.35,-3.775,2.65,.15,category='external')
wall('entry_rear_right',2.05,-3.775,.70,.15,category='external')
wall('entry_door_header',1.20,-3.775,1.0,.15,.45,2.20,'header')
# Long bedroom dividers end before the front window, leaving a walkable opening.
wall('bedroom_primary_divider',-1.55,1.07,.10,2.66)
wall('bedroom_secondary_divider',1.55,1.07,.10,2.66)
wall('primary_divider_header',-1.55,2.67,.10,.55,.50,2.15,'header')
wall('secondary_divider_header',1.55,2.67,.10,.55,.50,2.15,'header')
# Bathrooms are at the rear of the side bedrooms.
wall('bath_primary_side',-3.14,-1.85,.10,2.3)
wall('bath_primary_front_left',-2.94,-.70,.45,.10)
wall('bath_primary_front_right',-1.71,-.70,.35,.10)
wall('bath_primary_door_header',-2.32,-.70,.85,.10,.50,2.15,'header')
wall('bath_secondary_side',3.14,-1.85,.10,2.3)
wall('bath_secondary_front_left',3.32,-.70,.36,.10)
wall('bath_secondary_front_right',4.38,-.70,.34,.10)
wall('bath_secondary_door_header',3.85,-.70,.78,.10,.50,2.15,'header')
# Kitchen walls frame the service niches without blocking circulation.
wall('kitchen_left_back',-1.55,-1.85,.10,2.3)
wall('kitchen_right_service_back',2.43,-2.75,.10,1.75)
wall('terrace_left',-4.55,3.65,.15,1.3,1.15,category='external')
wall('terrace_right',4.55,3.65,.15,1.3,1.15,category='external')

furniture=[]
def furn(id,label,kind,room,x,z,dims,rotation=0,color='#b8b9b3'):
    furniture.append({'id':id,'label':label,'kind':kind,'room':room,'objectName':'Furniture_'+id,
                      'position':[x,0,z],'dimensions':dims,'rotationY':math.radians(rotation),
                      'color':color,'editable':True,'dimensionStatus':'inferred'})

furn('sofa','Sofá de tres cuerpos','sofa','living',-1.00,1.18,[2.05,.82,.84],90,'#8c9997')
furn('coffee_table','Mesa de centro','coffee_table','living',.15,1.55,[.65,.42,1.08],0,'#b7ced0')
furn('armchair','Sillón de lectura','chair','living',.92,.35,[.72,.86,.80],-40,'#d6cdbb')
furn('dining_table','Mesa de comedor','dining_table','kitchen',.05,-1.65,[.82,.76,1.45],0,'#e3dfd2')
for i,(x,z,rot) in enumerate([(-.61,-1.95,90),(-.61,-1.23,90),(.72,-1.95,-90),(.72,-1.23,-90)],1):
    furn(f'dining_chair_{i}',f'Silla de comedor {i}','dining_chair','kitchen',x,z,[.40,.84,.43],rot,'#7e8d80')
furn('bed_primary','Cama dormitorio principal','bed','bedroom_primary',-3.14,1.18,[1.60,.95,2.08],90,'#9da98c')
furn('bed_secondary','Cama dormitorio secundario','bed','bedroom_secondary',3.13,1.18,[1.50,.95,2.08],-90,'#b6a793')
for side,x in [('primary',-4.03),('secondary',4.03)]:
    for i,z in enumerate([-.08,2.42],1):
        furn(f'nightstand_{side}_{i}',f'Velador y lámpara {i}','nightstand','bedroom_'+side,x,z,[.50,.94,.48],0,'#ac7c4d')
furn('terrace_chair_1','Sillón terraza izquierdo','terrace_chair','terrace',-3.35,3.62,[.65,.83,.65],-25,'#dddcd1')
furn('terrace_chair_2','Sillón terraza derecho','terrace_chair','terrace',3.22,3.62,[.65,.83,.65],25,'#dddcd1')
furn('terrace_table','Mesa de terraza','round_table','terrace',2.24,3.62,[.48,.52,.48],0,'#d1dcce')
furn('plant_1','Planta terraza','plant','terrace',-4.08,3.66,[.55,1.2,.55],0,'#5f813d')
furn('plant_2','Planta de interior','plant','living',1.13,2.54,[.43,1.05,.43],0,'#5f813d')

rooms=[
 {'id':'living','label':'Living','camera':[.42,1.58,2.60],'target':[-.75,1.0,.95],'bounds':{'minX':-1.5,'maxX':1.5,'minZ':-.55,'maxZ':3}},
 {'id':'kitchen','label':'Cocina y comedor','camera':[.97,1.58,-.28],'target':[-.75,1.0,-2.2],'bounds':{'minX':-1.5,'maxX':2.35,'minZ':-3.7,'maxZ':-.55}},
 {'id':'bedroom_primary','label':'Dormitorio principal','camera':[-1.92,1.58,2.58],'target':[-3.18,.85,1.1],'bounds':{'minX':-4.45,'maxX':-1.6,'minZ':-.6,'maxZ':3}},
 {'id':'bedroom_secondary','label':'Segundo dormitorio','camera':[1.91,1.58,2.58],'target':[3.15,.85,1.1],'bounds':{'minX':1.6,'maxX':4.45,'minZ':-.6,'maxZ':3}},
 {'id':'bathroom_primary','label':'Baño principal','camera':[-2.45,1.58,-.90],'target':[-2.43,1.0,-2.45],'bounds':{'minX':-3.08,'maxX':-1.6,'minZ':-3,'maxZ':-.75}},
 {'id':'bathroom_secondary','label':'Segundo baño','camera':[3.75,1.58,-.90],'target':[3.80,1.0,-2.5],'bounds':{'minX':3.2,'maxX':4.45,'minZ':-3,'maxZ':-.75}},
 {'id':'terrace','label':'Terraza','camera':[.25,1.58,3.71],'target':[.1,1.0,1.1],'bounds':{'minX':-4.45,'maxX':4.45,'minZ':3.08,'maxZ':4.2}},
]

manifest={
 'version':1,'title':'Eco Egaña Norte · interpretación editable de planta C',
 'plan':{'type':'C','bedrooms':2,'bathrooms':2,'officialAreasM2':{'usable':56.02,'terrace':10.88,'total':66.90},
         'source':'https://www.fundamenta.cl/proyectos/eco-egana-norte/',
         'image':'https://www.fundamenta.cl/content/uploads/2026/11/eco-egana-norte-planta-c.webp'},
 'model':'/models/eco-egana-interior.glb','units':'metres','up':'Y','front':'+Z',
 'dimensionStatus':'All lengths, heights, furniture sizes and room boundaries are inferred from the official illustrative plan; only published areas are verified.',
 'orientationStatus':'No verified cardinal orientation, floor or apartment number. Front +Z is a model convention.',
 'bounds':{'minX':-4.65,'maxX':4.65,'minZ':-3.95,'maxZ':4.30,'minY':-.18,'maxY':2.65},
 'wallHeight':2.65,'floorY':0,
 'floorPolygons':[rect(-4.5,4.5,-3,3),rect(-1.65,2.4,-3.7,-3),rect(-4.5,4.5,3,4.25)],
 'overviewCamera':[10.6,10.5,12.2],'overviewTarget':[0,.4,.25],
 'rooms':rooms,'walls':walls,'furniture':furniture,
 'obstacles':[
  {'id':'kitchen_cabinet_left','x':-1.16,'z':-1.85,'width':.62,'depth':2.15,'rotation':0},
  {'id':'kitchen_cabinet_rear','x':-.65,'z':-3.38,'width':1.95,'depth':.63,'rotation':0},
  {'id':'refrigerator','x':1.9,'z':-2.75,'width':.67,'depth':.64,'rotation':0},
  {'id':'washing_machine','x':1.8,'z':-3.33,'width':.61,'depth':.61,'rotation':0},
  {'id':'wardrobe_primary','x':-4.13,'z':-1.82,'width':.56,'depth':1.65,'rotation':0},
  {'id':'wardrobe_secondary','x':2.52,'z':-1.25,'width':.92,'depth':.54,'rotation':0},
  {'id':'tub_primary','x':-2.34,'z':-2.57,'width':1.36,'depth':.76,'rotation':0},
  {'id':'tub_secondary','x':3.825,'z':-2.57,'width':1.13,'depth':.76,'rotation':0},
  {'id':'toilet_primary','x':-1.92,'z':-1.65,'width':.48,'depth':.74,'rotation':0},
  {'id':'toilet_secondary','x':4.13,'z':-1.65,'width':.48,'depth':.74,'rotation':0},
  {'id':'vanity_primary','x':-1.92,'z':-1,'width':.49,'depth':.44,'rotation':0},
  {'id':'vanity_secondary','x':4.13,'z':-1,'width':.49,'depth':.44,'rotation':0}
 ],
 'renderGroups':{'shell':'Architecture','fixed':'Fixed_Fittings','furniture':'Furniture','decor':'Decoration'},
 'notes':['Editable scene is a visual interpretation of plan C, not a measured scan or a verified unit.',
          'The separate official Matterport pilot is not proven to correspond to plan C.',
          'Furniture is original procedural geometry inspired by the illustrated layout, not an exact inventory.']}
(MODELS/'eco-egana-interior.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
if '--manifest-only' in sys.argv:
    print('Interior manifest ready')
    raise SystemExit(0)

# Everything below runs inside Blender.
import bpy
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def mat(name,color,rough=.55,metal=0,alpha=1):
    srgb=tuple(int(color.lstrip('#')[i:i+2],16)/255 for i in [0,2,4])
    rgb=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb)
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,alpha)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Alpha'].default_value=alpha
    if alpha<1:m.surface_render_method='DITHERED'
    return m

PAINT=mat('Interior warm white','#e7e6df',.75)
STONE=mat('Porcelain pale limestone','#c9c7bb',.6)
GROUT=mat('Porcelain grout','#a8a99e',.8)
WHITE=mat('White ceramic','#f1f0e7',.25)
WOOD=mat('Natural oak','#ab7c4c',.65)
DARKWOOD=mat('Walnut cabinet fronts','#5d5144',.55)
METAL=mat('Brushed dark metal','#343e3f',.3,.35)
GLASS=mat('Window glass blue','#9dbcc4',.16,.08,.12)
GLASS_OPAQUE=mat('Tinted glass tabletop','#b7ced0',.25,.08)
MIRROR=mat('Mirror silver','#a3b7bb',.18,.6)
BLACK=mat('Cooktop black ceramic','#252c30',.18,.15)
STEEL=mat('Stainless steel','#a7b2af',.3,.45)
BEDWHITE=mat('Cotton bed linen','#eeeae1',.9)
RUG=mat('Muted teal woven rug','#657b77',.95)
RUG2=mat('Bedroom woven rug','#a3a18f',.95)
LEAF=mat('Foliage deep green','#456437',.85)
LEAF2=mat('Foliage light green','#708647',.85)
TERRACOTTA=mat('Planter ceramic','#af9273',.85)
BOOK=mat('Book covers','#8e9b86',.85)
WATER=mat('Bath blue detail','#6e9298',.28)

collections={}
for name in ['Architecture','Fixed_Fittings','Furniture','Decoration','Studio']:
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);collections[name]=c

def cv(v):return (v[0],-v[2],v[1])

class Mesh:
    def __init__(self,name):self.name=name;self.v=[];self.f=[];self.mi=[];self.m=[]
    def faces(self,v,f,mat):
        offset=len(self.v);self.v.extend(cv(p) for p in v)
        if mat not in self.m:self.m.append(mat)
        idx=self.m.index(mat);self.f.extend(tuple(offset+i for i in p) for p in f);self.mi.extend([idx]*len(f))
    def box(self,c,s,mat):
        x,y,z=c;a,b,d=[n/2 for n in s]
        v=[(x-a,y-b,z-d),(x+a,y-b,z-d),(x+a,y-b,z+d),(x-a,y-b,z+d),
           (x-a,y+b,z-d),(x+a,y+b,z-d),(x+a,y+b,z+d),(x-a,y+b,z+d)]
        self.faces(v,[(0,1,2,3),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0),(4,7,6,5)],mat)
    def cylinder(self,c,r,h,mat,n=16):
        x,y,z=c;v=[(x+r*math.cos(i*math.tau/n),y+dy,z+r*math.sin(i*math.tau/n)) for dy in [-h/2,h/2] for i in range(n)]
        f=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
        f += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        self.faces(v,f,mat)
    def ellipsoid(self,c,r,mat,n=12,rings=6):
        x,y,z=c;rx,ry,rz=r
        v=[]
        for j in range(rings+1):
            p=math.pi*j/rings
            for i in range(n):
                t=math.tau*i/n
                v.append((x+rx*math.sin(p)*math.cos(t),y+ry*math.cos(p),z+rz*math.sin(p)*math.sin(t)))
        f=[]
        for j in range(rings):
            for i in range(n):
                k=(i+1)%n;f.append((j*n+i,(j+1)*n+i,(j+1)*n+k,j*n+k))
        self.faces(v,f,mat)
    def obj(self,collection='Decoration',position=(0,0,0),rotation=0,bevel=0):
        data=bpy.data.meshes.new(self.name);data.from_pydata(self.v,[],self.f);data.update()
        ob=bpy.data.objects.new(self.name,data);collections[collection].objects.link(ob)
        for m in self.m:data.materials.append(m)
        for p,i in zip(data.polygons,self.mi):p.material_index=i
        ob.location=cv(position);ob.rotation_euler[2]=rotation
        if bevel:
            b=ob.modifiers.new('Soft furniture edges','BEVEL');b.width=bevel;b.segments=2
            b.affect='EDGES'
            bpy.context.view_layer.objects.active=ob;ob.select_set(True)
            bpy.ops.object.modifier_apply(modifier=b.name);ob.select_set(False)
        return ob

# Individual walls stay hideable in a dollhouse view and measurable in the app.
for data in walls:
    m=Mesh(data['objectName']);m.box((data['x'],data['base']+data['height']/2,data['z']),
                                 (data['width'],data['height'],data['depth']),PAINT)
    ob=m.obj('Architecture');ob['category']=data['category'];ob['wallId']=data['id'];ob['wall_kind']=data['category']
    if data['category']=='external':
        ob['normal']=[-1,0] if 'left' in data['id'] and 'rear' not in data['id'] else [1,0] if 'right' in data['id'] and 'rear' not in data['id'] else [0,-1]

floor=Mesh('Floor_Interior')
floor.box((0,-.10,0),(9.1,.20,6.15),STONE)
floor.box((.375,-.10,-3.40),(4.2,.20,.8),STONE)
floor.obj('Architecture')
terrace=Mesh('Floor_Terrace');terrace.box((0,-.09,3.65),(9.1,.18,1.3),STONE);terrace.obj('Architecture')
tiles=Mesh('Tile_Grout_Lines')
for x in [-4.5+i*.6 for i in range(16)]:tiles.box((x,.003,0),(.006,.004,6),GROUT)
for z in [-3+i*.6 for i in range(11)]:tiles.box((0,.003,z),(9,.004,.006),GROUT)
for z in [3.3,3.9]:tiles.box((0,.004,z),(9,.004,.006),GROUT)
tiles.obj('Decoration')

# Window framing leaves large actual openings and transparent panes.
window=Mesh('Windows_Terrace')
window.box((0,2.48,3.025),(9,.12,.10),METAL)
window.box((0,.06,3.025),(9,.07,.10),METAL)
for x in [-4.43,-1.5,1.5,4.43]:window.box((x,1.28,3.025),(.055,2.45,.08),METAL)
for x0,x1 in [(-4.43,-3.02),(-3.0,-1.53),(-1.47,-.03),(.03,1.47),(1.53,2.98),(3.02,4.43)]:
    window.box(((x0+x1)/2,1.29,3.035),(x1-x0,2.3,.012),GLASS)
window.obj('Architecture')
rail=Mesh('Terrace_Glass_Railing')
rail.box((0,.60,4.24),(9,.94,.018),GLASS)
rail.box((0,1.10,4.24),(9,.035,.045),METAL)
for x in [-4.45,-2.25,0,2.25,4.45]:rail.box((x,.60,4.24),(.04,1.05,.04),METAL)
rail.obj('Architecture')

# Entry and internal door leaves are open, keeping navigation continuous.
doors=Mesh('Open_Doors')
doors.box((.76,1.05,-3.30),(.055,2.10,.9),WOOD)
doors.box((-2.75,1.02,-.30),(.045,2.04,.72),WOOD)
doors.box((3.45,1.02,-.30),(.045,2.04,.72),WOOD)
doors.obj('Fixed_Fittings')

# Kitchen joinery, island-height counters, appliances and sink.
kitchen=Mesh('Kitchen_Cabinets')
kitchen.box((-1.16,.44,-1.85),(.62,.88,2.15),DARKWOOD)
kitchen.box((-1.15,.92,-1.85),(.67,.055,2.25),WHITE)
kitchen.box((-.65,.44,-3.38),(1.95,.88,.63),DARKWOOD)
kitchen.box((-.65,.92,-3.38),(2.00,.055,.67),WHITE)
for z in [-2.66,-2.0,-1.35]:kitchen.box((-1.475,.48,z),(.018,.73,.018),METAL)
kitchen.obj('Fixed_Fittings',bevel=.013)
appliances=Mesh('Kitchen_Appliances')
appliances.box((1.90,.91,-2.75),(.67,1.82,.64),STEEL)
appliances.box((1.91,1.16,-2.40),(.57,.02,.035),METAL)
appliances.box((1.91,.51,-2.40),(.57,.02,.035),METAL)
appliances.box((-1.14,.961,-1.90),(.52,.025,.65),BLACK)
for x,z,r in [(-1.29,-2.04,.09),(-1.04,-2.04,.09),(-1.15,-1.76,.13)]:appliances.cylinder((x,.98,z),r,.008,METAL,20)
appliances.box((1.8,.43,-3.33),(.61,.86,.61),WHITE)
appliances.ellipsoid((1.8,.43,-3.01),(.22,.22,.025),BLACK)
appliances.box((-.48,.96,-3.38),(.65,.018,.43),STEEL)
appliances.box((-.48,.967,-3.38),(.47,.017,.31),DARKWOOD)
appliances.box((-.48,.982,-3.38),(.40,.009,.24),STEEL)
appliances.cylinder((-.48,1.12,-3.62),.018,.30,STEEL,10)
appliances.box((-.48,1.26,-3.54),(.035,.03,.17),STEEL)
appliances.obj('Fixed_Fittings')

wardrobe=Mesh('Bedroom_Wardrobes')
for x,z,w,d in [(-4.13,-1.82,.56,1.65),(2.52,-1.25,.92,.54)]:
    wardrobe.box((x,1.1,z),(w,2.2,d),DARKWOOD)
    wardrobe.box((x,1.12,z+d/2+.014),(w-.04,2.13,.026),WOOD)
    wardrobe.box((x,1.10,z+d/2+.035),(.025,.34,.025),METAL)
wardrobe.obj('Fixed_Fittings')

def bathroom(name,x0,x1):
    c=(x0+x1)/2;w=x1-x0
    m=Mesh(name)
    # Tub and ceramic fixtures have depth; no flat placeholder rectangles.
    m.box((c,.31,-2.57),(w-.12,.62,.76),WHITE)
    m.box((c,.63,-2.57),(w-.25,.025,.58),STEEL)
    m.box((c,.642,-2.57),(w-.34,.02,.47),WHITE)
    m.box((c,.65,-2.89),(.06,.08,.10),STEEL)
    m.box((x1-.29,.40,-1.80),(.44,.8,.27),WHITE)
    m.ellipsoid((x1-.32,.39,-1.52),(.24,.12,.34),WHITE)
    m.ellipsoid((x1-.32,.52,-1.51),(.19,.025,.26),WHITE)
    m.box((x1-.32,.63,-1.0),(.49,.04,.44),WOOD)
    m.box((x1-.32,.40,-1.0),(.44,.45,.39),DARKWOOD)
    m.ellipsoid((x1-.32,.72,-1.0),(.21,.09,.19),WHITE)
    m.cylinder((x1-.32,.84,-1.16),.016,.18,STEEL,10)
    m.box((x1-.035,1.48,-1.10),(.018,.70,.62),MIRROR)
    m.obj('Fixed_Fittings',bevel=.015)
bathroom('Bathroom_Primary_Fixtures',-3.08,-1.60)
bathroom('Bathroom_Secondary_Fixtures',3.20,4.45)

# Rugs and a small collection of art remain independent of editable furniture.
rugs=Mesh('Area_Rugs')
rugs.box((.10,.013,1.20),(2.45,.018,2.8),RUG)
rugs.box((-3.14,.014,1.2),(2.55,.018,2.1),RUG2)
rugs.box((3.14,.014,1.2),(2.55,.018,2.1),RUG2)
rugs.obj('Decoration')
art=Mesh('Framed_Art')
for x in [-4.455,4.455]:
    art.box((x,1.72,1.14),(.045,.85,1.13),WOOD)
    art.box((x+(.029 if x<0 else -.029),1.72,1.14),(.012,.74,1.01),BEDWHITE)
    art.box((x+(.038 if x<0 else -.038),1.72,1.14),(.012,.30,.78),RUG)
art.obj('Decoration')

# Furniture origins are at local floor level. Every item can move independently.
for data in furniture:
    w,h,d=data['dimensions'];kind=data['kind'];m=Mesh(data['objectName'])
    upholstery=mat('Editable '+data['id'],data['color'],.82)
    if kind=='sofa':
        m.box((0,.18,0),(w-.12,.17,d-.12),WOOD)
        m.box((0,.37,0),(w,.30,d),upholstery)
        m.box((0,.64,-d*.40),(w,.41,.18),upholstery)
        for sx in [-1,1]:m.box((sx*(w/2-.10),.55,0),(.20,.43,d),upholstery)
        for i in range(3):m.box(((i-1)*(w-.38)/3,.54,.06),((w-.4)/3-.018,.13,d-.24),upholstery)
        for x in [-w*.36,w*.36]:
            for z in [-d*.32,d*.32]:m.cylinder((x,.09,z),.035,.18,WOOD,10)
    elif kind in ['chair','terrace_chair','dining_chair']:
        seat=.44 if kind=='dining_chair' else .38
        for x in [-w*.34,w*.34]:
            for z in [-d*.32,d*.32]:m.cylinder((x,seat/2,z),.022,seat,METAL,10)
        m.box((0,seat,0),(w,.11,d),upholstery)
        m.box((0,(seat+h)/2,-d*.42),(w,h-seat,.10),upholstery)
        if kind!='dining_chair':
            for x in [-w*.43,w*.43]:m.box((x,seat+.15,0),(.09,.20,d*.8),upholstery)
    elif kind=='bed':
        m.box((0,.20,0),(w,.30,d),WOOD)
        m.box((0,.44,0),(w+.025,.26,d-.03),BEDWHITE)
        m.box((0,.588,.24),(w+.035,.045,d*.72),upholstery)
        m.box((0,.66,-d*.48),(w+.10,.60,.10),upholstery)
        for x in [-w*.25,w*.25]:m.ellipsoid((x,.64,-d*.28),(w*.22,.09,.30),BEDWHITE)
        for x in [-w*.35,w*.35]:
            for z in [-d*.35,d*.35]:m.cylinder((x,.08,z),.035,.16,WOOD,8)
    elif kind in ['dining_table','coffee_table','round_table']:
        topmat=GLASS_OPAQUE if kind=='coffee_table' else upholstery
        if kind=='round_table':m.cylinder((0,h-.025,0),w/2,.05,topmat,24)
        else:m.box((0,h-.035,0),(w,.07,d),topmat)
        if kind=='round_table':
            m.cylinder((0,h/2,0),.032,h-.05,METAL,12);m.cylinder((0,.035,0),w*.32,.045,METAL,20)
        else:
            for x in [-w*.37,w*.37]:
                for z in [-d*.37,d*.37]:m.cylinder((x,(h-.07)/2,z),.022,h-.07,WOOD,10)
    elif kind=='nightstand':
        m.box((0,.29,0),(w,.54,d),upholstery)
        m.box((0,.31,d*.505),(w-.04,.015,.018),DARKWOOD)
        m.cylinder((0,.60,0),.11,.02,METAL,16)
        m.cylinder((0,.72,0),.015,.24,METAL,10)
        m.cylinder((0,.86,0),.12,.13,WHITE,16)
    elif kind=='plant':
        m.cylinder((0,.18,0),w*.32,.36,TERRACOTTA,16)
        m.cylinder((0,.57,0),.016,.72,WOOD,8)
        for i in range(12):
            a=i*2.4;r=w*(.18+.21*(i%3)/2);y=.52+(i%5)*.12
            m.ellipsoid((math.cos(a)*r,y,math.sin(a)*r),(w*.19,.12,w*.14),LEAF if i%2 else LEAF2,8,4)
    ob=m.obj('Furniture',tuple(data['position']),data['rotationY'],.025 if kind in ['sofa','chair','bed'] else .006)
    ob['furnitureId']=data['id'];ob['furniture_id']=data['id'];ob['editable']=True;ob['room']=data['room'];ob['dimensionStatus']='inferred'

# A removable ceiling exists in Blender but is excluded from the web asset.
ceiling=Mesh('Ceiling_Reference')
ceiling.box((0,2.71,0),(9.1,.10,6.15),PAINT)
ceiling_ob=ceiling.obj('Architecture');ceiling_ob.hide_render=True;ceiling_ob.hide_viewport=True

scene=bpy.context.scene;scene.unit_settings.system='METRIC'
scene['plan']='Official illustrative plan C; published areas56.02+10.88=66.90m²'
scene['geometryStatus']='Inferred lengths, heights and furnishings; not a surveyed apartment.'
world=bpy.data.worlds.new('Soft interior daylight');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.76,.83,.9,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
def studio_light(name,kind,pos,power,size=5):
    data=bpy.data.lights.new(name,kind);data.energy=power
    if kind=='AREA':data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);collections['Studio'].objects.link(ob);ob.location=cv(pos)
    ob.rotation_euler=(Vector(cv((0,0,0)))-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob
studio_light('Window softbox','AREA',(1,6,7),900,8)
studio_light('Interior fill','AREA',(-3,5,-1),500,6)
sun=studio_light('Late morning sun','SUN',(-5,12,10),2.0);sun.data.angle=math.radians(18)
camdata=bpy.data.cameras.new('Interior dollhouse camera');camera=bpy.data.objects.new('Interior dollhouse camera',camdata)
collections['Studio'].objects.link(camera);camera.location=cv((9,16,13))
camera.rotation_euler=(Vector(cv((0,.4,.2)))-camera.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO';camdata.ortho_scale=15.4;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'interior-preview.png')
scene.view_settings.view_transform='AgX'

# Preserve individual objects and local transforms for Three.js editing.
bpy.ops.object.select_all(action='DESELECT')
objects=[ob for ob in scene.objects if ob.type=='MESH' and ob!=ceiling_ob]
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(MODELS/'eco-egana-interior.glb'),export_format='GLB',use_selection=True,
                          export_yup=True,export_apply=True,export_extras=True,export_materials='EXPORT',
                          export_cameras=False,export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'eco-egana-interior.blend'))
stats={'objects':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in objects),
       'materialPrimitives':sum(len(set(p.material_index for p in ob.data.polygons)) for ob in objects),
       'glbBytes':(MODELS/'eco-egana-interior.glb').stat().st_size,'editableFurniture':len(furniture)}
(OUT/'interior-model-stats.json').write_text(json.dumps(stats,indent=2))
print('INTERIOR_STATS',json.dumps(stats))
if '--skip-render' not in sys.argv:
    # Cutaway for the exported preview only; editable .blend and GLB keep walls.
    bpy.data.objects['Wall_external_right'].hide_render=True
    bpy.ops.render.render(write_still=True)

