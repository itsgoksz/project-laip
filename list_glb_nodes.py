import json
import struct

def read_glb_nodes(filepath):
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            print("Not a GLB file")
            return
            
        version, length = struct.unpack('<II', f.read(8))
        
        # Read JSON chunk
        chunk_length, chunk_type = struct.unpack('<II', f.read(8))
        if chunk_type != 0x4E4F534A: # JSON
            print("First chunk is not JSON")
            return
            
        json_data = f.read(chunk_length)
        gltf = json.loads(json_data.decode('utf-8'))
        
        nodes = gltf.get('nodes', [])
        meshes = gltf.get('meshes', [])
        
        print("Meshes found:")
        for mesh in meshes:
            print(f"- {mesh.get('name', 'Unnamed')}")
            
        print("\nNodes found:")
        for node in nodes:
            name = node.get('name', 'Unnamed')
            if 'mesh' in node:
                print(f"- {name} (Mesh)")
            else:
                print(f"- {name}")

read_glb_nodes('frontend/src/assets/LAIP_Fire_Safety_Compliance_Professional.glb')
