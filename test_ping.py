import requests

API = "CG-az7Ss1yR56u2DihkEFYN3A2F"

headers = {
    "x-cg-demo-api-key": API
}

r = requests.get(
    "https://api.coingecko.com/api/v3/ping",
    headers=headers
)

print("STATUS:", r.status_code)
print("RESPONSE:", r.text)
