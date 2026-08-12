"""Reproduce Exercise 3.5 reranking results from saved benchmark artifacts.

This is an offline, reference-guided experiment for the lab bonus.  It keeps
the retrieved chunks unchanged and only reorders them before calculating
Context Recall and rank-aware Context Precision.  The expected answer is used
as an analysis query because it is the reference signal for this exercise;
this must not be used by the production retriever (it would be data leakage).
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from solution.solution import RAGASEvaluator, rerank_by_overlap


DEFAULT_CASES = ("E01", "M01", "M03", "H01", "A03")


def _load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def _round(value: float) -> float:
    return round(value, 3)


def build_report(
    golden_path: Path,
    actual_path: Path,
    case_ids: tuple[str, ...] = DEFAULT_CASES,
) -> dict[str, Any]:
    golden = _load_json(golden_path)
    actual = _load_json(actual_path)

    golden_by_id = {
        record["id"]: record
        for record in golden.get("qa_pairs", [])
        if isinstance(record, dict) and record.get("id")
    }
    actual_by_id = {
        record["id"]: record
        for record in actual.get("answers", [])
        if isinstance(record, dict) and record.get("id")
    }

    evaluator = RAGASEvaluator()
    rows: list[dict[str, Any]] = []
    for case_id in case_ids:
        if case_id not in golden_by_id or case_id not in actual_by_id:
            raise ValueError(f"Missing golden or actual record for {case_id}")

        golden_record = golden_by_id[case_id]
        actual_record = actual_by_id[case_id]
        expected_answer = golden_record["expected_answer"]
        before_records = actual_record.get("retrieved_contexts", [])
        if not isinstance(before_records, list) or not all(
            isinstance(record, dict) and isinstance(record.get("text"), str)
            for record in before_records
        ):
            raise ValueError(f"Invalid retrieved_contexts for {case_id}")

        before = [record["text"] for record in before_records]
        after = rerank_by_overlap(before, expected_answer)

        # Reranking must preserve the retrieved set exactly.
        if Counter(before) != Counter(after):
            raise AssertionError(f"Reranking changed the retrieved set for {case_id}")

        recall_before = evaluator.evaluate_context_recall(before, expected_answer)
        recall_after = evaluator.evaluate_context_recall(after, expected_answer)
        precision_before = evaluator.evaluate_context_precision(before, expected_answer)
        precision_after = evaluator.evaluate_context_precision(after, expected_answer)

        rows.append(
            {
                "id": case_id,
                "retrieved_chunk_count": len(before),
                "recall_before": _round(recall_before),
                "recall_after": _round(recall_after),
                "precision_before": _round(precision_before),
                "precision_after": _round(precision_after),
                "precision_delta": _round(precision_after - precision_before),
            }
        )

    def average(field: str) -> float:
        return _round(sum(row[field] for row in rows) / len(rows))

    return {
        "schema_version": "1.0",
        "experiment": "Exercise 3.5 reference-guided lexical reranking",
        "reranker": "solution.rerank_by_overlap",
        "analysis_query": "golden expected_answer (offline only; not production-safe)",
        "case_ids": list(case_ids),
        "results": rows,
        "averages": {
            "recall_before": average("recall_before"),
            "recall_after": average("recall_after"),
            "precision_before": average("precision_before"),
            "precision_after": average("precision_after"),
            "precision_delta": average("precision_delta"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--golden", type=Path, default=Path("golden_dataset.json"))
    parser.add_argument(
        "--actual", type=Path, default=Path("artifacts/actual_answers.json")
    )
    parser.add_argument(
        "--output", type=Path, default=Path("artifacts/reranking_results.json")
    )
    args = parser.parse_args()

    report = build_report(args.golden, args.actual)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Exercise 3.5 reranking analysis")
    print(f"Cases: {', '.join(report['case_ids'])}")
    print(json.dumps(report["averages"], ensure_ascii=False))
    print(f"Saved: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
