"""
convert_ref.py
Reads source/ref.json and writes source/reference_upload.json
ready to be PUT to Firebase REST API.
Run:  python source/convert_ref.py  (from penalties-setup folder)
"""
import json, re

def safe_key(s):
    """Firebase keys cannot contain . # $ [ ] so replace with _"""
    return re.sub(r'[.#$\[\]]', '_', s)

with open('source/ref.json', encoding='utf-8') as f:
    ref = json.load(f)

payload = {}

# ---- fare ----
payload['fare'] = {}
for label, code in ref['fare']:
    payload['fare'][safe_key(label)] = {'label': label, 'code': code}

# ---- leg ----
payload['leg'] = {}
for label, code in ref['leg']:
    payload['leg'][safe_key(label)] = {'label': label, 'code': code}

# ---- pax ----
payload['pax'] = {}
for label, code in ref['pax']:
    payload['pax'][safe_key(label)] = {'label': label, 'code': code}

# ---- cur (settings) ----
payload['cur'] = {
    'enabled': ['SDG','USD','AED','SAR','QAR','OMR','EGP','JOD','KWD'],
    'quick_fares': [
        ['S','S-S - Economy Class','Economy Class'],
        ['H','H-H - High Fare','High Fare'],
        ['Y','Y-Y - Full Fare','Full Fare'],
        ['J','J-J - Business Class','Business Class']
    ]
}

out_path = 'source/reference_upload.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)

print(f'fare:  {len(payload["fare"])} entries')
print(f'leg:   {len(payload["leg"])} entries')
print(f'pax:   {len(payload["pax"])} entries')
print(f'Written to {out_path}')

