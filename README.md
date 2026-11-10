# usage-band

A Claude Code mod for the **Claude desktop app** that keeps your remaining plan usage and reset countdowns in view, so you don't have to open the avatar menu → Usage.

```
5h ████████│█ 95% ⏲4h10m   7d ██│██····· 51% ⏲1d4h
```

- One bar per rate-limit window the API reports (`5h`, `7d`, and any others such as a per-model weekly window). A window that isn't reported for your plan is simply not drawn.
- Color by remaining: green > 50%, yellow 20–50%, red < 20%.
- `│` is a time cursor: how much of the window has elapsed. `⚡` appears when usage runs more than 10 points ahead of elapsed time.
- `⏲` is the countdown to reset.
- Shown above the prompt as slim bars in graphical clients (desktop app, VS Code, mobile) and mirrored in the status line. The terminal shows nothing.
- Also a **Usage** side pane where the client supports panes, and a one-line usage footer under each reply (the only spot some clients, such as the desktop app viewing a cloud session, draw — it may appear folded as a notification).
- `/usage-pane` opens the pane, or prints the usage line where panes aren't supported. `/usage-raw` prints the raw rate-limit windows.

Data refreshes at session start, after every turn, and whenever a window moves a whole point. It appears after the session's first response.

Bar design inspired by [sirmalloc/ccstatusline](https://github.com/sirmalloc/ccstatusline).

## Install

At the prompt of a terminal session:

```
/plugin install usage-band --marketplace hhoder/usage-band
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```bash
claude plugin install usage-band --marketplace hhoder/usage-band
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `hhoder/usage-band`, then Add plugin.

## License

MIT
