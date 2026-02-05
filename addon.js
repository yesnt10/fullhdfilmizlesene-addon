const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const manifest = {
    id: 'org.hdfilmizle.stremio',
    version: '1.0.0',
    name: 'HDFilmizle Addon',
    description: 'HDFilmizle.to sitesinden film ve dizi izleme',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [
        { type: 'movie', id: 'hdfilmizle-movies', name: 'HDFilmizle Filmler' },
        { type: 'series', id: 'hdfilmizle-series', name: 'HDFilmizle Diziler' }
    ],
    idPrefixes: ['hdfilmizle:']
};

const builder = new addonBuilder(manifest);

const BASE_URL = 'https://www.hdfilmizle.to';
const SKIP_PATH_PARTS = ['tur', 'yil', 'ulke', 'turkce-dublaj', 'turkce-altyazili', 'giris', 'kayit', 'ara', 'search', 'tag', 'etiket', 'sayfa', 'page', 'wp-', 'feed', 'author', 'category', 'film-robot', 'dizi-robot', 'yabanci-dizi-izle', 'en-cok-izlenenler', 'imdb-puani', 'mobil-uygulama', 'iletisim', 'hakkinda', 'reklam', 'gizlilik', 'kullanim', 'film-istekleri', 'istek'];

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

const axiosOpts = { headers, timeout: 15000, validateStatus: () => true };

function slugToTitle(slug) {
    if (!slug || typeof slug !== 'string') return 'Bilinmeyen';
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function toMetaId(href) {
    const path = href.startsWith('http') ? new URL(href).pathname : href;
    const url = path.startsWith('http') ? path : BASE_URL + path;
    const b64 = Buffer.from(url, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `hdfilmizle:${b64}`;
}

function fromMetaId(id) {
    if (!id || !id.startsWith('hdfilmizle:')) return null;
    try {
        let b64 = id.replace('hdfilmizle:', '').replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        return Buffer.from(b64, 'base64').toString('utf-8');
    } catch {
        return null;
    }
}

/** Ana sayfadan film ve dizi linklerini topla */
async function fetchCatalogFromHome(type) {
    const items = [];
    const seen = new Set();

    try {
        const res = await axios.get(BASE_URL + '/', axiosOpts);
        if (res.status !== 200) return items;

        const $ = cheerio.load(res.data);

        const $root = $('main, #content, .content, .site-content, [class*="main"], [class*="film-list"], [class*="movie-list"], .archive').first();
        const $links = $root.length ? $root.find('a[href]') : $('a[href]');

        $links.each((_, el) => {
            let href = $(el).attr('href') || '';
            href = href.trim().replace(/\/+$/, '');
            if (!href || href === '#' || href === '/') return;

            const full = href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? href : '/' + href);
            if (!full.startsWith(BASE_URL)) return;

            const path = (href.startsWith('http') ? new URL(href).pathname : href).replace(/^\//, '') || '';
            const parts = path.split('/').filter(Boolean);
            if (parts.length === 0) return;

            const isSeries = parts[0] === 'dizi' && parts.length >= 2;
            const isFilm = parts.length === 1 && !parts[0].startsWith('dizi');

            if (SKIP_PATH_PARTS.some(skip => path.toLowerCase().includes(skip))) return;
            if (type === 'movie' && !isFilm) return;
            if (type === 'series' && !isSeries) return;

            const norm = full.replace(/\/+$/, '');
            if (seen.has(norm)) return;
            seen.add(norm);

            let name = $(el).text().trim().replace(/\s+/g, ' ');
            const parent = $(el).closest('article, .item, .film-item, .movie-item, .poster, [class*="film"], [class*="movie"], [class*="card"]');
            const ratingYearMatch = name.match(/\d{4}\s+(.+)/s);
            if (ratingYearMatch) {
                name = ratingYearMatch[1].replace(/\s*(Dram|Komedi|Aksiyon|Gerilim|Korku|Romantik|Bilim Kurgu|Suç|Fantastik|Tarih|Aile|Müzik|Belgesel|Yerli)[\s\S]*$/i, '').trim();
            }
            const looksLikeRatingOrYear = /^[\d.,\s-]+$/.test(name) || name.length < 3;
            if (looksLikeRatingOrYear) name = '';
            if (!name) name = parent.find('h2, h3, .title, [class*="title"]').first().text().trim().replace(/\s+/g, ' ');
            if (!name || name.length < 2) {
                name = isSeries ? slugToTitle(parts.slice(1).join('-')) : slugToTitle(parts[0] || '');
            }
            const navWords = ['keşfet', 'film türleri', 'diziler', 'en çok izlenenler', 'imdb 500', 'giriş', 'kayıt', 'ara', 'iletişim', 'hakkında', 'gizlilik', 'kullanım', 'mobil uygulama', 'film robot', 'dizi robot'];
            const nameLower = name.toLowerCase();
            if (navWords.some(w => nameLower === w || nameLower.startsWith(w + ' ') || (name.length < 22 && nameLower.includes(w)))) return;
            if (!name || name.length < 2) return;

            let poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
            if (!poster && parent.length) {
                poster = parent.find('img').first().attr('src') || parent.find('img').first().attr('data-src');
            }
            if (poster && !poster.startsWith('http') && !poster.startsWith('data:')) poster = BASE_URL + poster;

            items.push({
                id: toMetaId(norm),
                type: type,
                name: name,
                poster: poster || undefined,
                posterShape: 'poster'
            });
        });

        return items.slice(0, 150);
    } catch (e) {
        console.error('fetchCatalogFromHome:', e.message);
        return items;
    }
}

/** Dizi sayfasından sezon/bölüm listesi (videos) */
async function fetchSeriesMeta(seriesPageUrl) {
    try {
        const url = seriesPageUrl.startsWith('http') ? seriesPageUrl : BASE_URL + seriesPageUrl;
        const res = await axios.get(url, axiosOpts);
        if (res.status !== 200) return null;

        const $ = cheerio.load(res.data);
        const videos = [];
        const seen = new Set();

        $('a[href*="/sezon-"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const full = href.startsWith('http') ? href : BASE_URL + href;
            if (!full.includes('/sezon-') || !full.includes('/bolum-')) return;

            const key = full.replace(/\/+$/, '');
            if (seen.has(key)) return;
            seen.add(key);

            const m = full.match(/sezon-(\d+).*?bolum-(\d+)/i);
            if (!m) return;
            const season = parseInt(m[1], 10);
            const episode = parseInt(m[2], 10);
            if (isNaN(season) || isNaN(episode)) return;

            let title = $(el).text().trim();
            if (!title) title = `S${season} E${episode}`;

            videos.push({
                id: toMetaId(key),
                title: title,
                released: new Date().toISOString().slice(0, 10),
                season,
                episode
            });
        });

        const name = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        const description = $('[class*="description"], .content p, .sinopsis').first().text().trim();
        const poster = $('img[src*="poster"], .poster img, [class*="poster"] img').first().attr('src');
        const rating = $('[class*="rating"], .imdb').first().text().trim().match(/\d+[.,]?\d*/);
        const year = $('a[href*="/yil/"]').first().text().trim().match(/\d{4}/);

        return {
            id: toMetaId(url),
            type: 'series',
            name: name || 'Dizi',
            description: description || undefined,
            poster: poster && (poster.startsWith('http') ? poster : BASE_URL + poster),
            posterShape: 'poster',
            releaseInfo: year ? year[0] : undefined,
            imdbRating: rating ? rating[0].replace(',', '.') : undefined,
            videos: videos.sort((a, b) => a.season - b.season || a.episode - b.episode)
        };
    } catch (e) {
        console.error('fetchSeriesMeta:', e.message);
        return null;
    }
}

/** Film sayfası meta (tek video) */
async function fetchMovieMeta(filmPageUrl) {
    try {
        const url = filmPageUrl.startsWith('http') ? filmPageUrl : BASE_URL + filmPageUrl;
        const res = await axios.get(url, axiosOpts);
        if (res.status !== 200) return null;

        const $ = cheerio.load(res.data);
        const name = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        const description = $('[class*="description"], .content p, .sinopsis').first().text().trim();
        const poster = $('img[src*="poster"], .poster img, [class*="poster"] img').first().attr('src');
        const rating = $('[class*="rating"], .imdb').first().text().trim().match(/\d+[.,]?\d*/);
        const year = $('a[href*="/yil/"]').first().text().trim().match(/\d{4}/);

        return {
            id: toMetaId(url),
            type: 'movie',
            name: name || 'Film',
            description: description || undefined,
            poster: poster && (poster.startsWith('http') ? poster : BASE_URL + poster),
            posterShape: 'poster',
            releaseInfo: year ? year[0] : undefined,
            imdbRating: rating ? rating[0].replace(',', '.') : undefined
        };
    } catch (e) {
        console.error('fetchMovieMeta:', e.message);
        return null;
    }
}

/** Sayfadan izleme linki ve iframe/m3u8 bul */
async function getStreamLinks(pageUrl) {
    const streams = [];
    try {
        const url = pageUrl.startsWith('http') ? pageUrl : BASE_URL + pageUrl;
        const res = await axios.get(url, axiosOpts);
        if (res.status !== 200) return streams;

        const $ = cheerio.load(res.data);
        const html = res.data;

        const watchLinks = [];
        $('a[href]').each((_, el) => {
            const text = $(el).text().trim().toUpperCase();
            const href = $(el).attr('href') || '';
            if (text === 'DUAL' || text === 'İZLE' || text === 'TÜRKÇE DUBLAJ' || text === 'TÜRKÇE ALTYAZILI' || text.includes('İZLE')) {
                const full = href.startsWith('http') ? href : BASE_URL + href;
                if (full.startsWith(BASE_URL)) watchLinks.push(full);
            }
        });

        let watchUrl = watchLinks[0] || url;

        const iframes = [];
        $('iframe[src]').each((_, el) => {
            const src = $(el).attr('src') || '';
            if (src && !src.includes('facebook') && !src.includes('twitter')) {
                iframes.push(src.startsWith('http') ? src : BASE_URL + src);
            }
        });

        const m3u8Matches = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi);
        if (m3u8Matches && m3u8Matches.length) {
            const unique = [...new Set(m3u8Matches)];
            unique.forEach((u, i) => streams.push({ name: `HLS ${i + 1}`, url: u }));
        }

        if (iframes.length) {
            for (const iframeSrc of iframes.slice(0, 3)) {
                try {
                    const ir = await axios.get(iframeSrc, { ...axiosOpts, timeout: 8000 });
                    if (ir.status !== 200) continue;
                    const m3u8 = (ir.data && typeof ir.data === 'string') ? ir.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi) : null;
                    if (m3u8 && m3u8.length) {
                        m3u8.forEach((u, i) => streams.push({ name: `Player HLS ${i + 1}`, url: u }));
                    }
                } catch (_) {}
            }
        }

        if (streams.length === 0 && (watchLinks.length || iframes.length)) {
            const external = watchLinks[0] || (iframes[0] ? iframes[0] : url);
            streams.push({
                name: 'Tarayıcıda Aç',
                externalUrl: external,
                behaviorHints: { notWebReady: true }
            });
        }

        if (streams.length === 0) {
            streams.push({
                name: 'Siteye Git',
                externalUrl: url,
                behaviorHints: { notWebReady: true }
            });
        }

        return streams;
    } catch (e) {
        console.error('getStreamLinks:', e.message);
        return [{
            name: 'Siteye Git',
            externalUrl: pageUrl.startsWith('http') ? pageUrl : BASE_URL + pageUrl,
            behaviorHints: { notWebReady: true }
        }];
    }
}

builder.defineCatalogHandler(async (args) => {
    if (args.type === 'movie' && args.id === 'hdfilmizle-movies') {
        const metas = await fetchCatalogFromHome('movie');
        return { metas };
    }
    if (args.type === 'series' && args.id === 'hdfilmizle-series') {
        const metas = await fetchCatalogFromHome('series');
        return { metas };
    }
    return { metas: [] };
});

builder.defineMetaHandler(async (args) => {
    const url = fromMetaId(args.id);
    if (!url) return { meta: null };

    if (args.type === 'series') {
        const meta = await fetchSeriesMeta(url);
        return meta ? { meta } : { meta: null };
    }
    if (args.type === 'movie') {
        const meta = await fetchMovieMeta(url);
        return meta ? { meta } : { meta: null };
    }
    return { meta: null };
});

builder.defineStreamHandler(async (args) => {
    const url = fromMetaId(args.id);
    if (!url) return { streams: [] };

    const streamList = await getStreamLinks(url);
    const streams = streamList.map(s => {
        const out = {
            name: s.name || 'Stream',
            title: s.name,
            behaviorHints: s.behaviorHints || { notWebReady: true }
        };
        if (s.url) out.url = s.url;
        if (s.externalUrl) out.externalUrl = s.externalUrl;
        return out;
    });

    return { streams };
});

module.exports = builder.getInterface();
