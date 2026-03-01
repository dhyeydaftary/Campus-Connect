import ast

filepath = r"c:\Code\Code Playground\Campus Connect\app\blueprints\main\routes.py"
with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

tree = ast.parse(code)
for node in tree.body:
    if isinstance(node, ast.FunctionDef):
        for dec in node.decorator_list:
            # Handle @main_bp.route('/...', methods=[...])
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr == "route":
                url = dec.args[0].value if dec.args else "Unknown"
                methods = "['GET']"
                for kw in dec.keywords:
                    if kw.arg == "methods":
                        methods = "[" + ", ".join(f"'{el.value}'" for el in kw.value.elts) + "]"
                print(f"{url} {methods} {node.name}")
            # Handle @main_bp.get('/...')
            elif isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr in ("get", "post", "put", "delete", "patch"):
                url = dec.args[0].value if dec.args else "Unknown"
                methods = f"['{dec.func.attr.upper()}']"
                print(f"{url} {methods} {node.name}")
