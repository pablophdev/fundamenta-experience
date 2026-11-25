"""Rebuild the editable Eco Egaña architectural study and its web GLB.

Run: blender -b --python blender/build_eco_egana.py
The geometry is an artistic interpretation of Fundamenta's published renders,
not construction documentation.  Units: metres. Blender Z up, glTF Y up.
"""
import bpy
import math
import random
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'blender'
MODELS = ROOT / 'public' / 'models'
OUT.mkdir(exist_ok=True, parents=True)
MODELS.mkdir(exist_ok=True, parents=True)
random.seed(41)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials:
    bpy.data.materials.remove(data)


def material(name, color, metallic=0, roughness=.5, emission=None):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = .45
    return m


WHITE = material('Warm architectural concrete', (.79, .82, .80), .05, .52)
LIGHT = material('Ivory exterior frame', (.94, .95, .92), .12, .3)
WALL = material('Recessed mineral plaster', (.39, .44, .43), 0, .8)
BLUE = material('Residential blue glazing', (.10, .25, .34), .1, .34)
GLASS = material('Blue curtain wall', (.11, .28, .40), .12, .3)
GLASS2 = material('Blue curtain wall light', (.16, .36, .48), .10, .32)
GLASS3 = material('Blue curtain wall sky reflection', (.23, .44, .55), .12, .3)
LIT = material('Warm interior illumination', (.76, .58, .33), .06, .45, (.8, .53, .23))
METAL = material('Anodised aluminium mullions', (.27, .38, .42), .75, .25)
DARK = material('Basalt plinth', (.075, .10, .11), .05, .72)
PAVING = material('Pale stone plaza', (.48, .53, .51), .02, .9)
GRASS = material('Landscaped garden', (.19, .32, .12), 0, .95)
LEAF = material('Tree canopy', (.15, .30, .12), 0, .9)
LEAF2 = material('Tree canopy sunlit', (.23, .39, .16), 0, .95)
BARK = material('Tree trunk', (.22, .17, .12), 0, .95)
WOOD = material('Timber benches', (.38, .24, .11), 0, .72)
GREEN = material('Fundamenta green', (.38, .65, .07), 0, .45)


class Mesh:
    """Build batched geometry without thousands of Blender operators."""
    def __init__(self, name):
        self.name, self.v, self.f, self.mi, self.mats = name, [], [], [], []

    def faces(self, verts, faces, mat):
        start = len(self.v)
        self.v.extend(verts)
        if mat not in self.mats:
            self.mats.append(mat)
        i = self.mats.index(mat)
        self.f.extend(tuple(start+j for j in face) for face in faces)
        self.mi.extend([i]*len(faces))

    def quad(self, vertices, mat):
        self.faces(vertices, [(0,1,2,3)], mat)

    def box(self, center, size, mat):
        x, y, z = center
        a, b, c = (n/2 for n in size)
        verts = [(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
                 (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
        self.faces(verts, [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], mat)

    def bar(self, a, b, width, mat):
        a, b = Vector(a), Vector(b)
        along = b-a
        side = along.cross(Vector((0,1,0))).normalized()*width/2
        if side.length < .001:
            side = along.cross(Vector((1,0,0))).normalized()*width/2
        other = along.normalized().cross(side).normalized()*width/2
        verts = [tuple(p+s*side+t*other) for p in [a,b] for s,t in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        self.faces(verts, [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], mat)

    def cylinder(self, center, radius, depth, mat, sides=8):
        x,y,z = center
        v = [(x+radius*math.cos(i*math.tau/sides), y+radius*math.sin(i*math.tau/sides), z+dz) for dz in [-depth/2,depth/2] for i in range(sides)]
        f = [tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
        f += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
        self.faces(v,f,mat)

    def crown(self, center, radius, height, mat, sides=9):
        x,y,z = center
        verts = [(x,y,z-height*.5)]
        for dz,scale,off in [(-.28,.6,0),(0,1,.15),(.27,.8,0)]:
            verts.extend((x+radius*scale*math.cos(i*math.tau/sides+off),y+radius*scale*math.sin(i*math.tau/sides+off),z+height*dz) for i in range(sides))
        verts.append((x,y,z+height*.5))
        f=[]
        for i in range(sides):
            j=(i+1)%sides
            f.append((0,1+j,1+i))
            f.append((1+i,1+j,1+sides+j,1+sides+i))
            f.append((1+sides+i,1+sides+j,1+2*sides+j,1+2*sides+i))
            f.append((1+2*sides+i,1+2*sides+j,len(verts)-1))
        self.faces(verts,f,mat)

    def create(self):
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.v, [], self.f)
        mesh.update()
        obj=bpy.data.objects.new(self.name,mesh)
        bpy.context.collection.objects.link(obj)
        for mat in self.mats: mesh.materials.append(mat)
        for poly,idx in zip(mesh.polygons,self.mi): poly.material_index=idx
        return obj


# Residential volume: 24 individually selectable floors above a two-level podium.
core=Mesh('Residential_Core')
core.box((-23,1,42.4),(39.4,22.8,73.8),WALL)
core.create()
for level in range(3,27):
    z=8.2+(level-3)*2.85
    f=Mesh(f'Floor_{level:02d}')
    f.box((-23,0,z),(40.7,27,.25),WHITE)
    f.box((-23,-13.55,z+.18),(40.8,.18,.2),LIGHT)
    f.box((-23,-13.5,z+.76),(40.1,.08,.95),BLUE)
    # Fine continuous top rail catches sunlight at every storey.
    f.box((-23,-13.56,z+1.27),(40.8,.12,.075),LIGHT)
    # Deep recesses, glass sliding doors and dividing fins.
    for bay in range(10):
        x=-41+bay*4
        f.box((x,-11.45,z+1.55),(3.75,.12,2.4),BLUE)
        f.box((x-1.92,-12.4,z+1.55),(.13,2.9,2.8),WHITE)
        f.box((x,-11.53,z+1.55),(.055,.10,2.4),LIGHT)
        if (bay+level*3)%13==0:
            f.box((x+.5,-11.56,z+1.55),(.95,.025,1.75),LIT)
    f.box((-43.25,-12.6,z+1.55),(.28,2.1,2.8),LIGHT)
    f.box((-2.75,-12.6,z+1.55),(.28,2.1,2.8),LIGHT)
    # Return balconies along left and rear facades make orbit inspection useful.
    f.box((-43.25,0,z+.76),(.08,26,.95),BLUE)
    f.box((-43.28,0,z+1.27),(.12,26,.075),LIGHT)
    f.box((-23,13.3,z+.76),(40.2,.08,.95),BLUE)
    f.box((-23,13.36,z+1.27),(40.8,.12,.075),LIGHT)
    for y in [-10,-6,-2,2,6,10]:
        f.box((-42.8,y,z+1.55),(1.7,.14,2.8),WHITE)
    floor=f.create()
    floor['floor_number']=level
    floor['interactive']=True
    floor['description']='Conceptual residential floor; select in the React viewer'

# Open roof pavilion, pergolas and solar panels.
roof=Mesh('Residential_Roof')
top=8.2+24*2.85
roof.box((-23,0,top),(40.8,27,.5),LIGHT)
for x in [-43,-33,-23,-13,-3]:
    for y in [-13,13]: roof.box((x,y,top+2.1),(.32,.4,4.1),LIGHT)
for y in [-13,13]: roof.box((-23,y,top+4.1),(40.5,.4,.32),LIGHT)
for x in range(-42,-2,2):
    roof.box((x,0,top+4.1),(.13,26,.18),LIGHT)
for x in [-37,-28,-19,-10]:
    roof.box((x,5,top+.5),(6,7,.18),GLASS)
roof.box((-23,0,top+.48),(22,2,.45),GRASS)
roof.create()

# Glass tower: the folded zig-zag silhouette is its distinguishing feature.
points=[(9,7),(6,30),(10.7,59),(6.4,88)]
def edge(z):
    for (x1,z1),(x2,z2) in zip(points[:-1],points[1:]):
        if z1<=z<=z2:
            return x1+(x2-x1)*(z-z1)/(z2-z1)
    return points[0][0] if z<7 else points[-1][0]

glass=Mesh('Angular_Glass_Tower')
# Polygonal volume with front folded edge, back is rectangular.
outline=[(9,7),(31,7),(31,88),(6.4,88),(10.7,59),(6,30)]
verts=[(x,y,z) for y in [-12.9,12] for x,z in outline]
n=len(outline)
faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
faces += [(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
glass.faces(verts,faces,GLASS)
# Reflective tiled glazing panes, all consolidated in one mesh.
for row in range(30):
    z0=7+row*2.7
    z1=min(z0+2.68,87.95)
    for col in range(9):
        xa=max(edge(z0),edge(z1))+.12+col*2.75
        xb=min(xa+2.69,30.92)
        if xb<=xa: continue
        m=[GLASS,GLASS2,GLASS3][(col*3+row*7)%3]
        if (row*11+col*5)%43==0: m=LIT
        glass.quad([(xa,-13.02,z0+.03),(xb,-13.02,z0+.03),(xb,-13.02,z1),(xa,-13.02,z1)],m)
    # Side elevation catches a different sky reflection.
    for side in range(8):
        ya=-12.8+side*3.08
        glass.quad([(31.035,ya,z0+.03),(31.035,ya+3.01,z0+.03),(31.035,ya+3.01,z1),(31.035,ya,z1)], [GLASS,GLASS2,GLASS3][(row+side)%3])
glass.create()

frame=Mesh('Glass_Tower_Frame')
for a,b in zip(points[:-1],points[1:]):
    frame.bar((a[0],-13.25,a[1]),(b[0],-13.25,b[1]),.52,LIGHT)
frame.bar((31.2,-13.05,7),(31.2,-13.05,88),.45,LIGHT)
frame.bar((6.4,-13.16,88),(31.2,-13.16,88),.58,LIGHT)
frame.bar((31.2,12,7),(31.2,12,88),.42,LIGHT)
frame.bar((6.4,12,88),(31.2,12,88),.45,LIGHT)
frame.bar((31.2,-13.05,88),(31.2,12,88),.5,LIGHT)
for x in [12,14.7,17.4,20.1,22.8,25.5,28.2]:
    frame.box((x,-13.085,47.5),(.055,.08,80.8),METAL)
for row in range(31):
    z=7+row*2.7
    if z>88: continue
    left=edge(z)
    frame.box(((left+31)/2,-13.09,z),(31-left,.09,.065),METAL)
for y in [-9.7,-6.6,-3.5,-.4,2.7,5.8,8.9]:
    frame.box((31.075,y,47.5),(.08,.055,80.8),METAL)
frame.create()

# Recessed sky terraces and connectors between the volumes.
bridges=Mesh('Sky_Bridges_and_Gardens')
for z in [28.2,53.8,76.6]:
    bridges.box((3.3,3.5,z),(14,17,.65),LIGHT)
    bridges.box((3.3,3.5,z+2.85),(14,17,.4),LIGHT)
    bridges.box((3.3,-4.9,z+1.45),(13.5,.10,2.3),BLUE)
    bridges.box((6.5,9,z+1.4),(.5,4,2.8),LIGHT)
    bridges.box((4.5,-4.5,z+.45),(6,1.6,.6),GRASS)
    for x in [2,4,6]:
        bridges.crown((x,-4.3,z+1.2),.7,1.5,LEAF,7)
bridges.box((6.5,10,43),(2.3,3.5,69),WALL)
bridges.create()

# Commercial podium with recessed shop glazing and signage fascia.
podium=Mesh('Commercial_Podium')
podium.box((-5,0,3.6),(86,31,7.2),DARK)
podium.box((-5,-16.1,7.0),(89,2.8,.55),LIGHT)
podium.box((-5,0,.5),(90,34,1.0),WHITE)
for x in range(-44,36,5):
    podium.box((x,-15.58,3.5),(4.6,.12,5.5),BLUE)
    podium.box((x+2.45,-15.85,3.6),(.3,.8,6.8),WHITE)
podium.box((18,-16.1,5.9),(18,.3,.75),GREEN)
podium.box((-33,-16.1,5.9),(14,.3,.75),WOOD)
podium.create()

# Landscape podium. The model remains centred at origin and rests at Z=0.
plaza=Mesh('Plaza_and_Planters')
plaza.box((0,-3,-.5),(112,73,1),PAVING)
plaza.box((0,-22.8,.08),(108,.15,.1),DARK)
plaza.box((0,-36,.02),(112,3,.06),DARK)
for x,y,w,d in [(-35,-25,17,8),(10,-25,22,7),(41,1,12,28),(-51,2,6,24)]:
    plaza.box((x,y,.25),(w,d,.5),WHITE)
    plaza.box((x,y,.54),(w-.6,d-.6,.1),GRASS)
for x in range(-54,55,4):
    plaza.box((x,-27,.028),(.035,21,.02),WHITE)
for y in [-17,-21,-25,-29,-33]:
    plaza.box((0,y,.03),(112,.035,.025),WHITE)
plaza.create()

trees=Mesh('Plaza_Trees')
tree_positions=[(-47,-19),(-36,-24),(-24,-26),(-12,-22),(7,-25),(22,-24),(43,-18),
                (44,-7),(44,6),(44,17),(-51,-5),(-51,9),(-38,25),(-20,25),(0,25),(23,25)]
for i,(x,y) in enumerate(tree_positions):
    h=6.8+(i%4)*.65
    trees.cylinder((x,y,h*.43),.18,h*.86,BARK)
    trees.crown((x,y,h+.5),2.35+(i%3)*.3,5.8,LEAF if i%2 else LEAF2)
    trees.crown((x+1.05,y+.4,h+.4),1.5,3.7,LEAF2 if i%2 else LEAF)
trees.create()

furniture=Mesh('Street_Furniture')
for x in [-44,-18,15,38]:
    furniture.box((x,-31,.62),(5,1.2,.28),WOOD)
    for dx in [-1.7,1.7]: furniture.box((x+dx,-31,.3),(.3,1,.6),DARK)
for x,y in [(-46,-18),(-17,-18),(16,-18),(46,-18)]:
    furniture.cylinder((x,y,4),.12,8,METAL)
    furniture.box((x+.8,y,8.1),(2,.7,.15),DARK)
    furniture.box((x+.8,y,8.0),(1.65,.5,.025),LIT)
furniture.create()

# Official Fundamenta mark, embedded in the GLB as an RGBA PNG.
image=bpy.data.images.load(str(ROOT/'public/assets/fundamenta-logo.webp'))
w,h=image.size
pixels=list(image.pixels)
icon=bpy.data.images.new('Official Fundamenta F icon', width=h, height=h, alpha=True)
crop=[]
for row in range(h): crop.extend(pixels[row*w*4:row*w*4+h*4])
icon.pixels=crop
icon.filepath_raw=str(OUT/'fundamenta-icon.png')
icon.file_format='PNG'
icon.save()
icon.pack()

def logo_plane(name,img,x,y,z,width,height):
    m=bpy.data.materials.new(name+' material')
    m.use_nodes=True
    m.diffuse_color=(.4,.65,.1,1)
    nodes=m.node_tree.nodes
    shader=nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.42
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=img
    m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    m.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
    m.surface_render_method='DITHERED'
    mesh=Mesh(name)
    mesh.quad([(x-width/2,y,z-height/2),(x+width/2,y,z-height/2),(x+width/2,y,z+height/2),(x-width/2,y,z+height/2)],m)
    obj=mesh.create()
    uv=obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        for loop,uvxy in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]): uv.data[loop].uv=uvxy
    return obj

logo_plane('Fundamenta_Tower_Logo',icon,11,-13.34,83.8,4.1,4.1)
# A geometric companion keeps the mark recognisable in renderers without maps.
# The actual official texture above remains embedded in the exported model.
emblem=Mesh('Fundamenta_Tower_Emblem')
circle=[(11+2.02*math.cos(i*math.tau/40),-13.32,83.8+2.02*math.sin(i*math.tau/40)) for i in range(40)]
emblem.faces(circle,[tuple(range(40))],GREEN)
f_outline=[(-.6,-1.3),(-.17,-1.3),(-.17,.02),(.66,.02),(.66,.44),(-.17,.44),(-.17,.82),(1.0,.82),(1.0,1.25),(-.6,1.25)]
theta=math.radians(25)
f_verts=[(11+1.12*(x*math.cos(theta)-z*math.sin(theta)),-13.33,83.8+1.12*(x*math.sin(theta)+z*math.cos(theta))) for x,z in f_outline]
emblem.faces(f_verts,[tuple(range(len(f_verts)))],LIGHT)
emblem.create()
# A white backing for the corporate wordmark on the commercial podium.
sign=Mesh('Fundamenta_Sign_Backboard')
sign.box((-7,-16.34,5.65),(15.5,.3,3.15),LIGHT)
sign.create()
image.filepath_raw=str(OUT/'fundamenta-wordmark.png')
image.file_format='PNG'
image.save()
image.pack()
logo_plane('Fundamenta_Podium_Logo',image,-7,-16.51,5.65,14.5,14.5*h/w)

# Helpful semantic metadata travels with the GLB.
scene=bpy.context.scene
scene['project']='Eco Egaña architectural study — Fundamenta'
scene['reference']='https://www.fundamenta.cl/proyectos/eco-egana-norte/'
scene['notice']='Conceptual artistic model, not a technical or sales plan.'
scene['units']='metres'
scene.unit_settings.system='METRIC'

world=bpy.data.worlds.new('Late afternoon sky')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.66,.83,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.55
scene.world=world

def light(name,kind,loc,power,color,size=5):
    data=bpy.data.lights.new(name,kind)
    data.energy=power
    data.color=color
    if kind=='AREA': data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=loc
    ob.rotation_euler=(Vector((0,0,40))-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob

sun=light('Afternoon sun','SUN',(-70,-80,130),3.0,(1,.87,.70))
sun.data.angle=math.radians(15)
light('Sky softbox','AREA',(20,-65,120),12000,(.62,.78,1),80)
light('Rim light','AREA',(60,40,100),18000,(.78,.87,1),60)
camdata=bpy.data.cameras.new('Architectural preview')
camera=bpy.data.objects.new('Architectural preview',camdata)
bpy.context.collection.objects.link(camera)
camera.location=(130,-202,115)
target=Vector((-5,0,40))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO'
camdata.ortho_scale=139
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=32
# The distribution in managed Linux can omit OpenImageDenoise.
scene.cycles.use_denoising=False
scene.render.resolution_x=1200
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'preview.png')
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'

# Asset origin and naming are preserved. Export only model meshes, not studio.
bpy.ops.object.select_all(action='DESELECT')
objects=[ob for ob in scene.objects if ob.type=='MESH']
for ob in objects: ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(MODELS/'eco-egana.glb'),export_format='GLB',use_selection=True,
                          export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,
                          export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'eco-egana.blend'))
stats={
    'objects':len(objects),
    'triangles':sum(sum(len(poly.vertices)-2 for poly in ob.data.polygons) for ob in objects),
    'vertices':sum(len(ob.data.vertices) for ob in objects),
    'materials':len(bpy.data.materials),
    'material_primitives_estimate':sum(len(set(p.material_index for p in ob.data.polygons)) for ob in objects),
    'glb_bytes':(MODELS/'eco-egana.glb').stat().st_size,
    'selectable_floors':[f'Floor_{i:02d}' for i in range(3,27)],
    'blender_coordinate_system':'Z up, front faces negative Y',
    'gltf_coordinate_system':'Y up, front faces positive Z',
    'residential_floor_heights_metres':{f'Floor_{i:02d}':round(8.2+(i-3)*2.85,2) for i in range(3,27)},
    'building_height_metres':88.3,
    'site_dimensions_metres':[112,73],
}
(OUT/'model-stats.json').write_text(json.dumps(stats,indent=2))
print('MODEL_STATS '+json.dumps(stats))
if '--skip-render' not in sys.argv:
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as exc:
        print('Cycles unavailable; workbench preview fallback:',exc)
        scene.render.engine='BLENDER_WORKBENCH'
        scene.display.shading.light='STUDIO'
        scene.display.shading.color_type='MATERIAL'
        scene.display.shading.show_shadows=True
        scene.display.shading.show_cavity=True
        bpy.ops.render.render(write_still=True)

