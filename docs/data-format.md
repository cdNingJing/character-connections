# 数据格式 v1

数据文件是 UTF-8 JSON。机器可读协议在 `schema.json`；运行时使用 `parseGraphDocument` 进一步检查唯一 id、引用、章节范围和图片大小。

```json
{
  "schemaVersion": 1,
  "title": "西游记关系示例",
  "maxChapter": 1,
  "coreId": "wukong",
  "characters": [
    {
      "id": "wukong",
      "name": "孙悟空",
      "group": "取经团队",
      "placement": {
        "level": 0,
        "order": 0
      }
    },
    {
      "id": "tangseng",
      "name": "唐僧",
      "group": "取经团队",
      "placement": {
        "level": 0,
        "order": -1
      }
    }
  ],
  "relations": [
    {
      "id": "master",
      "source": "tangseng",
      "target": "wukong",
      "label": "师徒",
      "type": "mentorship",
      "directed": true
    }
  ],
  "appearance": {
    "background": "#142c3e",
    "edgeShape": "bezier",
    "transition": "smooth"
  }
}
```

## 必填字段

- `schemaVersion`：固定为 `1`。
- `title`：图谱标题。
- `characters`：1—500 个人物，必填 `id`、`name`、`group`。
- `relations`：0—3000 条关系，必填 `id`、`source`、`target`、`label`、`type`。

所有人物和关系共用 id 命名空间，不能重复；source、target 必须指向现有的人物 id。允许同一对人物多条关系、双向关系和自环；必须为每条关系提供独立 id。

## 章节和坐标

`maxChapter` 默认为 1，范围 1—100000。人物 `chapter` 默认为 1。关系 `fromChapter` 默认为 1、`toChapter` 默认为 maxChapter，起止两端都包含在内；关系不能早于任一人物出场。没有章节概念时将 maxChapter 设为 1。

人物 `position` 可设置 `{ "x": 120, "y": 260 }`；必须是绝对值不超过 100000 的有限数。导出会记录所有人物的当前位置。切换人物、外观和章节不重新布局；用户执行“重新排列人物”才覆盖坐标。

`description` 为可选纯文本，人物与关系都可使用，最长 2000 字符；不要填入 HTML。

## 关系类型

内置颜色类型：`friendship`、`family`、`mentorship`、`conflict`、`alliance`、`investigation`。其他 type 也能使用，采用默认连线颜色。`label` 是实际显示的关系名称，支持中文。

`directed: true` 表示有方向，由 source 指向 target。全局 arrows 设置决定是否显示箭头。

## appearance

所有外观字段可选，缺省时使用组件默认值：

- `background`、`edgeColor`：六位十六进制颜色。
- `pattern`：`dots`、`grid`、`none`。
- `backgroundImage`：空字符串，或 PNG、JPEG、WebP 的 base64 data URL；上传原文件最大 2 MB。
- `edgeShape`：`bezier`、`straight`、`round-taxi`。
- `edgeLine`：`solid`、`dashed`、`dotted`。
- `edgeWidth`：1—5；`unifiedEdgeColor`：是否统一颜色。
- `labels`：`related`、`all`、`none`。
- `arrows`：布尔值。
- `transition`：`none`、`smooth`、`fade`；`duration`：0—2000 毫秒。

导出的 JSON 包含完整外观、人物坐标与完整数据，不限于当前显示章节。导入会替换当前数据；未知字段不会进入组件数据模型。

## 核心人物与位置约束

可选的 coreId 指向中心人物 id。人物的 placement 包含整数 level（-20 到 20）与 order（-100 到 100），分别控制上下层和左右顺序。position 是可选的固定坐标，优先于规则位置。完整规则见 [规则布局](layout-rules.md)。

## 人物资料与内容设置

人物支持 `aliases: string[]`、`tags: string[]` 和 `attributes: Record<string, string>`。自定义资料以键值显示在详情区，导入导出会保留。文字作为纯文本显示。

`appearance.nodeShape` 支持 ellipse、round-rectangle、diamond、hexagon；`nodeSize` 为 32–96；`nodeContent` 为 name、group、description。`showAliases`、`showAttributes`、`showDescription` 控制详情内容。

## 连线与文字设置

`edgeShape` 支持 `bezier`（自动绕行）、`soft-bezier`（平缓曲线）、`arc`（弧形曲线）、`round-taxi`（自动圆角折线）、`horizontal-taxi`、`vertical-taxi`、`round-segments` 和 `straight`。`edgeCurvature` 为 0.4–2 倍；`edgeCornerRadius` 为 0–80。圆角与弯曲参数只作用于对应路径。折线按方向分流，不保证绕开所有节点。

`labelFontSize` 为 10–20，`labelMaxWidth` 为 60–240，`labelOffset` 为 -30–30，单位为画布坐标 px。选中的关系在缩小时保持最低可读字号。`labelBackground` 为 `pill` / `plain` / `none`；`labelDirection` 为 `horizontal` / `along-edge`；`labelPosition` 为 `auto` / `middle` / `source` / `target`。`labels: focused` 只显示选中的单条关系。

`avoidLabelOverlap` 默认开启，以确定性候选位置尽量避开人物和其他可见文字；密集图无法保证没有重叠，沿线旋转后的碰撞判断采用近似边界。自动避让可能使文字稍微偏离指定位置；精确放置时可关闭。所有设置均包含在导出 JSON 的 `appearance` 中，旧 JSON 自动补齐默认设置。
