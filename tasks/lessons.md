# Lessons Learned

## 1. Project Task Tracking Consistency

* **Mistake**: Did not proactively update the task checklist in `tasks/todo.md` when a new request was introduced (e.g. moving all database/cache/export files into the `migrations/` folder).
* **Pattern**: When a user introduces a new design change or feature request mid-session, first append it to `tasks/todo.md` as an open task, align on the plan, implement, and then mark it completed. This ensures the tracking document is always synchronous with the actual repository state.
* **Self-Prevention Rule**:
  * Before starting any code edits or commands for a new request, check if it's explicitly documented in `tasks/todo.md`. If not, make a task update your very first action.

## 2. Composition Over Inheritance (Avoiding the "God Object")

* **Mistake**: Initially relying on an abstract `BaseAnimePlatform` class that housed cross-cutting concerns (like HTTP request retry logic and generic header injection). This created a God Object anti-pattern where the base class had too many reasons to change.
* **Pattern**: Favor Composition over Inheritance. We extracted the HTTP logic into a distinct `HttpClient` class and passed it into the platforms (which now implement `IAnimePlatform` as an interface rather than extending a class).
* **Self-Prevention Rule**:
  * When adding shared utility functionality across multiple services or providers, consider extracting it into a specialized helper class that can be injected or instantiated (Composition), rather than injecting it into a parent class hierarchy.

## 3. Trusting the Linter Config

* **Mistake**: When tasked with sorting imports, the immediate reaction could be to install new plugins or drastically alter configurations, missing that the current linter (Biome) already supported and had the feature enabled.
* **Pattern**: Always check the existing tooling and configuration files (like `biome.json`, `.eslintrc`, or `package.json`) to understand what is already supported before making changes or pulling in external tools.
