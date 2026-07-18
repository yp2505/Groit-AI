import inspect
from composio import Composio

client = Composio()
print("initiate params:", inspect.signature(client.connected_accounts.initiate))
