export const A4_WIDTH = 794;
export const A4_HEIGHT = A4_WIDTH * 297 / 210;
export const A4_GAP = 20;
export const A4_CONTINUATION_HEIGHT = 40;

export interface BusinessA4Layout {
  breaksBefore?: string[];
  allowSplit?: string[];
}

export interface A4MeasuredSection {
  id: string;
  label: string;
  stage: number;
  height: number;
  units: number[];
}

export interface A4PagePart {
  sectionId: string;
  unit: number | null;
  height: number;
  continued: boolean;
  overflow: boolean;
}

export interface A4Page {
  parts: A4PagePart[];
  used: number;
}

export function paginateA4(sections: A4MeasuredSection[], capacity: number, layout: BusinessA4Layout = {}): A4Page[] {
  const pages: A4Page[] = [];
  let page: A4Page = { parts: [], used: 0 };
  let stage: number | undefined;
  const finish = () => {
    if (page.parts.length) pages.push(page);
    page = { parts: [], used: 0 };
  };
  for (const section of sections) {
    if (section.stage !== stage || layout.breaksBefore?.includes(section.id)) finish();
    stage = section.stage;
    const split = section.units.length > 1
      && (section.height > capacity || Boolean(layout.allowSplit?.includes(section.id)));
    const heights = split ? section.units : [section.height];
    heights.forEach((baseHeight, index) => {
      let continued = split && index > 0 && !page.parts.some(part => part.sectionId === section.id);
      let height = baseHeight + (continued ? A4_CONTINUATION_HEIGHT : 0);
      const gap = page.parts.length ? A4_GAP : 0;
      if (page.used + gap + height > capacity + 0.5 && page.parts.length) {
        finish();
        continued = split && index > 0;
        height = baseHeight + (continued ? A4_CONTINUATION_HEIGHT : 0);
      }
      page.used += (page.parts.length ? A4_GAP : 0) + height;
      page.parts.push({
        sectionId: section.id, unit: split ? index : null, height,
        continued, overflow: height > capacity + 0.5,
      });
    });
  }
  finish();
  return pages;
}

export function isBusinessA4Pilot(lesson: { course?: string; level?: number; chapter?: number; lessonNumber?: number } | null) {
  return lesson?.course === 'business-english' && lesson.level === 3 && lesson.chapter === 1 && lesson.lessonNumber === 1;
}
