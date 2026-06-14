# NowCoding CLI

[English](README.md) | [简体中文](README_zh.md)

NowCoding CLI 用于在本地收集、整理并展示开发活动数据。它面向希望把当下编码状态转化为可分享资料的用户，而不是把产品定位成单纯的统计工具。

## 安装

```bash
pnpm install
```

如果要长期运行 daemon，请先安装稳定的全局命令：

```bash
npm install -g nowcoding
```

## 常用命令

```bash
pnpm --filter nowcoding build
node apps/cli/bin/nowcoding.js --help
```

自托管模式常用命令：

```bash
npx nowcoding init --endpoint "$NOWCODING_RC_BASE_URL"
npx nowcoding sync
npx nowcoding heartbeat
```

CLI 会把 endpoint 和 token 写入本地用户配置。不要提交本地 secret、配置或数据。

## NowCoding Cloud

官方 Cloud 适合不想部署自托管服务、但希望获得官方 profile、card、badge、streak 和 Arena 链接的用户：

```bash
nowcoding login
nowcoding daemon install
nowcoding daemon start
nowcoding status
```

官方托管域名是 `https://nowcoding.cc`。`nowcoding login` 会打开 GitHub OAuth，并用受限的 NowCoding device token 绑定本机 CLI 与 Cloud 账号。

自托管模式不会连接 NowCoding Cloud 或 Arena，除非你明确运行 `nowcoding login` 或 `nowcoding arena connect`。

## Daemon

长期采集前请使用稳定的全局或本地 binary，不要使用临时的 `npx` 或 `pnpm dlx` 路径。

```bash
nowcoding daemon status
nowcoding daemon install
nowcoding daemon start
nowcoding daemon stop
nowcoding daemon restart
nowcoding daemon uninstall
nowcoding daemon foreground
```

`nowcoding daemon install` 会在 macOS 写入用户级 launchd 服务，在 Linux 写入 systemd user service。

## 网页展示

CLI 生成的数据可以被 Web 页面、卡片和 Badge 消费，用于展示 “Now” 维度的开发动态。
