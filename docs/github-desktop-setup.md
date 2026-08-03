# Chord Hoard: GitHub Desktop setup

One-time setup, about fifteen minutes. After this, shipping a change is: look at the
diff, write a line, click Push.

---

## First, one decision: where the folder lives

Your project is currently at `Z:\jackw\Z Drive Documents\Chords Dashboard`.

**If Z: is a mapped network drive**, put the clone somewhere local instead. GitHub
Desktop has a long-standing bug cloning to SMB-mapped drives: it fails with
`Unable to create '.../.git/refs/remotes/origin/HEAD.lock': no such file or directory`
unless the share grants "Read Attributes" NTFS permission ([issue
#12213](https://github.com/desktop/desktop/issues/12213)). Even when it works, git on a
network drive is slow, because git touches thousands of small files per operation.

Suggested local path:

```
C:\Users\jackw\Documents\chord-hoard
```

**If Z: is just a lettered local partition**, ignore all that and clone wherever you
like, including under Z:.

Everything below assumes the local path. Substitute your own if you picked differently.

---

## 1. Install and sign in

1. Download from **https://desktop.github.com/download** and install. It is free.
2. On first launch, sign in with the GitHub account that owns `jdw96/chord-hoard`.
3. It will ask for a name and email for your commits. Anything sensible is fine; they
   are stamped on every commit and are visible in a public repo.

## 2. Clone the repo

1. **File → Clone repository**
2. Pick the **GitHub.com** tab. `jdw96/chord-hoard` should be in the list. If it is not,
   paste the URL on the **URL** tab: `https://github.com/jdw96/chord-hoard`
3. Set **Local path** to `C:\Users\jackw\Documents` (GitHub Desktop appends the repo
   name, giving you `...\Documents\chord-hoard`).
4. **Clone.**

You now have a folder containing everything that is currently live, plus a hidden `.git`
folder holding the history. Do not touch `.git`.

## 3. Check it looks right

Open the new folder. You should see `index.html`, `css/`, `js/`, `data/`, `icons/`,
`sw.js`, `manifest.webmanifest`. If `js/ui/chord-copy.js` is **missing**, that is
correct and expected: it is part of today's work, which has not been uploaded yet.

## 4. Get today's work into it

The repo is behind your local folder by the phase 2.5 changes. Nine files:

```
js/ui/chord-copy.js      (new)
js/ui/chords-lib.js
js/ui/scales-lib.js
js/ui/app.js
css/app.css
sw.js
tools/test-copy.js       (new)
CLAUDE.md
docs/phase-2.5-copy.md   (new)
```

Two ways to move them:

- **By hand.** Copy those nine from `Z:\jackw\Z Drive Documents\Chords Dashboard` into
  the matching places in the clone, overwriting. Create `docs\` if it is not there.
- **Let me do it.** In the Claude desktop app, click **Add folder** and add the new
  clone. Tell me it is added and I will write all nine in, in the right places, from the
  copies I already have.

## 5. Your first push

1. Open GitHub Desktop. The **Changes** tab now lists the modified files.
2. Click through a couple and read the diff. Green is added, red is removed. This is the
   part that makes the whole exercise worth it: nothing reaches the live site without
   you having seen exactly what changed.
3. Bottom left, write a summary. For this one:

   ```
   Phase 2.5: shared chord copy tables, instrument toggle scope, scale-note links
   ```

4. **Commit to main.**
5. Top bar, **Push origin.**

Give GitHub Pages about a minute, then open
https://jdw96.github.io/chord-hoard/ and hard-refresh with **Ctrl+F5**. The service
worker caches aggressively, so a normal refresh may show you the old version.

## 6. Retire the old folder

Once the live site shows the new Chords tab, the clone is the real project and the old
folder is a stale copy. Rename it to `Chords Dashboard (old)` so there is no ambiguity
about which one is which, and delete it whenever you are comfortable.

In the Claude desktop app, remove the old folder from your connected folders and keep
the clone.

---

## What changes for our sessions

**Before:** I write files, you drag six or nine of them into the GitHub web uploader one
at a time, hoping you got the paths right.

**After:** I write files straight into the clone. You open GitHub Desktop, read the
diff, click Commit then Push. Two clicks, and you have seen the change first.

You also get:

- **Undo.** Right-click any commit in the History tab and revert it. Currently a bad
  upload is only fixable by uploading the old file again, if you still have it.
- **A record.** History shows what changed, when, and why. No more wondering whether the
  live site matches your folder.
- **A safety net.** If a session goes wrong, `git checkout` throws away my changes and
  puts you back where you were.

---

## Things that will trip you up

**"Push origin" is greyed out.** You have not committed yet. Commit first, then push.

**GitHub Desktop shows changes you did not make.** Usually line endings. If every file
shows as fully changed, tell me and I will set `core.autocrlf` correctly rather than you
guessing at it.

**The live site does not update.** Two causes, in order of likelihood. Either the
service worker is serving a cached copy, which Ctrl+F5 fixes, or `CACHE_VERSION` in
`sw.js` was not bumped, which is my job to remember on every change that touches a
shipped file. Today's is already bumped to `chordhoard-v2`.

**You want to undo something you already pushed.** History tab, right-click the commit,
**Revert changes in commit**. That makes a new commit undoing it, then push. Safe, and
it keeps the record of what happened.

---

## If you would rather not

The web uploader still works and today's files are already on your disk. This is a
convenience change, not a prerequisite for anything. It just gets better the more
sessions we do, because every one of them currently ends with you doing the same
manual drag.
