# 开源项目参考与第一版选择

查阅日期：2026-10-15。以下为官方文档和仓库信息，不使用 Star 数量作为选型依据。

## relation-graph

- 仓库：<https://github.com/relation-graph/relation-graph>
- 官方介绍：<https://relation-graph.com/docs/introduction/>
- 开源范围与产品说明：<https://www.relation-graph.com/products/>

它与本项目目标最接近，提供关系图展示、布局和图元素定制，覆盖多个 UI 框架。值得参考其关系展示、布局选项与配置方式。官方说明开源组件使用 MIT，另有单独提供的服务或内容；具体使用时应按对应版本和交付内容核对。

本项目第一版保留 framework-independent TypeScript 组件，以小说人物、章节和关系变化的数据语义为重点，不复制它的界面或源码。

## Cytoscape.js：第一版实际使用

- 仓库：<https://github.com/cytoscape/cytoscape.js>
- 官方 API：<https://js.cytoscape.org/>
- 布局说明：<https://blog.js.cytoscape.org/2020/05/11/layouts/>

包含关系数据模型、Canvas 渲染、节点与边样式、图交互和内置布局。曲线可区分同一节点对之间的多条关系，适合一对人物同时存在亲属、合作等关系。

第一版采用其公开 API，在上层实现人物数据校验、章节筛选、外观配置、固定位置切换和 JSON 持久化，不修改依赖源码。安装版本记录在 `package-lock.json`。

## AntV G6

- 仓库：<https://github.com/antvis/G6>
- 扩展与布局：<https://g6.antv.antgroup.com/en/manual/graph/extensions>
- 示例：<https://g6.antv.antgroup.com/en/examples/>

图可视化框架，提供多种布局、交互、背景和动画扩展。适合作为后续复杂节点、分组折叠和动画编排的参考。第一版不同时接入多个渲染引擎，减少配置和维护面。

## Sigma.js

- 仓库：<https://github.com/jacomyal/sigma.js>
- 官方入门：<https://www.sigmajs.org/docs/>

面向大规模网络可视化，使用 Graphology 管理数据，适合未来性能扩展时评估。本项目目前优先处理关系语义、平行边、阅读筛选与可配置交互，没有为万级节点优化。

## 可长期发展的差异

通用图引擎已经解决基础绘制，项目应积累人物领域的数据协议、可靠关系呈现和嵌入体验。后续可增加关系历史、节点头像、分组折叠、按关系层级展开、框架适配包，以及布局计算 Worker。不要把示例运行成功等同于所有复杂图谱都清晰。
