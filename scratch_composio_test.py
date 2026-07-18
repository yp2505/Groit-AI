import os
import composio
from composio import Composio

client = Composio(api_key="dummy")
print("Version:", getattr(composio, '__version__', 'unknown'))
print(dir(client.connected_accounts))
