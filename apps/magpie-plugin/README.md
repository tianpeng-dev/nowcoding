# NowCoding for Magpie

在 Magpie 侧栏选择允许读取的工具，即可离线查看本机七天的 Token、模型分布和估算费用。连接 Cloud 或自托管设备后，可以同步选中的用量、预览公开卡片、复制 GitHub README 代码，以及在浏览器管理设备和排行榜。

从统一仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm --filter magpie-nowcoding build
magpie plugin add ./apps/magpie-plugin
```

Magpie 0.1.4079 或更高版本。插件使用随包发布的本机服务，默认地址为 `127.0.0.1:37481`，端口可在 Magpie 插件选项中设置。设备凭据及同步记录与 NowCoding CLI 共用，插件的工具选择保存在 `~/.nowcoding/magpie.json`。公开卡片与排行榜由服务器生成。
