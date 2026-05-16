# nowcoding

CLI for syncing local AI coding activity to a NowCoding profile.

## NowCoding Cloud

Use hosted V2 when you want official profile, card, badge, streak, and Arena
leaderboard links without deploying a self-hosted server:

```sh
npm install -g nowcoding
nowcoding login
nowcoding daemon install
```

The official hosted domain is `https://nowcoding.cc`. Cloud returns official
profile, card, badge, and Arena links from that domain after login.

`nowcoding login` opens GitHub OAuth and asks for Cloud upload consent. The
prompt includes "Join NowCoding Arena", checked by default; before you confirm
it shows the public fields used for the leaderboard and you can uncheck it.
Cloud official card/profile links include V2 engagement fields such as
estimated AI-assisted time saved, peak activity, milestone, top model, streak,
and the 7-day token sparkline. Arena leaderboards can rank by tokens, estimated
cost, active time, streak, or `time_saved`.

Self-hosted mode does not contact NowCoding Cloud or Arena unless you explicitly
run `nowcoding login` or `nowcoding arena connect`.

## Self-hosted commands

```sh
npx nowcoding init --endpoint "$NOWCODING_RC_BASE_URL"
npx nowcoding sync
npx nowcoding heartbeat
```

The CLI stores the endpoint and token in local user config. Do not commit local secrets, config, or data.

Install the package globally before installing a long-running daemon:

```sh
npm install -g nowcoding
nowcoding daemon status
nowcoding daemon install
nowcoding daemon start
nowcoding daemon stop
nowcoding daemon restart
nowcoding daemon uninstall
nowcoding daemon foreground
```

`nowcoding daemon install` writes a user-level launchd service on macOS or a
systemd user service on Linux. It refuses transient `npx`/`pnpm dlx` paths; use
a stable global or local binary for long-running collection.
