"use client";

import { motion } from "framer-motion";
import { bpTransition } from "@/lib/motion-presets";
import type { TaskOverlay } from "./blueprint-types";

export type TaskStepHighlight = { taskId: string; stepIndex: number };

type Props = {
  tasks: TaskOverlay[];
  disabled: boolean;
  selectedTaskId: string | null;
  onSelectTaskId: (id: string | null) => void;
  linkingForTaskId: string | null;
  onLinkingForTaskId: (id: string | null) => void;
  /** Desktop: pointer enter/leave on a step row */
  highlightStep: TaskStepHighlight | null;
  onHighlightStep: (h: TaskStepHighlight | null) => void;
  /** Mobile / tap: pin step highlight (toggle) */
  pinnedStep: TaskStepHighlight | null;
  onPinnedStep: (h: TaskStepHighlight | null) => void;
  emphasizedTaskIds: Set<string>;
  onPatchTask: (id: string, patch: Partial<TaskOverlay>) => void;
  onAddTask: () => void;
  onDeleteTask: (id: string) => void;
};

export function BlueprintTasksPanel({
  tasks,
  disabled,
  selectedTaskId,
  onSelectTaskId,
  linkingForTaskId,
  onLinkingForTaskId,
  highlightStep,
  onHighlightStep,
  pinnedStep,
  onPinnedStep,
  emphasizedTaskIds,
  onPatchTask,
  onAddTask,
  onDeleteTask,
}: Props) {
  const stepRing = (taskId: string, stepIndex: number) =>
    pinnedStep?.taskId === taskId && pinnedStep.stepIndex === stepIndex;

  const stepHover = (taskId: string, stepIndex: number) =>
    highlightStep?.taskId === taskId && highlightStep.stepIndex === stepIndex;

  const onStepClick = (taskId: string, stepIndex: number) => {
    if (disabled) return;
    if (pinnedStep?.taskId === taskId && pinnedStep.stepIndex === stepIndex) onPinnedStep(null);
    else onPinnedStep({ taskId, stepIndex });
  };

  return (
    <div className={`bp-tasks${disabled ? " bp-tasks--disabled" : ""}`}>
      <h3>Tasks</h3>
      <p className="bp-hint">Link on-canvas elements to checklists or notes. Hover a step to highlight links.</p>
      <button type="button" className="bp-btn bp-btn--ghost bp-tasks__add" disabled={disabled} onClick={onAddTask}>
        + Add task
      </button>
      <div className="bp-tasks__list" role="list">
        {tasks.length === 0 ? (
          <p className="bp-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            No tasks yet.
          </p>
        ) : null}
        {tasks.map((t) => {
          const sel = selectedTaskId === t.id;
          const emph = emphasizedTaskIds.has(t.id);
          const linking = linkingForTaskId === t.id;
          return (
            <motion.div
              key={t.id}
              role="listitem"
              layout
              className={`bp-task-card${sel ? " is-selected" : ""}${emph ? " is-emphasized" : ""}${linking ? " is-linking" : ""}`}
              transition={bpTransition.fast}
            >
              <div className="bp-task-card__head">
                <button
                  type="button"
                  className="bp-task-card__title-btn"
                  disabled={disabled}
                  onClick={() => onSelectTaskId(sel ? null : t.id)}
                >
                  {t.title || "Untitled task"}
                </button>
                <button
                  type="button"
                  className="bp-task-card__icon"
                  disabled={disabled}
                  title="Delete task"
                  aria-label="Delete task"
                  onClick={() => onDeleteTask(t.id)}
                >
                  ×
                </button>
              </div>
              {sel && !disabled ? (
                <div className="bp-task-card__edit">
                  <label className="bp-task-card__label">
                    Title
                    <input
                      value={t.title}
                      onChange={(e) => onPatchTask(t.id, { title: e.target.value })}
                      maxLength={400}
                    />
                  </label>
                  <div className="bp-task-card__modes">
                    <label>
                      <input
                        type="radio"
                        name={`mode-${t.id}`}
                        checked={t.mode === "steps"}
                        onChange={() =>
                          onPatchTask(t.id, {
                            mode: "steps",
                            content:
                              t.mode === "paragraph"
                                ? String(t.content)
                                    .split(/\n+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : [...(t.content as string[])],
                          })
                        }
                      />{" "}
                      Steps
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`mode-${t.id}`}
                        checked={t.mode === "paragraph"}
                        onChange={() =>
                          onPatchTask(t.id, {
                            mode: "paragraph",
                            content:
                              t.mode === "steps" ? (t.content as string[]).join("\n\n") : String(t.content),
                          })
                        }
                      />{" "}
                      Paragraph
                    </label>
                  </div>
                  {t.mode === "paragraph" ? (
                    <textarea
                      className="bp-task-card__body"
                      rows={4}
                      value={String(t.content)}
                      onChange={(e) => onPatchTask(t.id, { content: e.target.value })}
                      placeholder="Single block of instructions…"
                    />
                  ) : (
                    <textarea
                      className="bp-task-card__body"
                      rows={5}
                      value={(t.content as string[]).join("\n")}
                      onChange={(e) =>
                        onPatchTask(t.id, {
                          content: e.target.value.split("\n"),
                        })
                      }
                      placeholder={"One step per line"}
                    />
                  )}
                  <div className="bp-task-card__links">
                    <span className="bp-task-card__muted">
                      {t.linked_element_ids.length} linked element{t.linked_element_ids.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      className={`bp-btn--link ${linking ? "is-on" : ""}`}
                      onClick={() => onLinkingForTaskId(linking ? null : t.id)}
                    >
                      {linking ? "Done linking" : "Link elements"}
                    </button>
                  </div>
                </div>
              ) : null}
              {!sel ? (
                <div className="bp-task-card__preview">
                  {t.mode === "paragraph" ? (
                    <p
                      className={`bp-task-paragraph${emph ? " is-emphasized-text" : ""}${highlightStep?.taskId === t.id ? " is-highlight" : ""}`}
                      onMouseEnter={() => !disabled && onHighlightStep({ taskId: t.id, stepIndex: -1 })}
                      onMouseLeave={() => !disabled && onHighlightStep(null)}
                      onClick={() => {
                        if (disabled) return;
                        if (pinnedStep?.taskId === t.id && pinnedStep.stepIndex === -1) onPinnedStep(null);
                        else onPinnedStep({ taskId: t.id, stepIndex: -1 });
                      }}
                    >
                      {String(t.content).slice(0, 200)}
                      {String(t.content).length > 200 ? "…" : ""}
                    </p>
                  ) : (
                    <ol className="bp-task-steps">
                      {(t.content as string[]).map((line, i) => (
                        <li
                          key={`${t.id}-s-${i}`}
                          className={`bp-task-step${stepHover(t.id, i) ? " is-highlight" : ""}${stepRing(t.id, i) ? " is-pinned" : ""}${emph ? " is-emphasized-text" : ""}`}
                          onMouseEnter={() => !disabled && onHighlightStep({ taskId: t.id, stepIndex: i })}
                          onMouseLeave={() => !disabled && onHighlightStep(null)}
                          onClick={() => onStepClick(t.id, i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onStepClick(t.id, i);
                            }
                          }}
                          role="button"
                          tabIndex={disabled ? -1 : 0}
                        >
                          {line || `Step ${i + 1}`}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
