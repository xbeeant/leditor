# before
```tsx
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';

import ExampleTheme from './ExampleTheme';
import ToolbarPlugin from './plugins/ToolbarPlugin';
import TreeViewPlugin from './plugins/TreeViewPlugin';

const placeholderText = 'Enter some rich text...';
const contentEditable = (
  <ContentEditable
    className="editor-input"
    aria-placeholder={placeholderText}
    placeholder={<div className="editor-placeholder">{placeholderText}</div>}
  />
);

const editorConfig = {
  namespace: 'React.js Demo',
  nodes: [],
  // Handling of errors during update
  onError(error: Error) {
    throw error;
  },
  // The editor theme
  theme: ExampleTheme,
};

export default function App() {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="editor-container">
        <ToolbarPlugin />
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={contentEditable}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <TreeViewPlugin />
        </div>
      </div>
    </LexicalComposer>
  );
}
```

# after
```tsx
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryExtension } from "@lexical/history";
import { RichTextExtension } from "@lexical/rich-text";
import { AutoFocusExtension } from "@lexical/extension";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";

import ExampleTheme from "./ExampleTheme";
import ToolbarPlugin from "./plugins/ToolbarPlugin";
import TreeViewPlugin from "./plugins/TreeViewPlugin";

const placeholderText = "Enter some rich text...";
const contentEditable = (
  <ContentEditable
    className="editor-input"
    aria-placeholder={placeholderText}
    placeholder={<div className="editor-placeholder">{placeholderText}</div>}
  />
);

const editorExtension = defineExtension({
  name: "[root]",
  namespace: "React.js Extension Demo",
  dependencies: [
    AutoFocusExtension,
    RichTextExtension,
    HistoryExtension,
    configExtension(ReactExtension, { contentEditable: null }),
  ],
  // The editor theme
  theme: ExampleTheme,
});

export default function App() {
  return (
    {/* We specify our own layout for the editor's children */}
    <LexicalExtensionComposer extension={editorExtension} contentEditable={null}>
      <div className="editor-container">
        <ToolbarPlugin />
        <div className="editor-inner">
          {contentEditable}
          <TreeViewPlugin />
        </div>
      </div>
    </LexicalExtensionComposer>
  );
}
```