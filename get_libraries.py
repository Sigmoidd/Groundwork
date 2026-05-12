import urllib.request
import urllib.parse
import json

query = """
[out:json];
area["name"="Oklahoma City"]->.searchArea;
nwr["amenity"="library"](area.searchArea);
out center;
"""
url = 'http://overpass-api.de/api/interpreter?data=' + urllib.parse.quote(query)
req = urllib.request.Request(url, headers={'User-Agent': 'GroundworkOKC/1.0'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    for element in data['elements']:
        name = element.get('tags', {}).get('name', 'Library')
        lat = element.get('lat', element.get('center', {}).get('lat'))
        lon = element.get('lon', element.get('center', {}).get('lon'))
        print(f'{name}|{lat}|{lon}')
