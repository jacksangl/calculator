# Repository instructions

## Branches and commits

- For each new user request that involves repository changes, create and switch to a new, descriptive branch before editing files. Continue on that branch for follow-ups to the same task.
- Work directly on `main` only when the user explicitly asks you to do so.
- Commit the changes you make before reporting the task complete. Run the relevant checks first and use a descriptive commit message.
- Stage only files and changes belonging to the task. Preserve unrelated user changes and do not include them in your commits.
- After checks pass and changes are committed, push the task branch and open a pull request targeting `main`. For follow-ups, update the existing pull request.
- Do not merge task branches into `main` locally. Leave pull requests open for review; merge a pull request only when the user explicitly requests it.
- Keep `main` fast-forward-only: configure `git config --local branch.main.mergeOptions --ff-only` and `git config --local pull.ff only` in this checkout. These settings reject divergent merges and pulls when `main` has local commits; they do not prevent direct commits or all local fast-forward merges. Never override these settings to bypass a rejection.
- If the user explicitly asks you not to branch or commit for a particular task, follow that instruction.
