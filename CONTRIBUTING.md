# 贡献说明

使用 Node.js 22.18+（推荐 24） 和 TypeScript。函数名称完整表达动作，处理全部数据的方法包含 `All`；源文件使用 kebab-case。使用 Prettier，2 空格，100 字符行宽。

```bash
npm ci
npm run dev
npm test
npm run build
npm run format
```

修改数据格式时同步更新类型、运行时校验、schema.json、文档和边界测试。修改布局或选择行为时确认：切换人物不移动其他人物、章节回退不泄露节点与关系、平行关系可以区分、手机没有横向溢出。

添加依赖前检查其许可和维护情况，更新 package-lock.json 和必要的第三方声明。不要提交 node_modules、dist、密钥或真实小说全文。演示内容应为原创、公共领域作品，或具备明确授权；根据古典作品归纳的关系请列出来源并说明简化方式。

提交信息遵循 Conventional Commits，例如 `feat: 增加关系类型筛选`。
