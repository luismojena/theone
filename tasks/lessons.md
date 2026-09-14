# Lessons Learned

## 1. Project Task Tracking Consistency

* **Mistake**: Did not proactively update the task checklist in `tasks/todo.md` when a new request was introduced (e.g. moving all database/cache/export files into the `migrations/` folder).
* **Pattern**: When a user introduces a new design change or feature request mid-session, first append it to `tasks/todo.md` as an open task, align on the plan, implement, and then mark it completed. This ensures the tracking document is always synchronous with the actual repository state.
* **Self-Prevention Rule**:
  * Before starting any code edits or commands for a new request, check if it's explicitly documented in `tasks/todo.md`. If not, make a task update your very first action.
