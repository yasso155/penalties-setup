"""
upload_to_firebase.py
Uses firebase-tools token to PUT reference data to Firebase REST API.
"""
import json, urllib.request, urllib.error

# Read the token from firebase-tools config
import os, pathlib
config_path = pathlib.Path(os.environ['USERPROFILE']) / '.config/configstore/firebase-tools.json'
with open(config_path, encoding='utf-8') as f:
    fb_config = json.load(f)
token = fb_config['tokens']['access_token']

# Read the converted data
with open('source/reference_upload.json', encoding='utf-8') as f:
    payload = json.load(f)

db_url = 'https://penalties-setup-default-rtdb.asia-southeast1.firebasedatabase.app'
endpoint = f'{db_url}/reference.json?access_token={token}'

data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
req = urllib.request.Request(endpoint, data=data, method='PUT',
                              headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        result = resp.read().decode()
        print(f'SUCCESS: HTTP {resp.status}')
        # Print just first 200 chars of response
        print(result[:200])
except urllib.error.HTTPError as e:
    print(f'ERROR {e.code}: {e.read().decode()}')
except Exception as e:
    print(f'ERROR: {e}')

