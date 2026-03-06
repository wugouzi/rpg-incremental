# IDLE HERO

一款浏览器端仿终端风格的增量 RPG 游戏。纯前端实现，无框架、无构建工具，直接打开 `index.html` 即可运行。

## 游戏运行

直接用浏览器打开项目根目录下的 `index.html`：

```bash
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

或者在浏览器地址栏输入文件路径，例如：

```
file:///Users/你的用户名/path/to/incremental/index.html
```

无需安装任何依赖，无需启动服务器。

## 运行测试

测试使用 Node.js + jsdom，需要先安装依赖：

```bash
npm install
npm test
```

当前共 **297 项**自动化测试，覆盖战斗、装备、技能、法师专精等核心逻辑。
