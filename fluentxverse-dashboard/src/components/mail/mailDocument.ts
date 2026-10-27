function remoteImage(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') && !url.hostname.startsWith('[') && !/^\d+(\.\d+){3}$/.test(url.hostname) && !/\.(localhost|local|internal|lan)$/i.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}

export function emailDocument(html: string, showImages: boolean, token: string) {
  const template = document.createElement('template'); template.innerHTML = html;
  const backgrounds = new Map<string, string>();
  for (const registry of template.content.querySelectorAll<HTMLTemplateElement>('template[data-mail-backgrounds]')) {
    try {
      const text = registry.content.textContent || '';
      if (text.length <= 100_000) for (const [name, source] of Object.entries(JSON.parse(text))) {
        const url = typeof source === 'string' ? remoteImage(source) : '';
        if (backgrounds.size < 40 && /^--mail-bg-\d{1,2}$/.test(name) && url) backgrounds.set(name, url);
      }
    } catch {}
    registry.remove();
  }
  template.content.querySelectorAll('script,iframe,object,embed,form,input,button,textarea,select,base,meta,link,svg,math,audio,video,source').forEach(node => node.remove());
  for (const node of template.content.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) if (/^on/i.test(attribute.name) || ['nonce', 'srcdoc', 'srcset', 'background'].includes(attribute.name)) node.removeAttribute(attribute.name);
  }
  let externalImages = backgrounds.size;
  for (const image of template.content.querySelectorAll('img')) {
    const source = image.getAttribute('src') || '', remote = remoteImage(image.getAttribute('data-mail-src') || source);
    image.removeAttribute('src'); image.removeAttribute('data-mail-src');
    if (/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(source)) image.setAttribute('src', source);
    else if (remote) {
      externalImages++;
      if (showImages) { image.setAttribute('src', remote); image.setAttribute('referrerpolicy', 'no-referrer'); }
      else {
        image.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        image.setAttribute('data-mail-image-state', 'blocked');
        const width = Number.parseFloat(image.style.width || image.getAttribute('width') || ''), height = Number.parseFloat(image.style.height || image.getAttribute('height') || '');
        if (!height) image.style.setProperty('height', `${width > 96 ? 80 : width > 0 ? width : 32}px`, 'important');
        if (height !== 1 && height !== 2) image.style.setProperty('background-color', '#dce3eb', 'important');
      }
    }
  }
  if (showImages && backgrounds.size) {
    const style = document.createElement('style');
    style.textContent = `:root{${[...backgrounds].map(([name, url]) => `${name}:url(${JSON.stringify(url)})`).join(';')}}`;
    template.content.append(style);
  }
  for (const link of template.content.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    if (!/^(https?:|mailto:)/i.test(href)) link.removeAttribute('href');
    link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer');
  }
  const script = `(()=>{const token=${JSON.stringify(token)};let previous=0;function size(){const height=Math.ceil(Math.max(document.body.scrollHeight,document.body.getBoundingClientRect().height));if(height!==previous){previous=height;parent.postMessage({type:'fluentxverse-mail-size',token,height},'*')}}new ResizeObserver(size).observe(document.body);document.addEventListener('load',size,true);addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='fluentxverse-mail-measure'&&event.data.token===token)size()});requestAnimationFrame(size);setTimeout(size,150)})();`;
  const policy = `default-src 'none'; script-src 'nonce-${token}'; img-src data:${showImages ? ' https:' : ''}; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'`;
  return { externalImages, source: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><style>html{margin:0;padding:0}body{font:14px/1.5 Arial,sans-serif;color:#202124;margin:0;padding:0;overflow-wrap:anywhere}table{max-width:100%!important}img{max-width:100%!important}pre,code{white-space:pre-wrap}a{color:#0958cb}blockquote{margin-left:0;padding-left:16px;border-left:2px solid #dce4ef}</style></head><body>${template.innerHTML}<script nonce="${token}">${script}</script></body></html>` };
}
