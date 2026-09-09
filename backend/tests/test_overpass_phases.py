import httpx
import asyncio

async def test():
    query = """
    [out:json][timeout:25];
    (
      node["name"~"J. P. Nagar|JP Nagar|J P Nagar|Phase", i](12.88,77.57,12.93,77.61);
      way["name"~"J. P. Nagar.*Phase|JP Nagar.*Phase|Phase", i](12.88,77.57,12.93,77.61);
    );
    out center;
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://overpass-api.de/api/interpreter", content=query)
        try:
            data = resp.json()
            for element in data.get('elements', []):
                name = element.get('tags', {}).get('name', '')
                if 'Phase' in name or 'phase' in name:
                    print(name, element.get('lat') or element.get('center', {}).get('lat'), element.get('lon') or element.get('center', {}).get('lon'))
        except Exception as e:
            print("Error parsing json:", resp.text)

asyncio.run(test())
