from __future__ import annotations

import json
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "tree_editor"
BACKUP_DIR = ROOT / "tree_backups"
HOST = "127.0.0.1"
PORT = 8765

TREE_FILES = {
    "v1": ("Árvore v1", "arvore_v1.json"),
    "habilidades_tecnicas": ("Árvore Habilidades Técnicas", "arvore_habilidades_tecnicas.json"),
    "principal_v3": ("Árvore Principal v3", "arvore_principal_v3.json"),
    "auxiliar_v3": ("Árvore Auxiliar v3", "arvore_auxiliar_v3.json"),
}


def get_tree_files() -> dict[str, dict[str, Path | str]]:
    files: dict[str, dict[str, Path | str]] = {}
    for key, (label, filename) in TREE_FILES.items():
        path = ROOT / filename
        if path.exists():
            files[key] = {"label": label, "path": path}
    return files


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(path: Path, payload: dict) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def validate_tree_document(payload: dict) -> None:
    if not isinstance(payload, dict):
        raise ValueError("Documento JSON precisa ser um objeto.")

    roots = payload.get("roots")
    if not isinstance(roots, list):
        raise ValueError("Campo 'roots' precisa ser uma lista.")

    for index, node in enumerate(roots):
        validate_node(node, f"roots[{index}]")


def validate_node(node: dict, location: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"Nó inválido em {location}: esperado objeto.")

    node_id = node.get("id")
    label = node.get("label")
    if not isinstance(node_id, str) or not node_id.strip():
        raise ValueError(f"Nó inválido em {location}: 'id' obrigatório.")
    if not isinstance(label, str) or not label.strip():
        raise ValueError(f"Nó inválido em {location}: 'label' obrigatório.")

    aliases = node.get("aliases")
    if aliases is not None:
        if not isinstance(aliases, list) or not all(isinstance(item, str) for item in aliases):
            raise ValueError(f"Nó inválido em {location}: 'aliases' precisa ser lista de strings.")

    children = node.get("children")
    if children is not None:
        if not isinstance(children, list):
            raise ValueError(f"Nó inválido em {location}: 'children' precisa ser lista.")
        for index, child in enumerate(children):
            validate_node(child, f"{location}.children[{index}]")


class TreeEditorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/files":
            tree_files = get_tree_files()
            self.respond_json(
                {
                    "files": [
                        {"key": key, "label": value["label"], "filename": value["path"].name}
                        for key, value in tree_files.items()
                    ]
                }
            )
            return

        if parsed.path.startswith("/api/tree/"):
            tree_files = get_tree_files()
            key = parsed.path.rsplit("/", 1)[-1]
            if key not in tree_files:
                self.respond_error(HTTPStatus.NOT_FOUND, "Árvore não encontrada.")
                return
            payload = load_json(tree_files[key]["path"])
            self.respond_json(payload)
            return

        if parsed.path == "/":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/tree/"):
            self.respond_error(HTTPStatus.NOT_FOUND, "Rota não encontrada.")
            return

        tree_files = get_tree_files()
        key = parsed.path.rsplit("/", 1)[-1]
        if key not in tree_files:
            self.respond_error(HTTPStatus.NOT_FOUND, "Árvore não encontrada.")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)

        try:
            payload = json.loads(raw_body.decode("utf-8"))
            validate_tree_document(payload)
            self.backup_file(tree_files[key]["path"])
            dump_json(tree_files[key]["path"], payload)
        except json.JSONDecodeError as error:
            self.respond_error(HTTPStatus.BAD_REQUEST, f"JSON inválido: {error.msg}")
            return
        except ValueError as error:
            self.respond_error(HTTPStatus.BAD_REQUEST, str(error))
            return
        except OSError as error:
            self.respond_error(HTTPStatus.INTERNAL_SERVER_ERROR, f"Falha ao salvar: {error}")
            return

        self.respond_json({"ok": True, "saved": TREE_FILES[key]["path"].name})

    def backup_file(self, source: Path) -> None:
        BACKUP_DIR.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = BACKUP_DIR / f"{source.stem}-{timestamp}{source.suffix}"
        backup_path.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")

    def respond_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def respond_error(self, status: HTTPStatus, message: str) -> None:
        self.respond_json({"ok": False, "error": message}, status=status)

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def run_server() -> None:
    server = ThreadingHTTPServer((HOST, PORT), TreeEditorHandler)
    print(f"Editor disponível em http://{HOST}:{PORT}")
    print("Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor.")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
