# Lexical Editor 功能实现清单

对比参考项目 `/Users/amybee/Codes/ca/lexical/packages/lib`，以下为当前项目尚未实现的功能点：

## 高优先级

- [x] **1. AutoLinkPlugin** - 自动链接/邮箱检测，输入 URL 或邮箱地址时自动转换为可点击链接
- [x] **2. MermaidNode + MermaidPlugin** - Mermaid 图表节点，支持在编辑器内渲染 Mermaid 语法图表
- [x] **8. FloatingToolbar** - 选中文本时显示浮动工具栏，提供快捷格式化操作

## 中优先级

- [x] **3. CodeDrawingNode + CodeDrawingPlugin** - 代码转图表节点，支持 mermaid/plantuml 渲染（graphviz/flowchart 需额外依赖）
- [ ] **3a. CodeDrawing 扩展** - graphviz / flowchart 渲染支持（需安装 viz.js / flowchart.js 依赖）
- [ ] **4. ExcalidrawNode + ExcalidrawPlugin** - Excalidraw 白板绘制节点
- [ ] **5. DrawioNode + DrawioPlugin** - Draw.io 图表节点
- [ ] **6. MindNode + MindPlugin** - 思维导图节点
- [x] **7. CalloutNode** - 高亮提示块（warning/info/tip/success 等类型）
- [x] **9. UniversalBlockEscapePlugin** - 在块级元素（表格单元格、代码块等）末尾按回车时跳出到新段落
- [x] **12. PasteMediaPlugin** - 粘贴图片/视频/音频文件时自动上传
- [x] **13. CodePastePlugin** - 代码块内粘贴时强制为纯文本
- [x] **14. TurnIntoToolbarButton** - 工具栏块类型转换按钮（段落↔标题↔列表↔代码块↔引用）

## 低优先级

- [x] **10. TableScrollShadowPlugin** - 宽表格水平滚动时显示左右阴影指示
- [x] **11. ExcelTablePastePlugin** - 从 Excel 粘贴表格时保留背景色等格式
- [ ] **15. DiffEditor** - 差异对比编辑器，并排显示两个版本的差异
- [ ] **16. DOCX导出功能** - 将编辑器内容导出为 Word 文档
