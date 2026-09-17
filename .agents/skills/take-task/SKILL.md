---
name: take-task
description: >
  Start work on a HackSpain Linear issue: check it is free, move it to In
  Progress, check out the branch the webhook created, and confirm the local
  environment is green. Use when the user says "take HSP-12", "start on this
  issue", "cojo esta tarea", "empiezo con", or pastes a Linear issue link.
---

# Take a task

## Step 1 - Check the issue is free

Read the issue in Linear (MCP `linear`). Refuse politely and stop if any of these holds:

- It is assigned to someone else and already In Progress or In Review.
- It is Blocked: read the blocker first, do not start on it.
- The user already has another issue In Progress. One issue in progress per person; ask which one to park.

## Step 2 - Claim it

Assign the issue to the user and move it to **In Progress**.
The Linear webhook then creates `hsp-<number>-<slug>` from `staging` and links it to the issue.
Wait for the branch to appear:

```bash
git fetch origin
git branch -r --list 'origin/hsp-<number>-*'
```

If it is not there after 30 seconds, tell the user to check the webhook Worker; do not create the branch by hand.

## Step 3 - Check out and verify

```bash
git checkout hsp-<number>-<slug>
bun install
bun run verify
```

A red `verify` on a fresh branch is a `staging` problem, not the user's. Report it and stop.

## Step 4 - Frame the work

Restate in two lines what "done" means for this issue, using its description and labels (`area:*` tells you which workspace you touch).
Ask before starting only if the issue text is ambiguous in a way that changes the code you would write.

## Never

- Create or rename branches locally.
- Work on an issue that is not In Progress and assigned to the user.
- Reopen a Done issue; create a follow-up instead.
