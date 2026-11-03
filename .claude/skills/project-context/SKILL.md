---
name: project-context
description: What Helix knows: its pinned documents, the incidents on its own systems and the tests used for testing. Read before changing code in an area that has had an incident.
---

# Project context: Helix

Not finalised: the Tech Lead has not finalised this pack, so treat it as a working set.

0 documents, 0 approved incidents, 0 live tests; not live yet.

## How to use this

- `documents.md` lists the documents pinned at a version. Ask the Workbench to search them for the text; this folder holds the list, not the documents.
- `incidents.md` holds the incidents Quality approved: what happened, the cause, the fix and the lesson. Read the ones in the area you are changing before you change it.
- `tests.md` holds the tests used for testing. A regression case stays in every later run until a person retires it with a reason, so do not delete or weaken one; ask the Tech Lead.
- If `changes/<story-id>.md` is here for the story you are working on, read it first: it is the change brief for code that already exists (what changes, the impact note, what must still pass).

## This package is not locked

It changes as the project learns, and it holds no policy. The rules the project must follow are in the `project-policy` package, which takes precedence.
