import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import Quill, { Delta, type Range } from 'quill';
import type History from 'quill/modules/history';
import { composedEditorHtml, initialEditorHtml } from './mailCompose';
import { MailIcon } from './MailUi';
import 'quill/dist/quill.snow.css';

const FontStyle = Quill.import('attributors/style/font') as { whitelist: string[] };
FontStyle.whitelist = ['Arial', 'Georgia', 'Verdana', 'Tahoma', 'Courier New', 'Trebuchet MS'];
const SizeStyle = Quill.import('attributors/style/size') as { whitelist: string[] };
SizeStyle.whitelist = ['10px', '13px', '18px', '24px', '32px'];
Quill.register(FontStyle as any, true);
Quill.register(SizeStyle as any, true);
Quill.register(Quill.import('attributors/style/align') as any, true);

export interface MailEditorHandle {
  selectedText: () => string;
  insertText: (text: string) => void;
  insertLink: (text: string, href: string) => void;
  insertImage: (source: string, name: string) => void;
  focus: () => void;
}

export default function MailEditor({ initialHtml, initialText = '', onChange, disabled, controller, formatting = true, plain = false, onImagePaste }: {
  initialHtml: string; initialText?: string; onChange: (html: string, text: string) => void; disabled: boolean;
  controller?: RefObject<MailEditorHandle | null>; formatting?: boolean; plain?: boolean; onImagePaste?: (file: File) => void;
}) {
  const host = useRef<HTMLDivElement>(null), editor = useRef<Quill>(), selection = useRef<Range>({ index: 0, length: 0 });
  const changed = useRef(onChange), isPlain = useRef(plain), paste = useRef(onImagePaste); changed.current = onChange; isPlain.current = plain; paste.current = onImagePaste;
  const [formats, setFormats] = useState<Record<string, unknown>>({}), [history, setHistory] = useState({ undo: false, redo: false });
  const withSelection = (callback: (quill: Quill, range: Range) => void) => {
    const quill = editor.current; if (!quill || disabled) return;
    const index = Math.min(selection.current.index, Math.max(0, quill.getLength() - 1));
    const range = { index, length: Math.min(selection.current.length, quill.getLength() - 1 - index) };
    quill.focus(); quill.setSelection(range, 'silent'); callback(quill, range);
    selection.current = quill.getSelection() || range; setFormats(quill.getFormat(selection.current));
  };
  const format = (name: string, value: unknown) => withSelection(quill => { quill.format(name, value, 'user'); });
  useEffect(() => {
    const quill = new Quill(host.current!, { theme: 'default', placeholder: 'Write your message...',
      formats: ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'indent', 'list', 'blockquote', 'link', 'image'],
      modules: { toolbar: false, history: { delay: 500, userOnly: true } } });
    if (initialHtml) quill.clipboard.dangerouslyPasteHTML(initialEditorHtml(initialHtml)); else if (initialText) quill.setText(initialText);
    quill.clipboard.addMatcher('IMG', () => new Delta());
    const historyModule = quill.getModule('history') as History; historyModule.clear();
    quill.root.setAttribute('aria-label', 'Message body'); quill.root.setAttribute('role', 'textbox'); quill.root.setAttribute('aria-multiline', 'true');
    const update = () => {
      setFormats(quill.getFormat(selection.current));
      setHistory({ undo: historyModule.stack.undo.length > 0, redo: historyModule.stack.redo.length > 0 });
    };
    const listener = () => {
      const text = quill.getContents().ops.map(op => typeof op.insert === 'string' ? op.insert : op.insert?.image ? `[Image: ${op.attributes?.alt || 'image'}]` : '').join('').replace(/\n$/, '');
      changed.current(isPlain.current ? '' : composedEditorHtml(quill.getSemanticHTML()), text); update();
    };
    const selected = (range: Range | null) => { if (range) selection.current = range; update(); };
    const onPaste = (event: ClipboardEvent) => {
      if (isPlain.current && quill.isEnabled()) {
        event.preventDefault(); event.stopImmediatePropagation();
        const range = quill.getSelection() || selection.current;
        quill.deleteText(range.index, range.length, 'user'); quill.insertText(range.index, event.clipboardData?.getData('text/plain') || '', 'user');
        return;
      }
      const image = [...(event.clipboardData?.files || [])].find(file => file.type.startsWith('image/'));
      if (image && paste.current && quill.isEnabled()) { event.preventDefault(); event.stopImmediatePropagation(); paste.current(image); }
    };
    quill.root.addEventListener('paste', onPaste, true);
    quill.on('text-change', listener); quill.on('selection-change', selected); editor.current = quill;
    update();
    return () => {
      quill.off('text-change', listener); quill.off('selection-change', selected); quill.root.removeEventListener('paste', onPaste, true);
      host.current?.replaceChildren(); editor.current = undefined;
    };
  }, []);
  useEffect(() => { editor.current?.enable(!disabled); }, [disabled]);
  const firstPlain = useRef(true);
  useEffect(() => {
    if (firstPlain.current) { firstPlain.current = false; return; }
    const quill = editor.current; if (!quill) return;
    if (plain) {
      quill.setText(quill.getText(), 'user'); (quill.getModule('history') as History).clear();
      setFormats({}); setHistory({ undo: false, redo: false });
    }
    else changed.current(composedEditorHtml(quill.getSemanticHTML()), quill.getText().replace(/\n$/, ''));
  }, [plain]);
  // Refresh the handle on render so asynchronous image work cannot bypass a send lock.
  if (controller) controller.current = {
    selectedText: () => editor.current?.getText(selection.current.index, selection.current.length) || '',
    focus: () => withSelection(() => {}),
    insertText: text => withSelection((quill, range) => { quill.deleteText(range.index, range.length, 'user'); quill.insertText(range.index, text, 'user'); quill.setSelection(range.index + text.length, 0, 'silent'); }),
    insertLink: (text, href) => withSelection((quill, range) => { quill.deleteText(range.index, range.length, 'user'); quill.insertText(range.index, text, { link: href }, 'user'); quill.setSelection(range.index + text.length, 0, 'silent'); }),
    insertImage: (source, name) => withSelection((quill, range) => { quill.deleteText(range.index, range.length, 'user'); quill.insertEmbed(range.index, 'image', source, 'user'); quill.formatText(range.index, 1, { alt: name }, 'user'); quill.setSelection(range.index + 1, 0, 'silent'); }),
  };
  const tool = (name: string, icon: string, action: () => void, active?: boolean, unavailable = false) => <button type="button" title={name} aria-label={name} aria-pressed={active} disabled={disabled || plain || unavailable} onPointerDown={event => event.preventDefault()} onClick={action}><MailIcon name={icon}/></button>;
  return <div className="mail-editor">
    <div ref={host}/>
    <div className="mail-format-toolbar" role="toolbar" aria-label="Message formatting" hidden={!formatting || plain}>
      <div className="mail-format-group">
        {tool('Undo', 'arrow-go-back-line', () => withSelection(quill => (quill.getModule('history') as History).undo()), undefined, !history.undo)}
        {tool('Redo', 'arrow-go-forward-line', () => withSelection(quill => (quill.getModule('history') as History).redo()), undefined, !history.redo)}
      </div>
      <div className="mail-format-group">
        <select aria-label="Font family" title="Font family" value={String(formats.font || 'Arial')} disabled={disabled} onChange={event => format('font', event.currentTarget.value)}>
          {FontStyle.whitelist.map(font => <option key={font} value={font}>{font === 'Arial' ? 'Sans Serif' : font === 'Georgia' ? 'Serif' : font}</option>)}
        </select>
        <select className="mail-font-size" aria-label="Font size" title="Font size" value={String(formats.size || '13px')} disabled={disabled} onChange={event => format('size', event.currentTarget.value)}>
          {['10px', '13px', '18px', '24px', '32px'].map(size => <option key={size} value={size}>{size.replace('px', '')}</option>)}
        </select>
      </div>
      <div className="mail-format-group">
        {tool('Bold', 'bold', () => format('bold', !formats.bold), Boolean(formats.bold))}
        {tool('Italic', 'italic', () => format('italic', !formats.italic), Boolean(formats.italic))}
        {tool('Underline', 'underline', () => format('underline', !formats.underline), Boolean(formats.underline))}
        <label className="mail-format-color" title="Text color"><MailIcon name="font-color"/><input type="color" aria-label="Text color" value={typeof formats.color === 'string' && formats.color.startsWith('#') ? formats.color : '#202124'} disabled={disabled} onInput={event => format('color', event.currentTarget.value)}/></label>
        <label className="mail-format-color" title="Highlight color"><MailIcon name="mark-pen-line"/><input type="color" aria-label="Highlight color" value={typeof formats.background === 'string' && formats.background.startsWith('#') ? formats.background : '#ffffff'} disabled={disabled} onInput={event => format('background', event.currentTarget.value)}/></label>
      </div>
      <div className="mail-format-group">
        <label className="mail-format-alignment" title="Text alignment"><MailIcon name={formats.align === 'center' ? 'align-center' : formats.align === 'right' ? 'align-right' : formats.align === 'justify' ? 'align-justify' : 'align-left'}/>
          <select aria-label="Text alignment" disabled={disabled} value={String(formats.align || '')} onChange={event => format('align', event.currentTarget.value || false)}><option value="">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justified</option></select>
        </label>
        {tool('Numbered list', 'list-ordered', () => format('list', formats.list === 'ordered' ? false : 'ordered'), formats.list === 'ordered')}
        {tool('Bullet list', 'list-unordered', () => format('list', formats.list === 'bullet' ? false : 'bullet'), formats.list === 'bullet')}
        {tool('Decrease indent', 'indent-decrease', () => format('indent', '-1'))}
        {tool('Increase indent', 'indent-increase', () => format('indent', '+1'))}
        {tool('Blockquote', 'double-quotes-l', () => format('blockquote', !formats.blockquote), Boolean(formats.blockquote))}
        {tool('Strikethrough', 'strikethrough', () => format('strike', !formats.strike), Boolean(formats.strike))}
        {tool('Clear formatting', 'format-clear', () => withSelection((quill, range) => { quill.removeFormat(range.index, range.length || 1, 'user'); }))}
      </div>
    </div>
  </div>;
}
