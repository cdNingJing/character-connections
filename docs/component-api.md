# 可复用组件 API

## 安装和样式

先下载示例站中的 `.tgz` 包，或在源码运行 `npm run build`，再在自己的项目安装该文件。当前未发布 npm registry。`cytoscape` 会作为运行依赖安装，Vue、React 不属于依赖。

```bash
npm install ./character-connections-0.8.0.tgz
```

始终导入 `character-connections/style.css`。样式仅作用于图谱容器与自定义元素，不包含示例站、工作台或全局页面样式。给容器设置明确高度，组件通过 ResizeObserver 响应尺寸变化。

## createCharacterGraph(host, props)

`host` 是浏览器中的 HTMLElement。`props.data` 是 GraphDocument，必填；`layout` 是布局名称；`appearance` 是可选的局部 GraphOptions；`chapter` 是阅读进度；`onSelectionChange` 接收 `{kind: 'character' | 'relation', id}` 或 `null`。

布局支持 semantic、groups、mindmap、tree、horizontal-tree、radial、circle、grid，以及高级 force。默认保留数据中的坐标；明确传入 layout 时执行该布局。示例站展示 8 种可解释的常用布局。

返回 CharacterGraphComponent：

- `update(props)` 更新局部参数，appearance 按字段合并。数据和参数在修改图谱前校验。data 改变时沿用当前布局；不传 layout 时保留数据坐标。
- `update({data, preservePositions: true})` 用新数据增量展开，保留已有节点与位置；如同时指定 layout，则以明确指定的布局为准。
- `fit()` 显示完整图谱。
- `exportData()` 导出当前人物位置、数据和外观设置。
- `destroy()` 释放画布、事件、计时器及 ResizeObserver；可重复调用。销毁后不能再 update。
- `graph` 暴露原 CharacterGraph；支持 setChapter、selectCharacterById、selectRelationById、clearSelection、zoomBy 等高级操作。

React 在 useEffect 中创建，在清理函数中 destroy，可兼容 StrictMode 的重复挂载。Vue 3 在 onMounted 创建，在 onBeforeUnmount 销毁。示例站提供完整可复制代码；组件初始化不应放在服务端渲染过程中。

## 标准 HTML 自定义元素

```typescript
import { registerCharacterConnections } from 'character-connections/element';
import { parseGraphDocument } from 'character-connections';
import 'character-connections/style.css';

registerCharacterConnections();
const graph = document.createElement('character-connections');
graph.style.height = '560px';
graph.layout = 'mindmap';
graph.options = { edgeShape: 'horizontal-taxi' };
graph.data = parseGraphDocument(rawData);
graph.addEventListener('selection-change', (event) => console.log((event as CustomEvent).detail));
document.querySelector('#app')!.append(graph);
```

`data`、`options` 使用 JavaScript 属性赋值，不要把对象写成 HTML 字符串。`layout` 也支持 `<character-connections layout="mindmap">`。移除元素后自动释放图谱，重新加入时重新挂载；同步移动 DOM 不重复创建。注册函数可重复调用同一标签名。一个模块中的元素类只能注册为一个标签名。

`fit()`、`exportData()` 可直接调用。无数据时不创建图谱。错误数据赋值会抛出错误并保留当前数据；无效 layout attribute 派发 `graph-error` 事件。自定义元素使用轻量 DOM，导入公共样式后即可渲染。

## 构建与发布边界

`dist/lib` 包含 ESM、外部 Cytoscape 依赖引用、独立 CSS 和 `.d.ts` 类型。包中不包含演示站业务代码、用户本地存储、临时文件或 node_modules。`npm pack` 会先构建库；`npm run build` 生成完整示例站及可下载安装包。没有执行 npm publish。

## 本地验证

`npm test` 验证布局、数据和代码生成。构建后运行 `npm run test:types` 验证对外类型声明。`npm run test:consumer` 在 4182 端口打开独立调用测试页，检查参数合并、错误更新回滚、位置保留、事件、销毁及自定义元素重新挂载。

## A4 人物简介组件

`createCharacterNotebook(host, { data, characterId, onSelectionChange })` 创建简历式人物简介。`characterId` 指定人物，默认使用数据中的 coreId 或第一个人物。左栏显示分组、属性、别名与标签，右栏显示简介、主要经历和相关人物。关系按原始方向显示，点击相关人物切换简介并派发选择回调。

每页固定为 A4 比例（794 × 1123 CSS px），按容器宽度等比缩放。首张放 4 条关系，续页每张 7 条；页面整体正常滚动，纸张内部不拖动、不滚动。当前排版针对示例中的短简介与短属性设计；接入很长的自定义文本时需要自行控制内容长度。

支持 `update({ data, characterId })`、`setSelection(selection)`、`fit()`、`exportData()`、`destroy()`。设置人物选择后切换简介，设置关系选择时保留当前人物。layout / appearance 参数保留兼容，空间布局和连线样式仅用于关系图组件。

从 `character-connections/element` 导入 `registerCharacterNotebook()` 后可使用 `<character-notebook character-id="wukong">`。data 用 JS 属性赋值，characterId 属性与 character-id attribute 均可切换人物。组件派发 selection-change 事件，移除后自动清理。导入公共 style.css，容器只需有宽度，无需固定高度。

示例站左侧切换“A4 人物简介”和“可视化关系图”，纸张视图提供人物列表，关系图提供布局列表。调用代码随视图及人物同步更新，支持 TypeScript、HTML 自定义元素、React 和 Vue 3。

打印时宿主页面可设置 `@page { size: A4; margin: 0; }`。示例站“打印人物简介”只打印当前人物的纸张内容。
