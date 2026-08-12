"""Run a reproducible, no-network baseline through the provided RAG pipeline.

This is a safe fallback when the external LLM endpoint is unavailable. It keeps
the corpus loader, BM25 retriever, prompt construction, trace format, and
evaluation core unchanged. The generator intentionally returns retrieved text
only; its scores are a retrieval/context-echo baseline, not an LLM result.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from domain_assistant import generate_actual_answers


class OfflineContextGenerator:
    """Deterministic generator that never calls a network or reads gold data."""

    model = "offline-context-echo"

    def generate(self, prompt: str) -> str:
        marker = "Retrieved contexts:\n"
        end_marker = "\n\nAnswer:"
        if marker not in prompt:
            return "I cannot answer because no retrieved context was provided."
        context = prompt.split(marker, 1)[1].split(end_marker, 1)[0].strip()
        context = re.sub(r"\[Context \d+ \| [^\]]+\]\n", "", context)
        if not context or context == "[No relevant context was retrieved.]":
            return "I cannot answer because no relevant context was retrieved."
        return "Based only on the retrieved OrbitTech context:\n" + context


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus-dir", type=Path, default=Path("data/technology_store"))
    parser.add_argument("--dataset", type=Path, default=Path("golden_dataset.json"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/actual_answers.json"))
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()
    artifact = generate_actual_answers(
        args.dataset,
        args.corpus_dir,
        generator=OfflineContextGenerator(),
        top_k=args.top_k,
        progress=lambda message: print(message, flush=True),
    )
    artifact["agent"]["mode"] = "offline-baseline"
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    import json

    output.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated offline baseline with {len(artifact['answers'])} answers: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
