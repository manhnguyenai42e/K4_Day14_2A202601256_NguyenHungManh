"""Vercel HTTP entrypoint for the OrbitTech domain assistant.

Routes:
    GET  /api/health
    POST /api/ask  {"question": "..."}

The evaluation scripts remain CLI-oriented. This adapter only exposes the
existing DomainAssistant through a small HTTP surface for Vercel Functions.
"""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from domain_assistant import DomainAssistant  # noqa: E402


_assistant: DomainAssistant | None = None


def _get_assistant() -> DomainAssistant:
    global _assistant
    if _assistant is None:
        _assistant = DomainAssistant.from_corpus(
            ROOT / "data" / "technology_store",
            top_k=5,
        )
    return _assistant


def _json_response(
    handler: BaseHTTPRequestHandler,
    status: int,
    payload: dict[str, Any],
) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    """Vercel Python runtime handler."""

    def do_GET(self) -> None:  # noqa: N802
        route = urlparse(self.path).path.rstrip("/") or "/"
        if route in {"/", "/api", "/api/health"}:
            _json_response(
                self,
                200,
                {
                    "status": "ok",
                    "service": "orbittech-domain-assistant",
                    "corpus": "orbittech-customer-support-v1",
                },
            )
            return
        _json_response(self, 404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        route = urlparse(self.path).path.rstrip("/")
        if route not in {"/api", "/api/ask"}:
            _json_response(self, 404, {"error": "not_found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 64 * 1024:
                raise ValueError("request body must be between 1 byte and 64 KiB")
            raw_body = self.rfile.read(content_length)
            body = json.loads(raw_body.decode("utf-8"))
            question = body.get("question") if isinstance(body, dict) else None
            if not isinstance(question, str) or not question.strip():
                raise ValueError("question must be a non-empty string")

            response = _get_assistant().answer_with_trace(question.strip())
            _json_response(
                self,
                200,
                {
                    "question": response.question,
                    "answer": response.actual_answer,
                    "retrieved_contexts": [
                        {
                            "source_doc": chunk.source_doc,
                            "chunk_id": chunk.chunk_id,
                            "score": round(chunk.score, 6),
                        }
                        for chunk in response.retrieved_chunks
                    ],
                },
            )
        except (ValueError, json.JSONDecodeError) as exc:
            _json_response(self, 400, {"error": str(exc)})
        except Exception:
            # Do not expose API keys, provider errors, or filesystem details.
            _json_response(self, 500, {"error": "assistant_unavailable"})

    def log_message(self, format: str, *args: Any) -> None:
        # Keep Vercel logs compact and avoid logging request bodies.
        super().log_message(format, *args)
