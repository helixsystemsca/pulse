"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  fetchProcedureVerificationState,
  postProcedureQuizStart,
  postProcedureQuizSubmit,
  postProcedureTrainingAcknowledgement,
  postProcedureVerificationView,
  type ProcedureVerificationStateApi,
} from "@/lib/trainingApi";

type QuizQuestion = { id: string; prompt: string; choices: string[] };

export function ProcedureKnowledgeVerification({
  procedureId,
  procedureTitle,
  onRefreshTraining,
}: {
  procedureId: string;
  procedureTitle: string;
  onRefreshTraining: () => Promise<void>;
}) {
  const [state, setState] = useState<ProcedureVerificationStateApi | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ackConfirm, setAckConfirm] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [failedQuestionsSnapshot, setFailedQuestionsSnapshot] = useState<QuizQuestion[] | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    passed: boolean;
    score_percent: number;
    reveal: Record<string, { correct_index: number; your_index: number; was_correct: boolean }>;
  } | null>(null);

  const reload = useCallback(async () => {
    setLoadErr(null);
    try {
      const s = await fetchProcedureVerificationState(procedureId);
      setState(s);
      if (s.quiz_passed_at) {
        setSessionId(null);
        setQuestions([]);
        setSubmitResult(null);
      }
    } catch (e) {
      setLoadErr(parseClientApiError(e).message);
    }
  }, [procedureId]);

  useEffect(() => {
    setAckConfirm(false);
    setFailedQuestionsSnapshot(null);
    setSubmitResult(null);
    setSessionId(null);
    setQuestions([]);
    setQIndex(0);
    setAnswers({});
  }, [procedureId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!state?.verification_required) return;
    const id = window.setInterval(() => {
      void postProcedureVerificationView(procedureId, 25).catch(() => {});
    }, 25000);
    void postProcedureVerificationView(procedureId, 3).catch(() => {});
    return () => window.clearInterval(id);
  }, [procedureId, state?.verification_required]);

  const step = useMemo(() => {
    if (!state?.verification_required) return 4;
    if (state.quiz_passed_at) return 4;
    if (sessionId || questions.length) return 3;
    if (state.acknowledged_for_revision) return 3;
    if (state.first_viewed_at) return 2;
    return 1;
  }, [state, sessionId, questions.length]);

  const acknowledge = async () => {
    if (!ackConfirm) {
      setLoadErr("Check the box to confirm you have read and understood this procedure.");
      return;
    }
    setBusy(true);
    setLoadErr(null);
    try {
      await postProcedureTrainingAcknowledgement(procedureId);
      setAckConfirm(false);
      await reload();
      await onRefreshTraining();
    } catch (e) {
      setLoadErr(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const startQuiz = async () => {
    setBusy(true);
    setLoadErr(null);
    setSubmitResult(null);
    setFailedQuestionsSnapshot(null);
    try {
      const out = await postProcedureQuizStart(procedureId);
      setSessionId(out.session_id);
      setQuestions((out.questions ?? []) as QuizQuestion[]);
      setQIndex(0);
      setAnswers({});
    } catch (e) {
      setLoadErr(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const currentQ = questions[qIndex] ?? null;

  const submitQuiz = async () => {
    if (!sessionId) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await postProcedureQuizSubmit(procedureId, { session_id: sessionId, answers });
      setSubmitResult({
        passed: res.passed,
        score_percent: res.score_percent,
        reveal: res.reveal ?? {},
      });
      if (res.passed) {
        setSessionId(null);
        setQuestions([]);
        setFailedQuestionsSnapshot(null);
        await reload();
        await onRefreshTraining();
      } else {
        setFailedQuestionsSnapshot(questions);
        setSessionId(null);
        setQuestions([]);
        setQIndex(0);
        setAnswers({});
      }
    } catch (e) {
      setLoadErr(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (!state?.verification_required) {
    return (
      <p className="text-sm text-ds-muted">
        Knowledge verification is turned off for this procedure — use the standard completion sign-off when available.
      </p>
    );
  }

  if (state.quiz_passed_at) {
    return (
      <div className="rounded-xl border border-teal-500/35 bg-teal-50/90 px-4 py-4 dark:bg-teal-950/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          Acknowledgment and knowledge verification complete
        </div>
        <p className="mt-2 text-sm text-teal-950/80 dark:text-teal-100/85">
          This procedure is recorded as verified for revision {state.revision_number}. Your training matrix updates on the
          next refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-ds-border bg-ds-secondary/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="h-5 w-5 text-ds-muted" aria-hidden />
        <h3 className="text-sm font-semibold text-ds-foreground">Procedure acknowledgment & knowledge check</h3>
      </div>
      <p className="text-sm text-ds-muted">
        Lightweight verification for <span className="font-medium text-ds-foreground">{procedureTitle}</span> — review
        the steps, sign off that you read them, then answer a short multiple-choice check. All questions must be correct;
        you can retry as needed.
      </p>

      <ol className="flex flex-wrap gap-2 text-xs font-semibold">
        {[
          { n: 1, label: "Review" },
          { n: 2, label: "Acknowledge" },
          { n: 3, label: "Verify" },
        ].map((s) => (
          <li
            key={s.n}
            className={cn(
              "rounded-full px-3 py-1.5",
              step >= s.n ? "bg-sky-600 text-white" : "bg-ds-primary text-ds-muted ring-1 ring-ds-border",
            )}
          >
            {s.n}. {s.label}
          </li>
        ))}
      </ol>

      {loadErr ? (
        <p className="text-sm font-medium text-ds-danger" role="alert">
          {loadErr}
        </p>
      ) : null}

      <div className="rounded-lg border border-ds-border bg-ds-primary px-4 py-3 text-sm text-ds-muted">
        <span className="font-semibold text-ds-foreground">Review time tracked:</span>{" "}
        {state.total_view_seconds < 60
          ? `${state.total_view_seconds}s`
          : `${Math.round(state.total_view_seconds / 60)} min`}{" "}
        cumulative on this revision
        {state.first_viewed_at ? "" : " — keep this panel open while you read the steps above."}
      </div>

      {step === 2 && state.can_acknowledge ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ds-border bg-ds-primary p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 rounded border-ds-border"
              checked={ackConfirm}
              onChange={(e) => setAckConfirm(e.target.checked)}
            />
            <span>
              I acknowledge that I have read and understood this procedure.{" "}
              <span className="text-ds-muted">(Required before the knowledge check.)</span>
            </span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void acknowledge()}
            className="flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Save acknowledgment
          </button>
        </div>
      ) : null}

      {step === 2 && !state.can_acknowledge && !state.acknowledged_for_revision ? (
        <p className="text-sm text-ds-muted">Finish scanning the procedure steps above — acknowledgment unlocks after a brief review.</p>
      ) : null}

      {state.acknowledged_for_revision && !sessionId && questions.length === 0 && !submitResult ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy || !state.can_start_quiz}
            onClick={() => void startQuiz()}
            className="flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" aria-hidden />}
            Start knowledge check
          </button>
          {state.quiz_attempt_count > 0 ? (
            <p className="text-xs text-ds-muted">
              Attempts on this revision: {state.quiz_attempt_count}
              {state.quiz_latest_score_percent != null ? ` · Latest score ${state.quiz_latest_score_percent}%` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {currentQ && sessionId ? (
        <div className="space-y-4 rounded-lg border border-ds-border bg-ds-primary p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">
            Question {qIndex + 1} of {questions.length}
          </p>
          <p className="text-base font-medium leading-snug text-ds-foreground">{currentQ.prompt}</p>
          <div className="grid gap-2">
            {currentQ.choices.map((c, idx) => (
              <button
                key={`${currentQ.id}-${idx}`}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: idx }))}
                className={cn(
                  "min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  answers[currentQ.id] === idx
                    ? "border-sky-600 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-50"
                    : "border-ds-border bg-ds-secondary/40 hover:bg-ds-interactive-hover",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {qIndex > 0 ? (
              <button
                type="button"
                className="rounded-xl border border-ds-border px-4 py-2.5 text-sm font-semibold"
                onClick={() => setQIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </button>
            ) : null}
            {qIndex < questions.length - 1 ? (
              <button
                type="button"
                disabled={answers[currentQ.id] === undefined}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => setQIndex((i) => i + 1)}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || questions.some((q) => answers[q.id] === undefined)}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => void submitQuiz()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit answers
              </button>
            )}
          </div>
        </div>
      ) : null}

      {submitResult && !submitResult.passed ? (
        <div className="space-y-3 rounded-lg border border-ds-danger/40 bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] p-4">
          <p className="text-sm font-semibold text-ds-danger">Score {submitResult.score_percent}% — try again</p>
          <p className="text-sm text-ds-foreground">
            Review the correct choices below. When you are ready, start another attempt — unlimited retries are allowed.
          </p>
          <ul className="max-h-64 space-y-3 overflow-y-auto text-sm">
            {Object.entries(submitResult.reveal)
              .filter(([, v]) => !v.was_correct)
              .map(([qid, v]) => {
                const snap = failedQuestionsSnapshot?.find((q) => q.id === qid);
                const wrongLabel = snap?.choices[v.your_index] ?? `Option ${v.your_index + 1}`;
                const rightLabel = snap?.choices[v.correct_index] ?? `Option ${v.correct_index + 1}`;
                return (
                  <li key={qid} className="rounded-md border border-ds-border bg-ds-primary px-3 py-3">
                    <p className="font-medium text-ds-foreground">{snap?.prompt ?? "Question"}</p>
                    <p className="mt-1 text-xs text-ds-muted">
                      Your answer: <span className="text-ds-danger">{wrongLabel}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ds-muted">
                      Correct: <span className="font-semibold text-teal-800 dark:text-teal-200">{rightLabel}</span>
                    </p>
                  </li>
                );
              })}
          </ul>
          <button
            type="button"
            className="min-h-12 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white"
            onClick={() => {
              setSubmitResult(null);
              void startQuiz();
            }}
          >
            New attempt
          </button>
        </div>
      ) : null}
    </div>
  );
}
