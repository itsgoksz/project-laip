import requests

lat_center = 12.905
lon_center = 77.59
lat_min = lat_center - 0.016
lat_max = lat_center + 0.016
lon_min = lon_center - 0.016
lon_max = lon_center + 0.016

query = f"""
[out:json][timeout:25];
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
print("Querying overpass...")
try:
    res = requests.post("https://overpass-api.de/api/interpreter", data={"data": query}, timeout=30)
    print("Status:", res.status_code)
    data = res.json()
    if "elements" in data:
        print("Elements:", len(data["elements"]))
    else:
        print("No elements. Response:", data)
except Exception as e:
    print("Error:", e)
