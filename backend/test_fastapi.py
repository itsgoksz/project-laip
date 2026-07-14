import asyncio
from fastapi.testclient import TestClient
from main import app, CITY_DATA_CACHE

client = TestClient(app)

print("Calling /api/city-data")
response = client.get("/api/city-data")
print("Status Code:", response.status_code)
try:
    data = response.json()
    if "error" in data:
        print("Error in response:", data["error"])
    elif "buildings" in data:
        print(f"Success! Fetched {len(data['buildings'])} buildings.")
    else:
        print("Response:", data)
except Exception as e:
    print("Could not parse JSON. Exception:", e)
    print("Text:", response.text[:500])

