import { cloneElement, isValidElement, toChildArray, type ComponentChildren, type VNode } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { A4_GAP, A4_HEIGHT, A4_WIDTH, paginateA4, type BusinessA4Layout, type A4MeasuredSection } from './a4Pagination';
import './BusinessEnglishA4Document.css';

interface Section {
  id: string;
  label: string;
  stage: number;
  content: ComponentChildren;
  units: ComponentChildren[];
  notes: ComponentChildren;
  tools: ComponentChildren[];
}

const hasClass = (node: ComponentChildren, name: string): node is VNode<any> =>
  isValidElement(node) && String((node.props as any).className || '').split(' ').includes(name);

const children = (node: VNode<any>) => toChildArray(node.props.children);
const groupLabels = [
  ['Warm-up', 'Key Expressions'],
  ['Comprehension', 'Word Bank', 'Sound Practice', 'Comprehension Activity'],
  ['Practice'], ['Practice'], ['Simulation'], ['Discussion'], ['Feedback'],
];

function separateEditingTools(node: ComponentChildren, tools: ComponentChildren[]): ComponentChildren {
  if (!isValidElement(node)) return node;
  const element = node as VNode<any>;
  if (['beve-add-btn', 'beve-add-activity-wrap', 'beve-block-add-btn'].some(name => hasClass(element, name)) || element.props.hidden === true) {
    tools.push(element);
    return null;
  }
  if (element.props.children === undefined) return element;
  return cloneElement(element, { children: children(element).map(child => separateEditingTools(child, tools)) });
}

function hasContent(node: ComponentChildren): boolean {
  if (!isValidElement(node)) return toChildArray(node).some(child => typeof child === 'string' ? Boolean(child.trim()) : typeof child === 'number');
  const element = node as VNode<any>;
  if (element.props.dangerouslySetInnerHTML || element.props.value || element.type === 'img') return true;
  return children(element).some(hasContent);
}

// Preserve the existing renderers and their editing callbacks. Only complete
// repeated cards/activities may become separate flow units; questions stay intact.
function splitFlow(node: ComponentChildren): ComponentChildren[] {
  if (!isValidElement(node)) return [node];
  const element = node as VNode<any>;
  const items = children(element);
  const repeat = ['beve-pattern-drills', 'beve-patterns-grid', 'beve-discussion-categories', 'beve-activity-blocks-area']
    .some(name => hasClass(element, name));
  if (repeat) {
    const content = items.filter(item => !hasClass(item, 'beve-add-btn') && !hasClass(item, 'beve-add-activity-wrap'));
    const controls = items.filter(item => !content.includes(item));
    if (content.length > 1) return content.map((item, index) => cloneElement(element, {
      children: [item, ...(index === content.length - 1 ? controls : [])],
    }));
  }
  for (let index = 0; index < items.length; index++) {
    const parts = splitFlow(items[index]);
    if (parts.length > 1) return parts.map((part, partIndex) => cloneElement(element, {
      children: [
        ...(partIndex === 0 ? items.slice(0, index) : []), part,
        ...(partIndex === parts.length - 1 ? items.slice(index + 1) : []),
      ],
    }));
  }
  return [node];
}

export function businessA4Sections(pages: VNode<any>[]): Section[] {
  const result: Section[] = [];
  let practice = 0;
  pages.forEach((page, pageIndex) => {
    const container = children(page).find(node => hasClass(node, 'beve-page-sections') || hasClass(node, 'beve-columns')) as VNode<any> | undefined;
    if (!container) return;
    const rows = hasClass(container, 'beve-columns') ? [container] : children(container);
    rows.forEach((row, rowIndex) => {
      if (!isValidElement(row)) return;
      const columns = children(row as VNode<any>);
      const student = columns.find(node => hasClass(node, 'beve-col-student')) as VNode<any> | undefined;
      const tutor = columns.find(node => hasClass(node, 'beve-col-tutor')) as VNode<any> | undefined;
      if (!student) return;
      const isPractice = (pageIndex === 2 || pageIndex === 3) && !hasClass(row, 'beve-page-section-full');
      const label = isPractice ? `Practice ${++practice}` : (groupLabels[pageIndex]?.[rowIndex] || 'Practice Reference');
      const id = isPractice ? `practice-${practice}` : `section-${pageIndex}-${rowIndex}`;
      const tools: ComponentChildren[] = [];
      const content = separateEditingTools(<>{student.props.children}</>, tools);
      if (!hasContent(content)) {
        result.at(-1)?.tools.push(...tools);
        return;
      }
      let units = splitFlow(content);
      if (pageIndex === 6) {
        const items = toChildArray(isValidElement(content) ? content.props.children : content);
        const template = items.findIndex(item => hasClass(item, 'beve-feedback-template') || (isValidElement(item) && toChildArray((item.props as any).children).some(child => hasClass(child, 'beve-feedback-template'))));
        if (template > 0) {
          const start = hasClass(items[template - 1], 'beve-sub-heading') ? template - 1 : template;
          units = [<>{items.slice(0, start)}</>, <>{items.slice(start)}</>];
        }
      }
      result.push({
        id, label, stage: pageIndex === 3 ? 2 : pageIndex,
        content, units, notes: tutor?.props.children, tools,
      });
    });
  });
  return result;
}

interface Props {
  sections: Section[];
  renderHeader: (page: number) => VNode;
  renderFooter: () => VNode;
  layout?: BusinessA4Layout;
  onLayoutChange?: (layout: BusinessA4Layout) => void;
}

export default function BusinessEnglishA4Document({ sections, renderHeader, renderFooter, layout = {}, onLayoutChange }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<{ sections: A4MeasuredSection[]; capacity: number }>({ sections: [], capacity: 0 });
  const [active, setActive] = useState(0);
  const [width, setWidth] = useState(1200);
  const [zoom, setZoom] = useState('fit');

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        if (window.matchMedia('print').matches) return;
        // Reflow after the edit finishes so moving an activity cannot steal the caret.
        if (document.activeElement?.closest('.beve-a4-paper [contenteditable="true"]')) return;
        const header = root.querySelector('.beve-page-header')?.getBoundingClientRect().height || 0;
        const footer = root.querySelector('.beve-page-footer')?.getBoundingClientRect().height || 0;
        const measured = sections.map(section => ({
          id: section.id, label: section.label, stage: section.stage,
          height: root.querySelector(`[data-measure="${section.id}"]`)?.getBoundingClientRect().height || 0,
          units: section.units.map((_, index) => root.querySelector(`[data-measure="${section.id}-${index}"]`)?.getBoundingClientRect().height || 0),
        }));
        if (!header || !footer) return;
        const next = { sections: measured, capacity: A4_HEIGHT - header - footer - 64 };
        setMetrics(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      });
    };
    const observer = new ResizeObserver(measure);
    root.querySelectorAll('[data-measure], .beve-page-header, .beve-page-footer').forEach(node => observer.observe(node));
    document.fonts.ready.then(measure);
    document.addEventListener('focusout', measure);
    measure();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('focusout', measure); };
  }, [sections]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(previous => previous === canvas.clientWidth ? previous : canvas.clientWidth));
    });
    observer.observe(canvas);
    const onScroll = () => {
      const pages = [...canvas.querySelectorAll<HTMLElement>('.beve-a4-row')];
      const top = canvas.getBoundingClientRect().top + 100;
      let current = 0;
      pages.forEach((page, index) => { if (page.getBoundingClientRect().top <= top) current = index; });
      setActive(current);
    };
    canvas.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('scroll', onScroll); };
  }, []);

  const pages = paginateA4(metrics.sections, metrics.capacity, layout);
  const hasOverflow = pages.some(page => page.parts.some(part => part.overflow));
  const sideBySide = width >= 1110;
  const scale = zoom === 'fit' ? Math.min(1, Math.max(0.2, (width - 48 - (sideBySide ? 306 : 0)) / A4_WIDTH)) : Number(zoom);
  const scrollTo = (index: number) => {
    setActive(index);
    canvasRef.current?.querySelector(`#beve-a4-page-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggle = (field: keyof BusinessA4Layout, id: string) => {
    const values = layout[field] || [];
    onLayoutChange?.({ ...layout, [field]: values.includes(id) ? values.filter(value => value !== id) : [...values, id] });
  };

  return (
    <div className="beve-a4-document">
      <nav className="beve-sidebar beve-a4-sidebar" aria-label="Lesson pages">
        <div className="beve-sidebar-header">A4 Pages</div>
        <div className="beve-sidebar-pages">
          {pages.map((page, index) => {
            const labels = [...new Set(page.parts.map(part => sections.find(section => section.id === part.sectionId)?.label))];
            return <button key={index} className={`beve-sidebar-page${active === index ? ' active' : ''}`} onClick={() => scrollTo(index)}>
              <span className="beve-page-num">{index + 1}</span><span className="beve-page-label">{labels.join(' + ')}</span>
            </button>;
          })}
        </div>
        <div className="beve-a4-view-controls">
          <label><i className="ri-zoom-in-line" aria-hidden="true" /><select aria-label="Page zoom" value={zoom} onChange={event => setZoom(event.currentTarget.value)}>
            <option value="fit">Fit page width</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option>
          </select></label>
          <button className="beve-toolbar-btn" title={hasOverflow ? 'Resolve page overflow before printing' : 'Print A4 student pages'} aria-label="Print A4 student pages" disabled={hasOverflow || !pages.length} onClick={() => window.print()}><i className="ri-printer-line" />Print</button>
        </div>
      </nav>
      <div className="beve-canvas beve-a4-canvas" ref={canvasRef} aria-busy={!pages.length}>
        <div className="beve-a4-measure" ref={measureRef} aria-hidden="true" inert>
          {renderHeader(1)}{renderFooter()}
          {sections.map(section => <div key={section.id}>
            <div className="beve-col-student beve-a4-block" data-measure={section.id} data-a4-stage={section.stage}>{section.content}</div>
            {section.units.map((unit, index) => <div className="beve-col-student beve-a4-block" data-measure={`${section.id}-${index}`} data-a4-stage={section.stage} key={index}>
              {unit}
            </div>)}
          </div>)}
        </div>
        {pages.map((page, index) => {
          const pageSections = [...new Set(page.parts.map(part => part.sectionId))].map(id => sections.find(section => section.id === id)!);
          return <div className={`beve-a4-row${sideBySide ? ' beve-a4-row--side' : ''}`} id={`beve-a4-page-${index + 1}`} key={index} style={{ '--a4-scale': scale, '--a4-paper-width': `${A4_WIDTH * scale}px` }}>
            <article className="beve-page beve-a4-paper" aria-label={`A4 page ${index + 1}`} data-overflow={page.parts.some(part => part.overflow)}>
              {renderHeader(index + 1)}
              <div className="beve-a4-paper-body" style={{ gap: `${A4_GAP}px` }}>
                {page.parts.map(part => {
                  const section = sections.find(section => section.id === part.sectionId)!;
                  return <section className="beve-col-student beve-a4-block" key={`${part.sectionId}-${part.unit}`} data-a4-section={section.id} data-a4-stage={section.stage} data-a4-overflow={part.overflow}>
                    {part.continued && <div className="beve-a4-continuation">{section.label} / Continued</div>}
                    {part.unit === null ? section.content : section.units[part.unit]}
                  </section>;
                })}
              </div>
              {renderFooter()}
            </article>
            <aside className="beve-a4-guide" aria-label={`Teaching notes for page ${index + 1}`}>
              {pageSections.map(section => {
                const overflow = page.parts.some(part => part.sectionId === section.id && part.overflow);
                const continued = page.parts.find(part => part.sectionId === section.id)?.continued;
                return <section className="beve-a4-note-group" key={section.id} data-note-section={section.id}>
                  <div className="beve-a4-note-heading"><span>{section.label}{continued ? ' / Continued' : ''}</span>
                    {onLayoutChange && <div className="beve-a4-layout-controls">
                      <button title="Keep this activity together" aria-label={`Keep ${section.label} together`} aria-pressed={!layout.allowSplit?.includes(section.id)} disabled={section.units.length < 2} onClick={() => toggle('allowSplit', section.id)}><i className={layout.allowSplit?.includes(section.id) ? 'ri-lock-unlock-line' : 'ri-lock-line'} /></button>
                      <button title="Start on a new page" aria-label={`Start ${section.label} on a new page`} aria-pressed={layout.breaksBefore?.includes(section.id) || false} onClick={() => toggle('breaksBefore', section.id)}><i className="ri-page-separator" /></button>
                    </div>}
                  </div>
                  {overflow && <div className="beve-a4-overflow-warning" role="alert"><i className="ri-error-warning-line" />This activity exceeds one A4 page. Shorten it or divide it into smaller activities before printing.</div>}
                  <div className="beve-col-tutor">{section.notes}</div>
                  {onLayoutChange && section.tools.length > 0 && <details className="beve-a4-editing-tools"><summary>Editing tools</summary>{section.tools}</details>}
                </section>;
              })}
            </aside>
          </div>;
        })}
      </div>
    </div>
  );
}
