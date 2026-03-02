import os
import re

test_dir = r"c:\Code\Code Playground\Campus Connect\tests"
for root, dirs, files in os.walk(test_dir):
    for f_name in files:
        if not f_name.endswith('.py'): continue
        f_path = os.path.join(root, f_name)
        with open(f_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace occurrences of client methods without /api/
        # Examples: client.get('/posts, client.post('/connections, client.delete('/events
        for method in ['get', 'post', 'put', 'delete']:
            for endpoint in ['posts', 'connections', 'events', 'notifications']:
                # handle f-strings and normal strings
                content = re.sub(
                    r"client\." + method + r"\((['\"]f?)(\/" + endpoint + r")",
                    r"client." + method + r"(\1/api\2",
                    content
                )
                content = re.sub(
                    r"unauthenticated_client\." + method + r"\((['\"]f?)(\/" + endpoint + r")",
                    r"unauthenticated_client." + method + r"(\1/api\2",
                    content
                )
        
        with open(f_path, 'w', encoding='utf-8') as f:
            f.write(content)
print('Done replacing.')
