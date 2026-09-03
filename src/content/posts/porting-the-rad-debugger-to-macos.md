---
title: Porting the RAD Debugger to macOS
date: 2026-09-02
description: Why I ported Epic's debugger to the Mac, how the work was split between agents and hand-written code, and how the branch DAG is maintained.
---

The port itself, with a branch-by-branch breakdown, is at
[robert.wittams.com/raddebugger](/raddebugger/).

<figure>
  <a href="/raddbg-delete-account.png">
    <img src="/raddbg-delete-account-zoom.png" width="1838" height="235"
      alt="The RAD Debugger stopped at a source breakpoint on a line that reads: delete your_account;" />
  </a>
  <figcaption>One of the example targets, stopped at a source breakpoint. Click for the full window.</figcaption>
</figure>

## Why do this? 

I wanted to: 

- See what all the fuss was about with this debugger - all the good debuggers are on Windows apparently! I was also interested in the immediate mode gui style and how that was pulled off for a quite involved interface.
- Refresh on assembly and low level development - I've known C and assembly for 30+ years - but I don't do it all the time.
- See how far I could push agents on this kind of work, and how much of a productivity boost they can provide.
- Come up with a workable model for 'long-lived personal forks' - I haven't fully achieved this yet, but I believe it is where software is going. I have a few more of these I may write up later. 

I don't really expect this to be upstreamed and that is fine! I didn't quite realise how strong the anti LLM sentiments were amongst some in the community, so this is provided as is.

## How the port was made

I broke down the work into architectural layers that could be proven end to end.
Most of the work was produced using GPT-5.3-codex and GPT-5.5 in codex cli.

 - The work was interactive, not fire-and-forget (factory style).
 - HTML explorations of the codebase (and sometimes changes) were produced using Claude Design (Opus 4.6 onwards). This was helpful to navigate unfamiliar areas and visualize things.
 - I did research using the sources below.
 - I used the debugger to manually test (after it was bootstrapped to roughly working).
 - Often, agents were unreliable on precise semantics until given a verification
   loop — driving the debugger with its own commands, gui interactions (enhancing the debugger cli interface to allow this). <br>
   I used some of my existing tools for this to let the agents do platform comparisons (intel vs arm, mac vs linux/windows):
   -  [porthole](https://github.com/flotilla-org/porthole) - computer use/screenshotting tool
   -  [cleat](https://github.com/flotilla-org/cleat) - recording terminal sessions and allowing remote access to inherit terminal gui privileges

Some work was done by hand:
   - Trapping machinery
   - Some tricky parts of demon control
   - Some metal shader work
   - Probably others I've forgotten

These parts just turned out to be easier to think about/specify in code at the time. Probably totalling less than 1500 lines.

The initial x86 port took about five days; ARM64 about three more - in May 2026.
Everything since: debugging, and maintenance against a moving upstream, takes maybe 0.5-1 days a month.

### Reading the code

For some projects or stages in development, code reading is no longer strictly required: prototyping, 'code as content'. 
Possibly, if you have good enough testing or formal verification in place this can be extended to more involved projects. 
For this particular project, I find it necessary to read the code - to notice what is going wrong - especially for things that don't yet have a verifiable signal. 

Common agent mistakes on this project: 
- Getting confused about line endings - the codebase is mixed CR/LF and LF
- Falsely attributing comments to the upstream author, or removing attribution
- Editing generated files rather than regenerating
- Some confusion with very long functions - but most of the time compiler error signals are enough to deal with that.

Deterministic checks for some of these were either added or are planned.

Of course, more 'one off' bugs/mistakes are found by reading the code too.

### Rippling the DAG

The port is maintained as a DAG of subject specific branches, somewhat like a traditional patch set.
They culminate in an integration branch. The branches are prefixed by a generation - e.g. mac8.
I have some Python tooling oriented around maintaining this DAG through two operations: 
 * Fixes from on top of the integration branch are distributed to the appropriate places in the DAG.
 * Upstream moves beneath the DAG. 

<details>
<summary>How a ripple actually runs</summary>

When an earlier branch changes, the change ripples through every branch after
it; the generated joins are recreated from their inputs, never committed
to. A manifest records the intended graph, and tooling checks Git
ancestry against it before and after each session. A generation move (usually an upstream refresh) is
the same operation: the whole DAG is rebuilt against a new
pinned upstream base (the previous generation is archived intact).

Fixes found at the integration tip are batched there and rippled deliberately, and a ripple
must end with an empty diff against the tested tip. 

Testing is then done on various machines by agents through the ipc interface.

Patch-set history is not currently ideal. A branch keeps its identity
across generations -  `mac7/mac/appkit-shell` and `mac8/mac/appkit-shell`
are the same idea, but with unrelated commits. `git range-diff` can compare two versions
of a series; jj change IDs survive rebases within a repository,
but not a re-derivation.

This work I have found doable in a factory style, as it is quite a repeatable pattern that is being followed.

</details>

Planned: 
 - separate the DAG tooling from this fork so it can be used to maintain
other long-lived forks 
 - abstract it enough from Git to try jj or other SCMs.

### Assessment

My finger in the air assessment is that this would have taken me around 2 months without agents. 
Totally doable - but would I have done it? I doubt it. Humble-braggingly I will concede this is mainly a tick in the
'agents amplify those who already know what they are doing' column.

On the debugger - it is good, and fun to use. I still think Java debuggers are slept on by many though, in terms of features/ease of use!
There are still a lot of gaps here vs every feature of gdb/lldb, but it is much nicer to use than those and the wrappers I've used recently.
The one feature I do miss from IntelliJ is dependent breakpoints - I may well add that (portably of course).
Remote debugging and separation of debugger and target architecture are clearly possible, but will need quite a bit of surgery - not something for this port!

What I might do differently if re-running this port:
  - Give the debugger an ipc surface compatible with other debuggers test suites (e.g. lldb [Dexter](https://github.com/llvm/llvm-project/tree/main/cross-project-tests/debuginfo-tests/dexter))
  - Possibly look into prop-test like code and 'debugging situation' generation - a [Bombadil](https://github.com/antithesishq/bombadil) ui driver will be interesting eventually. [Csmith](https://github.com/csmith-project/csmith)-style generation could cover the target programs themselves.
  - Generally - increase the ease with which agents can get feedback. Its probably worth doing this *on the original platform* first - I bootstrapped the debugger on mac os before doing any of this (or running it on windows/linux!)

### References

- Maria Markstedter, *Blue Fox: Arm Assembly Internals and Reverse Engineering*.
- The Arm Architecture Reference Manual for A-profile.
- Jonathan Levin, *\*OS Internals*.
- [Ryan Fleury’s](https://www.rfleury.com/) series on the debugger’s
  internals.
- The [XNU](https://github.com/apple-oss-distributions/xnu) and
  [LLDB](https://github.com/llvm/llvm-project/tree/main/lldb) sources,
  occasionally.
