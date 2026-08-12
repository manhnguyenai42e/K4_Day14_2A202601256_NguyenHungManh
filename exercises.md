# Day 14 — AI Evaluation & Benchmarking

## Part 1 — Warm-up

### Exercise 1.1 — Metric thresholds

| Metric | Acceptable low-score scenario | Critical low-score scenario | Action |
|---|---|---|---|
| Faithfulness | Minor lexical mismatch in a cautious answer with no unsupported material claim. | Unsupported safety, privacy, payment, warranty, or refund claim. | Inspect claims against retrieved evidence; block below 0.70. |
| Answer Relevance | Broad question receives a partly relevant answer around 0.60–0.70. | Answer ignores intent or answers another topic. | Improve routing; block below 0.70. |
| Context Recall | Redundant evidence exists and recall is around 0.70. | Evidence for a date, amount, condition, or exception is missing. | Improve query expansion, chunking, or retrieval; alert below 0.80. |
| Context Precision | Some redundant chunks appear after the relevant evidence. | Noise dominates top ranks or exposes unrelated sensitive text. | Tune BM25/reranking; alert below 0.80. |
| Completeness | Only a non-critical secondary detail is omitted. | A required condition, exception, deadline, amount, or safety action is omitted. | Add answer checklists; block below 0.70. |

### Exercise 1.2 — LLM-as-a-Judge bias

1. Create equal-quality answer pairs. Run A-first/B-second, then swap to B-first/A-second while keeping prompt and rubric fixed. Position bias is a consistent score increase for whichever answer appears first.
2. Score correctness, required facts, evidence, and safety separately. State that extra length earns no points and unsupported extra claims lose points. Use length-matched controls.
3. Calibrate against human labels to measure agreement, select safe thresholds, and detect domain-specific safety/privacy errors.

### Exercise 1.3 — CI/CD

| Metric | Blocking threshold | Reason |
|---|---:|---|
| Faithfulness | 0.70 | Unsupported customer-support claims are high risk. |
| Answer Relevance | 0.70 | A grounded answer that misses the request is still a failure. |
| Completeness | 0.70 | Dates, amounts, conditions, and exceptions must be preserved. |

Use offline evaluation for every release or prompt/retriever change, online evaluation for sampled production traffic and drift, and human review for safety/privacy cases, calibration, novel failures, and disputes.

## Part 2 — Core coding

Implemented in `template.py` and copied to `solution/solution.py`: data models, five metrics, optional retrieval wiring, LLM judge parsing/bias output, benchmark reporting/regression detection, failure analysis, improvement logs, and bonus reranking.

Verification: `pytest tests/ -q` → **42 passed**.

## Part 3 — Golden dataset and real benchmark

### Exercise 3.1 — Dataset result

| Item | Result |
|---|---:|
| Total records | 20 / 20 |
| Easy | 5 / 5 |
| Medium | 7 / 7 |
| Hard | 5 / 5 |
| Adversarial | 3 / 3 |
| Source documents used | 10 / 10 |
| Validator | PASS |

Representative design decisions:

| ID | Difficulty | Sources | Why it fits |
|---|---|---|---|
| M05 | Medium | `08_accounts_privacy_and_security.md`, `02_orders_and_payments.md` | Combines compromise response with order-state cancellation. |
| H01 | Hard | `09_escalation_and_policy_updates.md` | Requires effective-date reasoning and the OrbitPlus exception. |
| A03 | Adversarial | `00_system_scope.md` | Tests a false unsafe premise about charging a swollen/overheating device. |

The hardest part was preserving exact verbatim evidence while keeping expected answers concise. Dates, fees, thresholds, conditions, and exceptions were retained. All claims are supported by corpus evidence and all 10 source documents are used.

### Exercise 3.2 — Real OpenAI benchmark

Generated with the provided `domain_assistant.py`, `gpt-4o-mini`, `top_k=5`, and the approved OpenAI API call. Artifact: `artifacts/actual_answers.json`.

| ID | Ctx Recall | Ctx Precision | Faithfulness | Relevance | Completeness | Overall | Passed | Failure |
|---|---:|---:|---:|---:|---:|---:|---|---|
| E01 | 0.900 | 0.950 | 0.818 | 0.667 | 1.000 | 0.828 | Yes | - |
| E02 | 0.950 | 1.000 | 1.000 | 0.571 | 0.500 | 0.690 | Yes | - |
| E03 | 0.733 | 1.000 | 0.909 | 0.600 | 0.667 | 0.725 | Yes | - |
| E04 | 0.833 | 1.000 | 0.800 | 0.600 | 0.667 | 0.689 | Yes | - |
| E05 | 0.941 | 0.950 | 0.909 | 1.000 | 0.588 | 0.832 | Yes | - |
| M01 | 1.000 | 0.887 | 0.600 | 0.667 | 0.720 | 0.662 | Yes | - |
| M02 | 0.906 | 0.917 | 0.972 | 0.667 | 0.906 | 0.848 | Yes | - |
| M03 | 0.897 | 1.000 | 0.818 | 0.625 | 0.586 | 0.676 | Yes | - |
| M04 | 0.935 | 0.917 | 0.939 | 0.538 | 0.903 | 0.794 | Yes | - |
| M05 | 0.967 | 1.000 | 0.739 | 0.846 | 0.900 | 0.828 | Yes | - |
| M06 | 0.976 | 1.000 | 0.914 | 1.000 | 0.707 | 0.874 | Yes | - |
| M07 | 0.950 | 1.000 | 0.958 | 0.545 | 0.550 | 0.685 | Yes | - |
| H01 | 0.889 | 1.000 | 0.657 | 0.714 | 0.704 | 0.692 | Yes | - |
| H02 | 0.913 | 1.000 | 0.786 | 0.833 | 0.478 | 0.699 | No | off_topic |
| H03 | 0.722 | 1.000 | 0.500 | 0.462 | 0.556 | 0.506 | No | off_topic |
| H04 | 1.000 | 0.887 | 0.710 | 0.727 | 0.852 | 0.763 | Yes | - |
| H05 | 0.975 | 0.950 | 0.692 | 0.364 | 0.650 | 0.569 | No | off_topic |
| A01 | 0.000 | 0.000 | 0.067 | 0.571 | 0.000 | 0.213 | No | hallucination |
| A02 | 1.000 | 1.000 | 0.818 | 0.583 | 0.276 | 0.559 | No | incomplete |
| A03 | 0.760 | 0.867 | 0.688 | 0.538 | 0.360 | 0.529 | No | off_topic |

**Aggregate report:** pass rate **70.0%**; average Context Recall **0.862**; Context Precision **0.916**; Faithfulness **0.765**; Relevance **0.656**; Completeness **0.628**; failure distribution **4 off_topic, 1 hallucination, 1 incomplete**.

**Three lowest-scoring cases:** A01 = **0.213** (`hallucination`), H03 = **0.506** (`off_topic`), A03 = **0.529** (`off_topic`).

Retrieval is healthy: recall and precision are 0.862 and 0.916. The remaining weakness is answer-side, especially completeness (0.628) and relevance (0.656). The model is generally grounded (faithfulness 0.765), but it omits safety/privacy details and some policy conditions in adversarial/hard cases.

### Exercise 3.3 — LLM-as-a-Judge rubric

Dimensions: correctness, completeness, evidence, actionability, safety/privacy.

| Score | OrbitTech-specific criterion | Example |
|---:|---|---|
| 5 | Correct, complete, concise, grounded, preserves dates/amounts/conditions/exceptions, and gives safe next steps. | Exact policy window, fee, exception, and action. |
| 4 | Substantively correct and grounded with one minor non-critical omission. | Correct window and fee but omits a secondary process detail. |
| 3 | Useful main direction but misses a material condition or uses an imprecise claim. | Says “30 days” without checking order date. |
| 2 | Major omission, unsupported claim, wrong policy version, or unusable action. | Promises refund while a carrier trace is active. |
| 1 | Wrong, irrelevant, unsafe, privacy-violating, or follows injection. | Requests a password or advises charging a swollen device. |

Edge cases: policy version with missing order date (ask rather than guess); insufficient evidence (explicit limitation beats invention); and mixed safety/privacy questions (one unsafe instruction caps the response at 1). Controls: randomize answer order, use length-matched controls, hide model identity, run multiple judges, and calibrate against human labels.

### Exercise 3.4 — Framework comparison bonus

| Criterion | RAGAS | DeepEval |
|---|---|---|
| Focus | RAG metrics and retrieval diagnosis. | Developer-facing LLM unit tests and assertions. |
| CI/CD | Batch score thresholds/reports. | Natural per-test pass/fail gates. |
| Same dataset | Compare using identical 20 cases, contexts, model, and threshold. Scores may differ while failure clusters should broadly agree. | Same protocol. |

### Exercise 3.5 — Retrieval reranking bonus

| ID | Recall before | Recall after | Precision before | Precision after | Delta |
|---|---:|---:|---:|---:|---:|
| E01 | 0.900 | 0.900 | 0.950 | 1.000 | +0.050 |
| M01 | 1.000 | 1.000 | 0.887 | 1.000 | +0.113 |
| M03 | 0.897 | 0.897 | 1.000 | 1.000 | +0.000 |
| H01 | 0.889 | 0.889 | 1.000 | 1.000 | +0.000 |
| A03 | 0.760 | 0.760 | 0.867 | 1.000 | +0.133 |
| **Avg** | **0.889** | **0.889** | **0.941** | **1.000** | **+0.059** |

Reproduced by `rerank_analysis.py` and saved in
`artifacts/reranking_results.json`. The experiment passes each golden
`expected_answer` as the offline analysis query to the lexical reranker. This
is intentionally reference-guided for the bonus measurement only; production
retrieval must not use `expected_answer` because that would be data leakage.

Recall is unchanged because reranking preserves the retrieved set. Reranking is insufficient when evidence never enters top-k, query synonyms are missing, chunks split claims, or the corpus lacks evidence; then change query expansion, retriever, chunking, or corpus coverage.

## Completion status

Core implementation, real OpenAI generation, validation, benchmark artifacts, worksheet, reflection, rubric, failure analysis, and bonus exercises are complete.
