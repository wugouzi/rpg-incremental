# utils.js — 工具函数

## 职责
纯函数集合，不依赖任何其他模块，全局挂载到 `window.Utils`。

## 核心函数

### formatNum(n)
大数格式化显示：
- < 1000 → 原数
- >= 1K → "1.2K"
- >= 1M → "1.2M"
- >= 1B → "1.2B"
- >= 1T → "1.2T"

### formatBar(current, max, width=10)
生成 ASCII 进度条：`[####------]`
- current/max 决定 # 的数量
- width 决定总格数（默认10）

### rand(min, max)
返回 [min, max] 之间的随机整数

### randFloat(min, max)
返回 [min, max] 之间的随机浮点数

### chance(probability)
probability 为 0~1，返回 bool，表示是否触发

### clamp(value, min, max)
将 value 限制在 [min, max] 范围内

### deepClone(obj)
JSON 深拷贝对象（用于存档/读档）

## 全局挂载
```js
window.Utils = { formatNum, formatBar, rand, randFloat, chance, clamp, deepClone }
```
