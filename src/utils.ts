import * as cheerio from 'cheerio';

export interface SubjectData {
  videos: [string, string][];
  pdfs: [string, string][];
  others: [string, string][];
}

export function getUrlType(url: string): 'video' | 'pdf' | 'other' {
  const u = url.toLowerCase();
  if (u.endsWith('.pdf') || u.includes('/pdfs/') || u.includes('class-attachment')) {
    return 'pdf';
  }
  if (
    u.includes('.m3u8') ||
    u.includes('.mp4') ||
    u.includes('brightcove') ||
    u.includes('cloudfront') ||
    u.includes('edge.api') ||
    u.includes('recordedmp4') ||
    u.includes('selectionwaylive') ||
    u.includes('youtube.com') ||
    u.includes('youtu.be')
  ) {
    return 'video';
  }
  return 'other';
}

export function inferSubject(title: string, url: string): string {
  const parts = title.split('|').map((p) => p.trim());
  if (parts.length >= 3) {
    return parts[1];
  }
  if (parts.length === 2) {
    const candidate = parts[1].trim();
    if (candidate.length > 1 && !/^\d+$/.test(candidate)) {
      return candidate;
    }
  }
  const t = getUrlType(url);
  return t === 'pdf' ? 'PDFs' : t === 'video' ? 'Videos' : 'Others';
}

export function batchFromFilename(fname: string): string {
  const base = fname.split('.').slice(0, -1).join('.');
  let name = base.replace(/_+/g, ' ').trim();
  name = name.replace(/\s+/g, ' ');
  return name || 'Batch';
}

export function parseTxt(text: string, filename: string = ''): [string, Map<string, SubjectData>] {
  let batchName = '';
  const subjects = new Map<string, SubjectData>();

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(/\s*:\s*(https?:\/\/\S+)\s*$/);
    if (!match) continue;

    const url = match[1].trim();
    let title = line.substring(0, match.index).trim();

    const bracketMatch = title.match(/^\[(.+?)\]\s*(.*)$/);
    let subject = '';

    if (bracketMatch) {
      const topic = bracketMatch[1].trim();
      const name = bracketMatch[2].trim();

      if (topic.toLowerCase() === 'batch thumbnail' || topic.toLowerCase() === 'thumbnail') {
        if (!batchName) {
          batchName = name;
        }
        continue;
      }

      subject = topic;
      title = name || topic;
    } else {
      subject = inferSubject(title, url);
    }

    if (!subjects.has(subject)) {
      subjects.set(subject, { videos: [], pdfs: [], others: [] });
    }

    const type = getUrlType(url);
    const bucket = (type + 's') as keyof SubjectData;
    subjects.get(subject)![bucket].push([title, url]);
  }

  if (!batchName) {
    batchName = batchFromFilename(filename);
  }

  return [batchName, subjects];
}

function esc(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

export function generateHtml(batchName: string, subjects: Map<string, SubjectData>, template: string): string {
  let subjectsContent = '';
  let foldersContent = '';

  let i = 0;
  for (const [subj, data] of subjects.entries()) {
    subjectsContent += `<div class="subject-folder" data-subject="${esc(subj.toLowerCase())}" onclick="openFolder(${i})">📁 ${esc(subj)}</div>`;

    const videos = data.videos;
    const pdfs = data.pdfs;
    const others = data.others;

    const videoHtml = videos.length
      ? videos
          .map(([t, url]) => {
            const ext = url.toLowerCase().includes('.m3u8') ? 'm3u8' : 'mp4';
            return `<a href="#" onclick="playVideo(&#39;${url}&#39;,&#39;${ext}&#39;)" class="video-item">${esc(t)}</a>`;
          })
          .join('')
      : "<p class='empty-message'>No videos available</p>";

    const pdfHtml = pdfs.length
      ? pdfs.map(([t, u]) => `<a href="${u}" target="_blank" class="pdf-item">📄 ${esc(t)}</a>`).join('')
      : "<p class='empty-message'>No PDFs available</p>";

    const otherHtml = others.length
      ? others.map(([t, u]) => `<a href="${u}" target="_blank" class="other-item">${esc(t)}</a>`).join('')
      : "<p class='empty-message'>No other files available</p>";

    foldersContent += `
        <div id="folder-${i}" class="folder-content" data-subject-index="${i}">
            <div class="folder-header">
                <button class="back-btn" onclick="closeFolder()">🔙 Back</button>
                <h2>${esc(subj)}</h2>
            </div>
            <div class="folder-search">
                <input type="text" id="folder-search-${i}" class="folder-search-input"
                       placeholder="🔍 Search in this subject..." onkeyup="searchInFolder(${i})">
            </div>
            <div class="tab-container">
                <div class="tab" onclick="showCategory('videos-${i}')">📹 Videos (${videos.length})</div>
                <div class="tab" onclick="showCategory('pdfs-${i}')">📄 PDFs (${pdfs.length})</div>
                <div class="tab" onclick="showCategory('others-${i}')">📁 Others (${others.length})</div>
            </div>
            <div id="videos-${i}" class="category-content">
                <h3>📹 Videos</h3>
                <div class="links-list" id="videos-list-${i}">${videoHtml}</div>
                <div id="videos-empty-${i}" class="category-empty-message" style="display:none;">❌ No matching videos found</div>
            </div>
            <div id="pdfs-${i}" class="category-content" style="display:none;">
                <h3>📄 PDFs</h3>
                <div class="links-list" id="pdfs-list-${i}">${pdfHtml}</div>
                <div id="pdfs-empty-${i}" class="category-empty-message" style="display:none;">❌ No matching PDFs found</div>
            </div>
            <div id="others-${i}" class="category-content" style="display:none;">
                <h3>📁 Other Files</h3>
                <div class="links-list" id="others-list-${i}">${otherHtml}</div>
                <div id="others-empty-${i}" class="category-empty-message" style="display:none;">❌ No matching files found</div>
            </div>
        </div>
    `;
    i++;
  }

  return template
    .replace(/{{batch_name}}/g, batchName)
    .replace(/{{subjects_content}}/g, subjectsContent)
    .replace(/{{folders_content}}/g, foldersContent);
}

export function htmlToTxt(htmlText: string): [string, string] {
  const $ = cheerio.load(htmlText);
  const lines: string[] = [];

  let batchName = $('title').text().trim();
  if (!batchName) {
    batchName = $('h1, .title-box h1, .header h1, .batch-title, h2').first().text().trim();
  }
  if (!batchName) batchName = 'Batch';

  let thumbnailUrl = '';
  $('a').each((_, el) => {
    const t = $(el).text().trim().toLowerCase();
    if (t.includes('thumbnail')) {
      const href = $(el).attr('href')?.trim();
      if (href && href !== '#' && href !== '') {
        thumbnailUrl = href;
        return false;
      }
    }
  });

  if (!thumbnailUrl) {
    thumbnailUrl = $('meta[property="og:image"]').attr('content') || '';
  }

  lines.push(`[Batch Thumbnail] ${batchName} : ${thumbnailUrl || 'https://example.com/thumbnail.jpg'}`);

  // Style C - JS CONFIG with base64 URLs
  const b64Regex = /\{"title"\s*:\s*"([^"]+)"\s*,\s*"link"\s*:\s*"([A-Za-z0-9+/]{20,}=*)"\s*,\s*"type"\s*:\s*"([^"]+)"\}/g;
  let b64Match;
  const b64Items: [string, string, string][] = [];
  while ((b64Match = b64Regex.exec(htmlText)) !== null) {
    b64Items.push([b64Match[1], b64Match[2], b64Match[3]]);
  }

  if (b64Items.length > 0) {
    const subjOrder: string[] = [];
    const subjItems = new Map<string, [string, string, string][]>();

    const subjBlockRegex = /"([^"]{1,80})":\s*\[(\s*\{[^\]]*?\}[\s,]*)+\]/g;
    let subjBlockMatch;
    while ((subjBlockMatch = subjBlockRegex.exec(htmlText)) !== null) {
      const subjName = subjBlockMatch[1];
      const blockText = subjBlockMatch[0];
      const blockItems: [string, string, string][] = [];
      let itemMatch;
      const itemRegex = /\{"title"\s*:\s*"([^"]+)"\s*,\s*"link"\s*:\s*"([A-Za-z0-9+/]{20,}=*)"\s*,\s*"type"\s*:\s*"([^"]+)"\}/g;
      while ((itemMatch = itemRegex.exec(blockText)) !== null) {
        blockItems.push([itemMatch[1], itemMatch[2], itemMatch[3]]);
      }
      if (blockItems.length > 0) {
        subjItems.set(subjName, blockItems);
        if (!subjOrder.includes(subjName)) subjOrder.push(subjName);
      }
    }

    if (subjOrder.length > 0) {
      for (const subj of subjOrder) {
        for (const [title, link, typ] of subjItems.get(subj)!) {
          const url = isBase64Url(link) ? decodeBase64(link) : link;
          lines.push(`[${subj}] ${title} : ${url}`);
        }
      }
    } else {
      for (const [title, link, typ] of b64Items) {
        const url = isBase64Url(link) ? decodeBase64(link) : link;
        const subj = typ === 'VIDEO' ? 'Videos' : 'PDFs';
        lines.push(`[${subj}] ${title} : ${url}`);
      }
    }
    return [batchName, lines.join('\n')];
  }

  // Style A - folder-content divs
  const folderDivs = $('.folder-content');
  if (folderDivs.length > 0) {
    folderDivs.each((_, folder) => {
      const subject = $(folder).find('h2').text().trim() || 'Unknown';

      $(folder).find('a.video-item').each((_, a) => {
        const title = $(a).text().trim();
        const onclick = $(a).attr('onclick') || '';
        const url = extractOnclickUrl(onclick);
        if (url) lines.push(`[${subject}] ${title} : ${url}`);
      });

      $(folder).find('a.pdf-item').each((_, a) => {
        const title = $(a).text().trim().replace(/^📄/, '').trim();
        const href = $(a).attr('href')?.trim();
        if (href && href !== '#') lines.push(`[${subject}] ${title} : ${href}`);
      });

      $(folder).find('a.other-item').each((_, a) => {
        const title = $(a).text().trim();
        const href = $(a).attr('href')?.trim();
        if (href && href !== '#') lines.push(`[${subject}] ${title} : ${href}`);
      });
    });
    return [batchName, lines.join('\n')];
  }

  // Style B - tab-based
  const videosTab = $('#videos-tab');
  const pdfsTab = $('#pdfs-tab');
  if (videosTab.length > 0 || pdfsTab.length > 0) {
    [
      { tab: videosTab, def: 'Videos' },
      { tab: pdfsTab, def: 'PDFs' },
    ].forEach(({ tab, def }) => {
      if (tab.length === 0) return;
      tab.find('a.list-item').each((_, a) => {
        const text = $(a).text().trim();
        const onclick = $(a).attr('onclick') || '';
        const href = $(a).attr('href')?.trim() || '';

        const sm = text.match(/^\[(.+?)\]\s*(.+)$/);
        const subject = sm ? sm[1].trim() : def;
        const title = sm ? sm[2].trim() : text;

        const url = extractOnclickUrl(onclick) || (href !== '#' ? href : '');
        if (url) lines.push(`[${subject}] ${title} : ${url}`);
      });
    });
    return [batchName, lines.join('\n')];
  }

  // Generic fallback
  const seen = new Set<string>();
  $('a').each((_, a) => {
    const text = $(a).text().trim();
    const onclick = $(a).attr('onclick') || '';
    const href = $(a).attr('href')?.trim() || '';

    let url = extractOnclickUrl(onclick);
    if (!url && href && !['#', 'javascript:void(0)', ''].includes(href)) {
      url = href;
    }

    if (!url || seen.has(url)) return;
    seen.add(url);

    const sm = text.match(/^\[(.+?)\]\s*(.+)$/);
    let subject = '';
    let title = '';
    if (sm) {
      subject = sm[1].trim();
      title = sm[2].trim();
    } else {
      const ul = url.toLowerCase();
      if (ul.includes('.m3u8') || ul.includes('.mp4')) {
        subject = 'Videos';
      } else if (ul.includes('.pdf')) {
        subject = 'PDFs';
      } else {
        subject = 'Others';
      }
      title = text || url.split('/').pop()?.split('?')[0] || 'File';
    }

    if (title) lines.push(`[${subject}] ${title} : ${url}`);
  });

  return [batchName, lines.join('\n')];
}

function extractOnclickUrl(onclick: string): string {
  const patterns = [
    /playVideo\(['"]([^'"]+)['"]/,
    /playVideo\((?:&#39;|&quot;)([^'\"&]+)(?:&#39;|&quot;)/,
    /openPDF\(['"]([^'"]+)['"]/,
    /window\.open\(['"]([^'"]+)['"]/,
  ];
  for (const pat of patterns) {
    const m = onclick.match(pat);
    if (m) return m[1].trim();
  }
  return '';
}

function isBase64Url(s: string): boolean {
  if (!s || s.length < 20) return false;
  try {
    const decoded = Buffer.from(s, 'base64').toString('utf-8');
    return decoded.startsWith('http');
  } catch {
    return false;
  }
}

function decodeBase64(s: string): string {
  try {
    return Buffer.from(s, 'base64').toString('utf-8');
  } catch {
    return s;
  }
}
