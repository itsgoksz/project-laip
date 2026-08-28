from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx
import math
import uvicorn
import asyncio
import traceback
import time
import os
import sys

# Ensure backend root is in system path for local imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from database import get_db_connection, init_db
from intelligence.inference.streetlight_predictor import predict_single_asset
from intelligence.copilot import ask_copilot

app = FastAPI(title="LAIP Live Data Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global cache to prevent spamming Overpass API
CITY_DATA_CACHE = None

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "LAIP Backend is running!"}

FLIGHTS_CACHE = None
LAST_FLIGHTS_FETCH = 0

@app.get("/api/weather")
async def get_weather():
    # JP Nagar coordinates
    lat, lon = 12.9075, 77.5900
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto"
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            return {
                "temperature": data["current"]["temperature_2m"],
                "weather_code": data["current"]["weather_code"],
                "is_day": data["current"]["is_day"],
                "sunrise": data["daily"]["sunrise"][0],
                "sunset": data["daily"]["sunset"][0]
            }
    except Exception as e:
        print("Weather fetch error:", e)
        return {"error": "Failed to fetch weather"}

@app.get("/api/ev-stations")
async def get_ev_stations():
    API_KEY = "5571a0e2-96ba-4406-bb42-bf2fbc8d7a48"
    lat_center = 12.905
    lon_center = 77.590
    
    url = f"https://api.openchargemap.io/v3/poi?key={API_KEY}&latitude={lat_center}&longitude={lon_center}&distance=5&distanceunit=KM&maxresults=100"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            
            stations = []
            for st in data:
                addr = st.get("AddressInfo", {})
                lat = addr.get("Latitude")
                lon = addr.get("Longitude")
                if lat is None or lon is None:
                    continue
                    
                x = (lon - lon_center) * 111320 * math.cos(math.radians(lat_center))
                z = (lat_center - lat) * 111000
                
                connections = []
                for c in st.get("Connections", []):
                    ct = c.get("ConnectionType", {}).get("Title", "Unknown")
                    kw = c.get("PowerKW")
                    kw_str = f"{kw}kW" if kw else "Unknown Power"
                    connections.append(f"{ct} - {kw_str}")
                
                stations.append({
                    "id": f"ev_{st.get('ID')}",
                    "name": addr.get("Title", "EV Station"),
                    "operator": st.get("OperatorInfo", {}).get("Title", "Unknown Operator") if st.get("OperatorInfo") else "Unknown Operator",
                    "address": addr.get("AddressLine1", "No Address"),
                    "center": [round(x, 2), round(z, 2)],
                    "connections": connections,
                    "category": "ev_station",
                    "height": 0 # For compatibility with landmark renderer
                })
            return {"stations": stations}
    except Exception as e:
        print("EV fetch error:", e)
        return {"error": "Failed to fetch EV stations"}

@app.get("/api/flights")
async def get_flights():
    global FLIGHTS_CACHE, LAST_FLIGHTS_FETCH
    
    # Cache flights for 30 seconds to avoid HTTP 429 Too Many Requests
    if FLIGHTS_CACHE and (time.time() - LAST_FLIGHTS_FETCH < 30):
        return FLIGHTS_CACHE
        
    # Bounding box roughly covering Bangalore airspace
    lamin, lomin, lamax, lomax = 12.5, 77.0, 13.5, 78.5
    
    # Same center as city data to align coordinates
    lat_center = 12.908
    lon_center = 77.590

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://opensky-network.org/api/states/all?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}"
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            
            flights = []
            for state in data.get("states", []) or []:
                # state[0] = icao24, state[1] = callsign, state[5] = lon, state[6] = lat, 
                # state[7] = baro_altitude, state[9] = velocity, state[10] = true_track
                if state[5] is None or state[6] is None:
                    continue
                    
                x = (state[5] - lon_center) * 111320 * math.cos(math.radians(lat_center))
                z = (lat_center - state[6]) * 111000
                alt = state[7] if state[7] else 5000
                
                flights.append({
                    "id": state[0],
                    "callsign": str(state[1]).strip() or "UNKNOWN",
                    "position": [round(x, 2), round(alt/5, 2), round(z, 2)], # Scale altitude down for visibility in model
                    "heading": state[10] if state[10] else 0,
                    "velocity": state[9] if state[9] else 0
                })
            
            
            FLIGHTS_CACHE = {"flights": flights}
            LAST_FLIGHTS_FETCH = time.time()
            return FLIGHTS_CACHE
    except Exception as e:
        print("Flight fetch error:", e)
        # Return cached flights if available even if expired, to prevent UI breakage
        if FLIGHTS_CACHE:
            return FLIGHTS_CACHE
        return {"error": "Failed to fetch flights"}

@app.get("/api/city-data")
async def get_city_data():
    global CITY_DATA_CACHE
    if CITY_DATA_CACHE:
        return CITY_DATA_CACHE
    
    # JP Nagar bounding box expanded to ~10 sq km for massive drone view
    lat_center = 12.905 # Shifted south to include Puttenahalli
    lon_center = 77.59
    
    # 3km x 3km Bounding Box (Highly safe for Overpass API limits)
    lat_min = lat_center - 0.015
    lat_max = lat_center + 0.015
    lon_min = lon_center - 0.015
    lon_max = lon_center + 0.015

    # Overpass Query
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
      way["leisure"]({lat_min},{lon_min},{lat_max},{lon_max});
      way["shop"]({lat_min},{lon_min},{lat_max},{lon_max});
      way["amenity"]({lat_min},{lon_min},{lat_max},{lon_max});
    );
    out body;
    >;
    out skel qt;
    """

    OVERPASS_URLS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    
    data = None
    for url in OVERPASS_URLS:
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    url,
                    content=query,
                    headers={"User-Agent": "LAIP-DigitalTwin/1.0", "Content-Type": "application/x-www-form-urlencoded"}
                )
                resp.raise_for_status()
                data = resp.json()
                break  # Success
        except Exception as e:
            print(f"Overpass mirror {url} failed: {e}")
            continue
    
    if data is None:
        print("All Overpass mirrors failed")
        return {"error": "Failed to fetch map data from all mirrors"}

    nodes = {}
    buildings = []
    roads = []
    trees = []
    lakes = []

    node_dict = {n["id"]: n for n in data.get("elements", []) if n["type"] == "node"}
    way_dict = {w["id"]: w for w in data.get("elements", []) if w["type"] == "way"}

    for el in data.get("elements", []):
        if el["type"] == "node":
            # Convert lat/lon to local meters (approximate Web Mercator)
            x = (el["lon"] - lon_center) * 111320 * math.cos(math.radians(lat_center))
            z = (lat_center - el["lat"]) * 111000
            nodes[el["id"]] = [round(x, 2), round(z, 2)]
            
            # If this node is a tree
            if el.get("tags", {}).get("natural") == "tree":
                trees.append([round(x, 2), round(z, 2)])

    for element in data.get("elements", []):
        if element["type"] == "way":
            tags = element.get("tags", {})
            way_nodes = [nodes[nid] for nid in element.get("nodes", []) if nid in nodes]
            if not way_nodes:
                continue

            if ("building" in tags or "leisure" in tags or "shop" in tags or "amenity" in tags) and ("water" not in tags and tags.get("natural") != "water"):
                cx = sum(p[0] for p in way_nodes) / len(way_nodes)
                cz = sum(p[1] for p in way_nodes) / len(way_nodes)
                
                levels = tags.get("building:levels", "3")
                try:
                    levels = int(levels)
                except:
                    levels = 3
                height = max(levels * 3, 5)
                
                import random
                # Determine category and name for landmarks
                category = "residential"
                name = tags.get("name")
                
                if tags.get("amenity") in ["mall", "hospital", "school", "college", "university", "cinema", "restaurant", "cafe", "fast_food"]:
                    category = tags.get("amenity")
                elif tags.get("shop") == "mall":
                    category = "mall"
                elif tags.get("shop") == "car" or tags.get("shop") == "motorcycle":
                    category = "showroom"
                elif tags.get("leisure") in ["club", "sports_centre", "park"]:
                    category = "club"
                elif tags.get("building") in ["commercial", "retail"]:
                    category = "commercial"
                elif tags.get("building") == "apartments":
                    category = "apartments"
                
                # Aggressive overrides for famous spots
                if name:
                    lower_name = name.lower()
                    if any(x in lower_name for x in ["brigade", "south city", "elita", "apartment", "residency", "enclave", "tower", "heights", "palmsprings"]):
                        category = "apartments"
                        height = 40 + random.random() * 25 # 40-65m massive towers
                    if "woodrose" in lower_name:
                        category = "club"
                        height = 15
                    if "nexons" in lower_name or "motors" in lower_name or "toyota" in lower_name:
                        category = "showroom"

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
            elif "highway" in tags:
                roads.append({
                    "id": element["id"],
                    "line": way_nodes,
                    "type": tags.get("highway", "residential")
                })
            elif tags.get("natural") == "water" or tags.get("water") in ["lake", "pond", "reservoir", "river", "basin"]:
                polygon = []
                for node_id in element.get("nodes", []):
                    if node_id in node_dict:
                        pt = node_dict[node_id]
                        x = (pt["lon"] - lon_center) * 111320 * math.cos(math.radians(lat_center))
                        z = (lat_center - pt["lat"]) * 111000
                        polygon.append([round(x, 2), round(z, 2)])
                if len(polygon) > 2:
                    lakes.append({
                        "id": element["id"],
                        "polygon": polygon,
                        "name": tags.get("name", "Water Body")
                    })
                        
        elif element["type"] == "relation":
            tags = element.get("tags", {})
            if tags.get("natural") == "water" or tags.get("water") == "lake":
                polygon = []
                for member in element.get("members", []):
                    if member.get("type") == "way" and member.get("role") == "outer":
                        way_id = member.get("ref")
                        if way_id in way_dict:
                            way = way_dict[way_id]
                            for node_id in way.get("nodes", []):
                                if node_id in node_dict:
                                    pt = node_dict[node_id]
                                    x = (pt["lon"] - lon_center) * 111320 * math.cos(math.radians(lat_center))
                                    z = (lat_center - pt["lat"]) * 111000
                                    polygon.append([round(x, 2), round(z, 2)])
                
                # Deduplicate consecutive points to clean up the polygon
                clean_poly = []
                for p in polygon:
                    if not clean_poly or clean_poly[-1] != p:
                        clean_poly.append(p)
                        
                if len(clean_poly) > 2:
                    lakes.append({
                        "id": element["id"],
                        "polygon": clean_poly,
                        "name": tags.get("name", "Water Body")
                    })
    
    # If no trees were tagged, spawn some procedurally along roads
    if len(trees) < 20:
        import random
        for road in roads:
            if random.random() > 0.5:
                # pick a random point on road
                pt = random.choice(road["line"])
                # offset it
                trees.append([pt[0] + (random.random()-0.5)*10, pt[1] + (random.random()-0.5)*10])
    
    print(f"Parsed {len(buildings)} buildings, {len(roads)} roads, {len(trees)} trees, and {len(lakes)} lakes.")
    CITY_DATA_CACHE = {
        "buildings": buildings, 
        "roads": roads, 
        "trees": trees,
        "lakes": lakes
    }
    return CITY_DATA_CACHE

TOMTOM_API_KEY = "reitkjbaLdcjS6lc9nT8Q0J1uhnINnal"
TRAFFIC_POINTS = [
    "12.905,77.590", # JP Nagar Central
    "12.910,77.595", # Bannerghatta Road intersection
    "12.900,77.585", # South JP Nagar
    "12.915,77.585"  # Jayanagar border
]

@app.get("/api/traffic")
async def get_traffic():
    async with httpx.AsyncClient() as client:
        tasks = []
        for pt in TRAFFIC_POINTS:
            url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point={pt}&unit=KMPH&key={TOMTOM_API_KEY}"
            tasks.append(client.get(url))
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        segments = []
        total_current = 0
        total_free = 0
        
        for res in responses:
            if isinstance(res, Exception) or res.status_code != 200:
                continue
            try:
                data = res.json()
                if "flowSegmentData" in data:
                    flow = data["flowSegmentData"]
                    coords = flow.get("coordinates", {}).get("coordinate", [])
                    
                    # Convert lat/lon to our 3D cartesian
                    # 1 degree lat is approx 111,111 meters
                    # 1 degree lon is approx 111,111 * cos(lat) = 111,111 * cos(12.9) = 108,000 meters
                    # Our center is LAT=12.905, LON=77.590
                    line_3d = []
                    for c in coords:
                        dx = (c["longitude"] - 77.590) * 108000
                        dz = (c["latitude"] - 12.905) * -111111  # negative because 3D z is inverted
                        line_3d.append([dx, dz])
                    
                    if len(line_3d) > 1:
                        segments.append({
                            "currentSpeed": flow.get("currentSpeed", 30),
                            "freeFlowSpeed": flow.get("freeFlowSpeed", 40),
                            "line": line_3d
                        })
                        total_current += flow.get("currentSpeed", 30)
                        total_free += flow.get("freeFlowSpeed", 40)
            except Exception as e:
                print("Error parsing traffic:", e)
                
        # Calculate a global traffic health ratio (1.0 = free flow, 0.0 = stopped)
        health = (total_current / total_free) if total_free > 0 else 1.0
        
        return {"segments": segments, "health": health}

OCM_API_KEY = "5571a0e2-96ba-4406-bb42-bf2fbc8d7a48"

@app.get("/api/chargers")
async def get_chargers():
    async with httpx.AsyncClient() as client:
        # Bounding box for JP Nagar
        url = f"https://api.openchargemap.io/v3/poi/?output=json&countrycode=IN&boundingbox=(12.93,77.57),(12.88,77.61)&maxresults=50&key={OCM_API_KEY}"
        res = await client.get(url)
        
        if res.status_code != 200:
            return {"chargers": []}
            
        data = res.json()
        chargers = []
        
        for poi in data:
            try:
                addr = poi.get("AddressInfo", {})
                lat = addr.get("Latitude", 0)
                lon = addr.get("Longitude", 0)
                
                # Convert lat/lon to our 3D cartesian
                # Our center is LAT=12.905, LON=77.590
                dx = (lon - 77.590) * 108000
                dz = (lat - 12.905) * -111111
                
                # Extract connections safely
                connections = poi.get("Connections") or []
                if connections and connections[0]:
                    power_kw = connections[0].get("PowerKW") or 50
                    c_type_obj = connections[0].get("ConnectionType") or {}
                    conn_type = c_type_obj.get("Title", "Type 2")
                else:
                    power_kw = 50
                    conn_type = "Type 2"
                
                # Check operator info safely
                operator_obj = poi.get("OperatorInfo") or {}
                
                # Check status safely
                status_obj = poi.get("StatusType") or {}

                chargers.append({
                    "id": poi.get("ID", ""),
                    "title": addr.get("Title", "EV Station"),
                    "operator": operator_obj.get("Title", "Unknown Operator"),
                    "power": power_kw,
                    "connectionType": conn_type,
                    "status": status_obj.get("IsOperational", True),
                    "cost": poi.get("UsageCost", "Unknown"),
                    "position": [dx, 0, dz]
                })
            except Exception as e:
                print(f"Error parsing charger: {e}")
                
        return {"chargers": chargers}

# Cache for streetlight intelligence state
STREETLIGHTS_INTEL_CACHE = None

@app.on_event("startup")
async def startup_event():
    # Setup database tables and simulate assets/readings if empty
    init_db()
    from intelligence.simulators.streetlight_simulator import setup_all
    setup_all()
    # Warm up models on load
    from intelligence.inference.streetlight_predictor import get_detector
    get_detector()

@app.get("/api/streetlights")
async def get_streetlights():
    global STREETLIGHTS_INTEL_CACHE
    if STREETLIGHTS_INTEL_CACHE is not None:
        return {"streetlights": STREETLIGHTS_INTEL_CACHE}
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT asset_id FROM assets ORDER BY CAST(SUBSTR(asset_id, 4) AS INTEGER)")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        asset_id = r["asset_id"]
        res = predict_single_asset(asset_id)
        if res:
            results.append(res)
            
    STREETLIGHTS_INTEL_CACHE = results
    return {"streetlights": results}

@app.get("/api/streetlights/{asset_id}")
async def get_streetlight_detail(asset_id: str):
    res = predict_single_asset(asset_id)
    if not res:
        return {"error": f"Streetlight asset {asset_id} not found"}
    return res

@app.post("/api/streetlights/run-inference")
async def run_streetlight_inference():
    global STREETLIGHTS_INTEL_CACHE
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT asset_id FROM assets ORDER BY CAST(SUBSTR(asset_id, 4) AS INTEGER)")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        asset_id = r["asset_id"]
        res = predict_single_asset(asset_id)
        if res:
            results.append(res)
            
    STREETLIGHTS_INTEL_CACHE = results
    return {"status": "ok", "message": "Inference completed", "count": len(results)}


class CopilotTurn(BaseModel):
    role: str
    content: str


class CopilotRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[CopilotTurn] = []
    ui_state: dict | None = None


@app.post("/api/copilot")
async def copilot_chat(req: CopilotRequest):
    result = await ask_copilot(
        message=req.message.strip(),
        history=[turn.model_dump() for turn in req.history],
        streetlights=STREETLIGHTS_INTEL_CACHE,
        ui_state=req.ui_state,
    )
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

