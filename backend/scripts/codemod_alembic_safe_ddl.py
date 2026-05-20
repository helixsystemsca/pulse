"""
One-shot AST codemod: replace blind Alembic op.* DDL with alembic_helpers safe_* calls.

Run from repo root or backend:
  python scripts/codemod_alembic_safe_ddl.py

Skips 0001_initial_schema.py. Idempotent for already-migrated files (skips ah.* calls).
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

IMPORT_BLOCK = """
from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402
""".lstrip(
    "\n"
)

DDL_METHODS = frozenset(
    {
        "add_column",
        "drop_column",
        "create_index",
        "drop_index",
        "alter_column",
        "create_table",
        "drop_table",
        "create_foreign_key",
        "drop_constraint",
        "create_unique_constraint",
        "create_check_constraint",
    }
)


def _detect_conn_name(body: list[ast.stmt]) -> str | None:
    for stmt in body[:40]:
        if not isinstance(stmt, ast.Assign) or len(stmt.targets) != 1:
            continue
        t = stmt.targets[0]
        if not isinstance(t, ast.Name):
            continue
        v = stmt.value
        if not isinstance(v, ast.Call):
            continue
        fn = v.func
        if not isinstance(fn, ast.Attribute) or fn.attr != "get_bind":
            continue
        if not isinstance(fn.value, ast.Name) or fn.value.id != "op":
            continue
        return t.id
    return None


def _make_conn_assign(name: str) -> ast.Assign:
    return ast.Assign(
        targets=[ast.Name(id=name, ctx=ast.Store())],
        value=ast.Call(
            func=ast.Attribute(value=ast.Name(id="op", ctx=ast.Load()), attr="get_bind", ctx=ast.Load()),
            args=[],
            keywords=[],
        ),
        type_comment=None,
    )


def _drop_index_table(node: ast.Call) -> ast.expr | None:
    if len(node.args) >= 2:
        return node.args[1]
    for kw in node.keywords:
        if kw.arg == "table_name":
            return kw.value
    return None


class _SafeDdlTransformer(ast.NodeTransformer):
    def __init__(self) -> None:
        self.conn_name: str = "conn"
        self.inject_conn: bool = False
        self.changed: bool = False

    def visit_FunctionDef(self, node: ast.FunctionDef) -> ast.AST:
        if node.name not in ("upgrade", "downgrade"):
            return self.generic_visit(node)

        found = _detect_conn_name(node.body)
        self.inject_conn = found is None
        self.conn_name = found or "conn"

        if self.inject_conn:
            node.body.insert(0, _make_conn_assign("conn"))
            self.changed = True

        self.generic_visit(node)

        return node

    def visit_Call(self, node: ast.Call) -> ast.AST:
        self.generic_visit(node)

        fn = node.func
        if not isinstance(fn, ast.Attribute):
            return node
        if not isinstance(fn.value, ast.Name):
            return node

        if fn.value.id == "ah" and fn.attr.startswith("safe_"):
            return node

        if fn.value.id != "op" or fn.attr not in DDL_METHODS:
            return node

        meth = fn.attr
        cname = ast.Name(id=self.conn_name, ctx=ast.Load())

        if meth == "add_column":
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_add_column", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "drop_column":
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_drop_column", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "create_index":
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_create_index", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "drop_index":
            tbl = _drop_index_table(node)
            if tbl is None:
                return node
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_drop_index", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, node.args[0], tbl],
                keywords=[kw for kw in node.keywords if kw.arg != "table_name"],
            )
        elif meth == "alter_column":
            if len(node.args) < 2:
                return node
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_alter_column", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args[:2]],
                keywords=node.keywords,
            )
        elif meth == "create_table":
            if not node.args:
                return node
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_create_table", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "drop_table":
            new = ast.Call(
                func=ast.Attribute(value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_drop_table", ctx=ast.Load()),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "create_foreign_key":
            if not node.args:
                return node
            new = ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_create_foreign_key", ctx=ast.Load()
                ),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "drop_constraint":
            if len(node.args) < 2:
                return node
            type_val = None
            schema_val = None
            for kw in node.keywords:
                if kw.arg == "type_":
                    type_val = kw.value
                elif kw.arg == "schema":
                    schema_val = kw.value
            sub_keywords = []
            if type_val is not None:
                sub_keywords.append(ast.keyword(arg="type_", value=type_val))
            if schema_val is not None:
                sub_keywords.append(ast.keyword(arg="schema", value=schema_val))
            new = ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_drop_constraint", ctx=ast.Load()
                ),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args[:2]],
                keywords=sub_keywords,
            )
        elif meth == "create_unique_constraint":
            if len(node.args) < 3:
                return node
            new = ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_create_unique_constraint", ctx=ast.Load()
                ),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        elif meth == "create_check_constraint":
            if len(node.args) < 3:
                return node
            new = ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id="ah", ctx=ast.Load()), attr="safe_create_check_constraint", ctx=ast.Load()
                ),
                args=[ast.Name(id="op", ctx=ast.Load()), cname, *node.args],
                keywords=node.keywords,
            )
        else:
            return node

        self.changed = True
        return ast.copy_location(new, node)


def _inject_ah_import(src: str) -> str:
    if "import alembic_helpers as ah" in src:
        return src
    marker = "from alembic import op"
    idx = src.find(marker)
    if idx == -1:
        return src
    line_end = src.find("\n", idx)
    if line_end == -1:
        return src
    insert_at = line_end + 1
    return src[:insert_at] + "\n" + IMPORT_BLOCK + "\n" + src[insert_at:]


def process_file(path: Path) -> bool:
    if path.name == "0001_initial_schema.py":
        return False
    raw = path.read_text(encoding="utf-8")
    if "from alembic import op" not in raw and "import alembic" not in raw:
        return False
    if not any(f"op.{m}" in raw for m in DDL_METHODS):
        return False

    tree = ast.parse(raw)
    t = _SafeDdlTransformer()
    new_tree = t.visit(tree)
    ast.fix_missing_locations(new_tree)

    if not t.changed and "import alembic_helpers as ah" in raw:
        return False

    out = ast.unparse(new_tree)
    out = _inject_ah_import(out)
    if out != raw:
        path.write_text(out + ("\n" if not out.endswith("\n") else ""), encoding="utf-8")
        return True
    return False


def main() -> None:
    seen: set[Path] = set()
    changed: list[str] = []
    for p in sorted(VERSIONS_DIR.glob("*.py")):
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        try:
            if process_file(p):
                changed.append(p.name)
        except SyntaxError as e:
            print(f"SKIP syntax {p}: {e}", file=sys.stderr)

    print(f"Modified {len(changed)} files")
    for name in changed:
        print(name)


if __name__ == "__main__":
    main()
