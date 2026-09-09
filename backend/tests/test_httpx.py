import asyncio
import httpx

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
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://overpass-api.de/api/interpreter", 
                content=query,
                headers={"User-Agent": "LAIP-DigitalTwin/1.0", "Content-Type": "application/x-www-form-urlencoded"}
            )
            print("Status:", resp.status_code)
            if resp.status_code != 200:
                print("Error content:", resp.text[:500])
            else:
                data = resp.json()
                print("Elements:", len(data.get("elements", [])))
    except Exception as e:
        print("Exception:", e)

asyncio.run(test())
