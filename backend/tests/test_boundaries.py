import httpx
import asyncio

async def test():
    query = """
    [out:json][timeout:25];
    (
      relation["name"~"J.? ?P.? Nagar.*Phase", i](12.88,77.57,12.93,77.61);
      way["name"~"J.? ?P.? Nagar.*Phase", i](12.88,77.57,12.93,77.61);
    );
    out geom;
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://overpass-api.de/api/interpreter", data={'data': query})
        try:
            data = resp.json()
            for element in data.get('elements', []):
                name = element.get('tags', {}).get('name', '')
                type_ = element.get('type')
                print(f"{type_}: {name} - nodes/geom: {len(element.get('geometry', element.get('members', [])))}")
        except Exception as e:
            print("Error parsing json:", resp.text)

asyncio.run(test())
