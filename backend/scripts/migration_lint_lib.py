"""
AST-based checks for Alembic revisions (used by pytest and optional CLI).

Fails on blind ``op.*`` structural DDL and on ``try:`` / ``except: pass`` around Alembic
operations — patterns that break PostgreSQL transactional DDL + idempotent CI.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

FORBIDDEN_OP_METHODS = frozenset(
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

EXEMPT_FILES = frozenset(
    {
        # Baseline uses ORM create_all / drop_all only — no revision-style op DDL.
        "0001_initial_schema.py",
    }
)


def _upgrade_bind_order_issue(tree: ast.Module, filename: str) -> tuple[str, int, str, str] | None:
    """``ah.safe_*`` must not run before ``conn``/``bind = op.get_bind()`` (undefined / wrong connection)."""
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef) or node.name != "upgrade":
            continue
        bind_lines: list[int] = []
        safe_lines: list[int] = []
        for stmt in node.body:
            for n in ast.walk(stmt):
                if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
                    nm = n.targets[0].id
                    if nm in ("conn", "bind"):
                        v = n.value
                        if isinstance(v, ast.Call) and isinstance(v.func, ast.Attribute) and v.func.attr == "get_bind":
                            if isinstance(v.func.value, ast.Name) and v.func.value.id == "op":
                                bind_lines.append(n.lineno)
                if isinstance(n, ast.Call):
                    fn = n.func
                    if (
                        isinstance(fn, ast.Attribute)
                        and isinstance(fn.value, ast.Name)
                        and fn.value.id == "ah"
                        and fn.attr.startswith("safe_")
                    ):
                        safe_lines.append(n.lineno)
        if not safe_lines:
            return None
        min_safe = min(safe_lines)
        min_bind = min(bind_lines) if bind_lines else None
        if min_bind is None or min_safe < min_bind:
            return (filename, min_safe, "upgrade uses ah.safe_* before conn/bind = op.get_bind()", "conn_order")
    return None


class _ForbiddenOpCallVisitor(ast.NodeVisitor):
    def __init__(self, filename: str) -> None:
        self.filename = filename
        self.errors: list[tuple[str, int, str, str]] = []

    def visit_Call(self, node: ast.Call) -> Any:
        fn = node.func
        if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name) and fn.value.id == "op":
            if fn.attr in FORBIDDEN_OP_METHODS:
                self.errors.append((self.filename, node.lineno, fn.attr, "raw_op_ddl"))
        self.generic_visit(node)


class _TryExceptPassOpVisitor(ast.NodeVisitor):
    """``try: op.foo ... except: pass`` (or bare ``except:`` + pass) — unsafe on PG."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self.errors: list[tuple[str, int, str, str]] = []

    def visit_Try(self, node: ast.Try) -> Any:
        for handler in node.handlers:
            if handler.type is not None:
                continue  # only bare ``except:``
            if len(handler.body) != 1 or not isinstance(handler.body[0], ast.Pass):
                continue
            inner = _OpCallInStmtVisitor()
            for stmt in node.body:
                inner.visit(stmt)
            if inner.has_op_call:
                self.errors.append((self.filename, node.lineno, "try/except/pass", "ddl_exception_swallow"))
        self.generic_visit(node)


class _OpCallInStmtVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.has_op_call = False

    def visit_Call(self, node: ast.Call) -> Any:
        fn = node.func
        if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name) and fn.value.id == "op":
            self.has_op_call = True
        self.generic_visit(node)


def scan_versions_directory(versions_dir: Path) -> list[tuple[str, int, str, str]]:
    """Return list of (filename, lineno, detail, kind). Empty if clean."""
    out: list[tuple[str, int, str, str]] = []
    for path in sorted(versions_dir.glob("*.py")):
        if path.name in EXEMPT_FILES:
            continue
        src = path.read_text(encoding="utf-8")
        tree = ast.parse(src, filename=str(path))

        order_issue = _upgrade_bind_order_issue(tree, path.name)
        if order_issue:
            out.append(order_issue)

        v1 = _ForbiddenOpCallVisitor(path.name)
        v1.visit(tree)
        for fn, ln, attr, kind in v1.errors:
            out.append((fn, ln, f"op.{attr}(...)", kind))

        v2 = _TryExceptPassOpVisitor(path.name)
        v2.visit(tree)
        out.extend(v2.errors)

    return out


def main() -> None:
    import sys

    root = Path(__file__).resolve().parents[1]
    versions = root / "alembic" / "versions"
    issues = scan_versions_directory(versions)
    if issues:
        for fn, ln, detail, kind in issues:
            print(f"{fn}:{ln}: [{kind}] {detail}", file=sys.stderr)
        sys.exit(1)
    print("migration_lint: OK")


if __name__ == "__main__":
    main()
