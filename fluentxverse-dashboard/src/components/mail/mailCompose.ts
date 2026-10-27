export const INLINE_IMAGE_LIMIT = 192 * 1024;

export function composedEditorHtml(html: string) {
  const template = document.createElement('template'); template.innerHTML = html;
  for (const node of template.content.querySelectorAll<HTMLElement>('[class]')) {
    for (const name of node.classList) {
      const indent = /^ql-indent-([1-8])$/.exec(name);
      if (indent) node.style.paddingLeft = `${Number(indent[1]) * 3}em`;
    }
    node.removeAttribute('class');
  }
  for (const image of template.content.querySelectorAll('img')) { image.style.maxWidth = '100%'; image.style.height = 'auto'; }
  return template.innerHTML;
}

export function initialEditorHtml(html: string) {
  const template = document.createElement('template'); template.innerHTML = html;
  for (const node of template.content.querySelectorAll<HTMLElement>('[style]')) {
    const indent = /^(3|6|9|12|15|18|21|24)em$/.exec(node.style.paddingLeft);
    if (indent) node.classList.add(`ql-indent-${Number(indent[1]) / 3}`);
  }
  return template.innerHTML;
}

export function safeComposeLink(input: string) {
  try {
    const url = new URL(input.trim());
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function inlineImageBytes(html: string) {
  const template = document.createElement('template'); template.innerHTML = html;
  return [...template.content.querySelectorAll('img')].reduce((total, image) => {
    const data = (image.getAttribute('src') || '').split(',')[1] || '';
    return total + Math.max(0, data.length * .75 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0));
  }, 0);
}

const dataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Image could not be read.')); reader.readAsDataURL(file);
});

export async function prepareInlineImage(file: File, remaining: number) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, GIF, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image under 10 MB, or attach the original file.');
  if (remaining < 1024) throw new Error('Inline image limit reached. Attach additional images as files.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw new Error('Choose an image smaller than 24 megapixels, or attach the original file.');
    if (file.size <= remaining && bitmap.width <= 1600 && bitmap.height <= 1600) return dataUrl(file);
    if (file.type === 'image/gif') throw new Error('Animated GIFs must fit the 192 KB inline limit. Attach the original file instead.');
    const canvas = document.createElement('canvas');
    let ratio = Math.min(1, 1280 / bitmap.width, 1280 / bitmap.height);
    for (let pass = 0; pass < 5; pass++, ratio *= .75) {
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Image processing is unavailable. Attach the file instead.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', .82);
      if ((result.length - result.indexOf(',') - 1) * .75 <= remaining) return result;
    }
    throw new Error('This image is too large to insert. Attach the original file instead.');
  } finally { bitmap.close(); }
}
