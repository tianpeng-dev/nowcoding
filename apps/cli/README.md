# NowCoding CLI

[English](README.md) | [简体中文](README_zh.md)

NowCoding shows what builders are coding with AI right now, then turns that live activity into profiles, README cards, badges, and social proof.

## NowCoding Cloud

Use hosted V2 when you want official profile, card, badge, streak, and Arena
leaderboard links without deploying a self-hosted server:

```sh
npm install -g nowcoding
nowcoding login
nowcoding daemon install
nowcoding daemon start
nowcoding status
```

The official hosted domain is `https://nowcoding.cc`. Cloud returns official
profile, card, badge, and Arena links from that domain after login.

`nowcoding login` opens GitHub OAuth and binds this CLI to your Cloud account
with a scoped NowCoding device token. The normal path should return directly to
the terminal after OAuth succeeds. Extra confirmation is reserved for unusual
sessions or changes to public-field consent.
Cloud official card/profile links include V2 engagement fields such as
estimated AI-assisted time saved, peak activity, milestone, top model, streak,
and the 7-day token sparkline. Arena leaderboards can rank by tokens, estimated
cost, active time, streak, or `time_saved`.

Self-hosted mode does not contact NowCoding Cloud or Arena unless you explicitly
run `nowcoding login` or `nowcoding arena connect`.

## Verify from GitHub source

```sh
git clone https://github.com/tianpeng-dev/nowcoding.git
cd nowcoding
corepack enable
pnpm install
pnpm --filter nowcoding build
node apps/cli/bin/nowcoding.js --help
```

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
