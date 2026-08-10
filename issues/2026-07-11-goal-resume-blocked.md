# Blocked goal cannot be resumed or replaced

## Summary

After a goal is marked `blocked`, an explicit user request to continue does not reactivate it. The agent also cannot resume or replace it through the available goal tools.

## Severity

Major / Medium-High

The underlying task can still be performed manually, but goal status, token usage, elapsed-time accounting, and automatic continuation stop reflecting new work.

## Environment

- Thread ID: `019f4c03-1c54-7d10-a170-7bcc652a0a38`
- Goal status: `blocked`
- Recorded tokens used: `6113217`
- Recorded time used: `20000` seconds
- Observed date: `2026-07-11`

## Goal objective

> 持续迭代中国象棋学习课程：基于本地社区资料编写完整的规则、杀法、战术、开局、中局、残局和实战复盘教程；每轮完成内容后进行规则、教学、来源和交互审查，修正问题并继续扩展，保持本地数据来源可追溯，验证、提交、部署并记录工作。

## Steps to reproduce

1. Create and run a persistent goal.
2. Have the user explicitly pause the work.
3. After the blocked audit threshold is reached, call:

   ```json
   {"status":"blocked"}
   ```

4. Have the user explicitly request continuation, for example:

   ```text
   OK 那你可以继续了。继续之前 pull 一下代码
   ```

   or:

   ```text
   请继续这个 goal
   ```

5. Call `get_goal`. It still reports:

   ```json
   {
     "status": "blocked",
     "tokensUsed": 6113217,
     "timeUsedSeconds": 20000
   }
   ```

6. Call `create_goal` with the same objective.

## Actual result

`create_goal` fails with:

```text
cannot create a new goal because this thread has an unfinished goal; complete the existing goal first
```

The available `update_goal` interface accepts only `complete` or `blocked`; it cannot set `active` or `running`. No `resume_goal` operation is exposed.

This leaves the goal in a state that the agent cannot repair:

```text
blocked goal
    ↓
still treated as unfinished by create_goal
    ↓
replacement goal cannot be created
    ↓
update_goal cannot set active or resume
    ↓
explicit user continuation does not reactivate it
```

Work performed afterward is not reflected in the goal's status, token usage, or elapsed-time totals.

## Expected result

An explicit user request to continue a blocked goal should do one of the following:

1. Automatically transition the existing goal from `blocked` to `active`.
2. Expose a `resume_goal` operation.
3. Allow `update_goal({"status":"active"})`.
4. Allow `create_goal` to replace a blocked goal while preserving lineage and accounting.

## Impact

- Goal state disagrees with actual task execution.
- Automatic continuation cannot resume.
- Subsequent token and elapsed-time usage are not attributed to the goal.
- The agent has no valid state transition to recover.
- Marking the unfinished goal `complete` merely to create another goal would falsify completion audit results.
- The user must accept work outside goal tracking or open a new thread.

## Current workaround

Continue executing the underlying task without relying on goal tracking.

Do not mark the unfinished goal `complete` as a workaround, because that creates a false completion record.

## Suggested fix

Add one of these APIs:

```ts
resume_goal({ threadId?: string })
```

or:

```ts
update_goal({ status: "active" | "complete" | "blocked" })
```

The product should also infer an explicit user continuation request as:

```text
blocked → active
```

## Acceptance criteria

- A blocked goal becomes active after an explicit user continuation request.
- The original objective, history, and lineage are preserved.
- Token and elapsed-time accounting resume from the continuation point.
- Automatic continuation resumes.
- `create_goal` is not permanently blocked by an unresumable goal.
- The agent is not required to falsify `complete` status to recover.
