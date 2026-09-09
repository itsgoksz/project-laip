import asyncio
import httpx
import math
import random

lat_center = 12.905
lon_center = 77.59
lat_min = lat_center - 0.018
lat_max = lat_center + 0.018
lon_min = lon_center - 0.018
lon_max = lon_center + 0.018

query = f"""
[out:json][timeout:60];
(
  way["building"]({lat_min},{lon_min},{lat_max},{lon_max});
  way["highway"~"^(primary|secondary|tertiary|residential|trunk)$"]({lat_min},{lon_min},{lat_max},{lon_max});
  node["natural"="tree"]({lat_min},{lon_min},{lat_max},{lon_max});
  way["natural"="water"]({lat_min},{lon_min},{lat_max},{lon_max});
  relation["natural"="water"]({lat_min},{lon_min},{lat_max},{lon_max});
  way["water"]({lat_min},{lon_min},{lat_max},{lon_max});
  relation["water"]({lat_min},{lon_min},{lat_max},{lon_max});
);
out body;
>;
out skel qt;
"""

async def test():
    print("Fetching...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post("https://overpass-api.de/api/interpreter", content=query, headers={"Content-Type": "application/x-www-form-urlencoded"})
        data = resp.json()
    
    print("Parsing...")
    nodes = {}
    buildings = []
    roads = []
    trees = []
    lakes = []

    node_dict = {n["id"]: n for n in data.get("elements", []) if n["type"] == "node"}
    way_dict = {w["id"]: w for w in data.get("elements", []) if w["type"] == "way"}

    for element in data.get("elements", []):
        if element["type"] == "way":
            tags = element.get("tags", {})
            if "building" in tags:
                # Calculate center and footprint
                way_nodes = []
                for node_id in element.get("nodes", []):
                    if node_id in node_dict:
                        pt = node_dict[node_id]
                        # Convert to meter offsets
                        x = (pt["lon"] - lon_center) * 111320 * math.cos(math.radians(lat_center))
                        z = (lat_center - pt["lat"]) * 111000
                        way_nodes.append([round(x, 2), round(z, 2)])
                
                if len(way_nodes) > 2:
                    cx = sum(p[0] for p in way_nodes) / len(way_nodes)
                    cz = sum(p[1] for p in way_nodes) / len(way_nodes)
                    
                    levels = int(tags.get("building:levels", 0))
                    height = 0
                    if levels > 0:
                        height = levels * 3.5
                    elif tags.get("building") in ["apartments", "commercial"]:
                        height = 10 + random.random() * 30
                    else:
                        height = 5 + random.random() * 10
                    
                    # Determine category and name for landmarks
                    category = "residential"
                    if tags.get("amenity") in ["mall", "hospital", "school", "college", "university", "cinema"]:
                        category = tags.get("amenity")
                    elif tags.get("shop") == "mall":
                        category = "mall"
                    elif tags.get("building") in ["commercial", "retail"]:
                        category = "commercial"
                    
                    name = tags.get("name")
                    if category == "mall" or category == "commercial":
                        height = 20 + random.random() * 20 # Malls are taller
                    
                    buildings.append({
                        "id": element["id"],
                        "polygon": way_nodes,
                        "center": [round(cx, 2), round(cz, 2)],
                        "height": height,
                        "category": category,
                        "name": name
                    })
    print("Parsed buildings:", len(buildings))

asyncio.run(test())
