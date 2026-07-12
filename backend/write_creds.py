import json

key = (
    "-----BEGIN PRIVATE KEY-----\n"
    "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDY+JdIqBoOGtsd\n"
    "Y1TLxP4MMMNd/E3rcQHwK5B04kMbn6LXWomvL+GfwOZA0kI2DdVtXz2ddTsgy+pr\n"
    "t4WHq3IpnIwTsWGnL9cPxIa8uVI/gVwZZ7YvXt+DIBJrWLNJvdNCh+TH//eWOf0o\n"
    "PElMlyDPdlZbGloIRfRuzDN+IY6FXCZ33d6SzD5sQKfN4eaDVkHA+AqHsJu4Lk01\n"
    "+D/LVo+pMkYQYESeIklFElAZJkzO16JazFbjCjpHzO6VZP5QIlS/8GzwEul5LWnh\n"
    "W4Bg1ftqhIDQuQwgmf1hWNLc8I6SfcJmKDri/Dq/U3xZJVtgbVo6OADyjAhOrDbg\n"
    "7XrEIztTAgMBAAECggEAacW+kpgIo6mp+girlO8C3lSDWXUfU1DzHe9O6/xFtNi8\n"
    "3PlxN6tC9ctnNGCMEKfrzPbqJbG50oI2VK7R9NK6w9hiXVNTBNsIn9Ix0R0TIIxi\n"
    "pqvtn+hDVDw1XomOVbupmrx+5pU9UMoSRSQmo6TlRN4uuRj+nRvlToJT9ABN52qf\n"
    "oBTGxUabqdHYNrjkdDRv+PABgAEoGI23IzHRfWiXVhwUW+wkPpo/vFj+oTt+BpzX\n"
    "uZ/3+vDWGxs6In4ZJCm6j2iMYPY61Kvt3kr4WtVWR1m7hPOYlVneLFQvVAdrzQTC\n"
    "i9S9stU12e2BED2Uho5HG7ADPUZUWRiF+RGfmQ0OcQKBgQD9QpEhT8yDh6UVvQvw\n"
    "tZZYPb4YkyFXO+zCRqRHlAUhm7OeMxcS65AUlgabgHo0pjG8T25E7hrKeZTbvzrT\n"
    "YSvc2/LJQTy/DUj77VOX9RbjnroHiyNOIUltw4uaJlXNPideKOiZpzCfDqPlPDn+\n"
    "RblEB2/HpwmnSvgMxJa3C2n8awKBgQDbUYR8PuS0FjPiktN7maS7Pm3K0iO4JN7J\n"
    "rPNYm58NOIUeRvAz9Y3N19U4AxKl0t9U2WkI5y/Vwq+dOjXWVSBq2kthiJAOPcfe\n"
    "H0sKrVNP8azZ/xqKosmhOAlePk+QkXZfv1NYUh6hidRBvSttezgHFijXpic4f51B\n"
    "ZBzPkzf2uQKBgQDQxfQvmsHD16j+D5ZtOrQST+uKBJeietLEoElCfEHyn5DlI8as\n"
    "oSVn4vjVbYbQKgSr8Gq9Re8t5CYTNEQBBoSLD4HH6BB0ijYU/2I+zRquTyWZnFhh\n"
    "Ss1mP6GwVFO82rTHST/dklZheEchbJF+C+oaq2q5EfjCQOnUVKbNhAo9uwKBgQCn\n"
    "QrMUgm6vPSOSz0FESTfNqV3YSYz+OfhCvIjV8dFKJum23okAR2w/KTSuRAGrv3ed\n"
    "YTVumcnsb065TRSUAlX3x8Wne5vJkKpmJ112phscpAacNqbKRj4Zmv/iBQlvCtDJ\n"
    "UsPAXtiHf/MFs7x0AX4IQYkiddABkamfnjcuw2rx2QKBgCaa7kxVU3LnQMzTJVhY\n"
    "rn6tJZfZ0BAyXbL/drAMNAhzpPWP8A4tboHq6NXA1jrl6XNHqW9i1b1NZGRIPSjq\n"
    "Hyk4l8LneVtG8SSTbpqwySnN29fYBe/64IsLtpDJ65oIBLcom1+rVZheBNhBe+48\n"
    "BhHUU9KQneucRUfwUQZRYeFT\n"
    "-----END PRIVATE KEY-----\n"
)

creds = {
  "type": "service_account",
  "project_id": "tic-tech-toe-493005",
  "private_key_id": "3ed0e99375dae80f571a03c7545bbee0ba58df63",
  "private_key": key,
  "client_email": "mcp-agent@tic-tech-toe-493005.iam.gserviceaccount.com",
  "client_id": "107388707116317483389",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/mcp-agent%40tic-tech-toe-493005.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

with open("credentials/service_account.json", "w") as f:
    json.dump(creds, f, indent=2)

print("Done")
