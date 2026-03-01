from app import create_app

app = create_app()
with app.app_context():
    for rule in app.url_map.iter_rules():
        methods = set(rule.methods) - {'HEAD', 'OPTIONS'}
        print(f"{rule.rule} {list(methods)} {rule.endpoint}")
