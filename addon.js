const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

// Eklenti manifestosu
const manifest = {
    id: 'org.fullhdfilmizlesene',
    version: '1.0.0',
    name: 'FullHD Film İzlesene',
    description: 'FullHDFilmizlesene.tv sitesinden film stream eklentisi',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    catalogs: [
        {
            type: 'movie',
            id: 'fullhdfilmizlesene-catalog',
            name: 'FullHD Film İzlesene',
            extra: [
                {
                    name: 'skip',
                    isRequired: false
                }
            ]
        }
    ],
    idPrefixes: ['fhd_']
};

const builder = new addonBuilder(manifest);

// User agent tanımı
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Ana sayfa URL'i
const BASE_URL = 'https://www.fullhdfilmizlesene.tv';

// İstek headers'ları
const REQUEST_HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
};

// Film listesini çek
async function fetchMovieCatalog(skip = 0) {
    try {
        const page = Math.floor(skip / 20) + 1;
        const url = page === 1 ? `${BASE_URL}/film-izle` : `${BASE_URL}/film-izle/page/${page}`;
        
        console.log(`[CATALOG] Fetching: ${url}`);
        
        const response = await axios.get(url, {
            headers: REQUEST_HEADERS,
            timeout: 15000,
            maxRedirects: 5
        });

        console.log(`[CATALOG] Response status: ${response.status}`);
        
        const $ = cheerio.load(response.data);
        const movies = [];

        // Tüm olası film container selector'ları
        const selectors = [
            'article',
            '.post',
            '.movie-item',
            '.film-item',
            '.movie',
            '.film',
            '.video-item',
            '.listing-item',
            'div[class*="post"]',
            'div[class*="movie"]',
            'div[class*="film"]',
            'div[class*="item"]'
        ];

        console.log('[CATALOG] Trying selectors...');
        
        // Her selector'ı dene
        for (const selector of selectors) {
            const elements = $(selector);
            console.log(`[CATALOG] Selector "${selector}" found ${elements.length} elements`);
            
            if (elements.length > 0) {
                elements.each((i, element) => {
                    try {
                        const $elem = $(element);
                        
                        // Link bul - tüm olasılıkları kontrol et
                        let $link = $elem.find('a[href*="film"]').first();
                        if (!$link.length) $link = $elem.find('a[href*="izle"]').first();
                        if (!$link.length) $link = $elem.find('a').first();
                        
                        if (!$link.length) return;
                        
                        const href = $link.attr('href');
                        if (!href || href === '#') return;
                        
                        // Başlık bul
                        let title = $link.attr('title') || 
                                   $link.attr('data-title') ||
                                   $elem.find('.title, .entry-title, h2, h3, h1').first().text().trim() ||
                                   $link.text().trim();
                        
                        if (!title || title.length < 2) return;
                        
                        // Poster bul
                        const $img = $elem.find('img').first();
                        let poster = $img.attr('data-src') || 
                                    $img.attr('data-lazy-src') ||
                                    $img.attr('src') || '';
                        
                        // URL'den ID oluştur
                        const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');
                        const id = 'fhd_' + Buffer.from(cleanHref).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                        
                        const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
                        const fullPoster = poster.startsWith('http') ? poster : (poster ? BASE_URL + poster : '');
                        
                        // Duplicate kontrolü
                        if (!movies.find(m => m.id === id)) {
                            const movieMeta = {
                                id: id,
                                type: 'movie',
                                name: title,
                                poster: fullPoster || 'https://via.placeholder.com/300x450?text=Film',
                                posterShape: 'poster',
                                background: fullPoster || undefined,
                                logo: undefined,
                                description: title,
                                releaseInfo: new Date().getFullYear().toString(),
                                links: [fullUrl]
                            };
                            
                            movies.push(movieMeta);
                            
                            console.log(`[CATALOG] Added movie: ${title}`);
                        }
                    } catch (err) {
                        console.error('[CATALOG] Parse error:', err.message);
                    }
                });
                
                if (movies.length > 0) break; // İlk başarılı selector'da dur
            }
        }

        console.log(`[CATALOG] Total movies found: ${movies.length}`);
        return movies;
        
    } catch (error) {
        console.error('[CATALOG] Fetch error:', error.message);
        if (error.response) {
            console.error('[CATALOG] Response status:', error.response.status);
            console.error('[CATALOG] Response headers:', error.response.headers);
        }
        return [];
    }
}

// Film detay sayfasından stream linklerini çek
async function getStreamLinks(movieUrl) {
    try {
        console.log(`[STREAM] Fetching: ${movieUrl}`);
        
        const response = await axios.get(movieUrl, {
            headers: REQUEST_HEADERS,
            timeout: 15000,
            maxRedirects: 5
        });

        console.log(`[STREAM] Response status: ${response.status}`);
        
        const $ = cheerio.load(response.data);
        const streams = [];

        // iframe src'leri bul
        $('iframe').each((i, elem) => {
            const src = $(elem).attr('src') || $(elem).attr('data-src');
            if (src) {
                const fullSrc = src.startsWith('http') ? src : BASE_URL + src;
                streams.push(fullSrc);
                console.log(`[STREAM] Found iframe: ${fullSrc}`);
            }
        });

        // Video kaynak linklerini bul
        $('source, video source').each((i, elem) => {
            const src = $(elem).attr('src') || $(elem).attr('data-src');
            if (src) {
                const fullSrc = src.startsWith('http') ? src : BASE_URL + src;
                streams.push(fullSrc);
                console.log(`[STREAM] Found video source: ${fullSrc}`);
            }
        });

        // data-src attribute'larını kontrol et
        $('[data-src]').each((i, elem) => {
            const src = $(elem).attr('data-src');
            if (src && (src.includes('.mp4') || src.includes('.m3u8') || src.includes('stream'))) {
                const fullSrc = src.startsWith('http') ? src : BASE_URL + src;
                streams.push(fullSrc);
                console.log(`[STREAM] Found data-src: ${fullSrc}`);
            }
        });

        // Script içindeki video linklerini bul
        $('script').each((i, elem) => {
            const scriptContent = $(elem).html() || '';
            const matches = scriptContent.match(/(https?:\/\/[^\s"']+\.(?:mp4|m3u8))/gi);
            if (matches) {
                matches.forEach(url => {
                    streams.push(url);
                    console.log(`[STREAM] Found in script: ${url}`);
                });
            }
        });

        // video tag'leri
        $('video').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                const fullSrc = src.startsWith('http') ? src : BASE_URL + src;
                streams.push(fullSrc);
                console.log(`[STREAM] Found video tag: ${fullSrc}`);
            }
        });

        const uniqueStreams = [...new Set(streams)];
        console.log(`[STREAM] Total unique streams found: ${uniqueStreams.length}`);
        
        return uniqueStreams;
    } catch (error) {
        console.error('[STREAM] Fetch error:', error.message);
        if (error.response) {
            console.error('[STREAM] Response status:', error.response.status);
        }
        return [];
    }
}

// Basit cache mekanizması
const catalogCache = {
    data: [],
    timestamp: 0,
    ttl: 300000 // 5 dakika
};

const movieUrlCache = new Map();

// Catalog handler
builder.defineCatalogHandler(async (args) => {
    console.log('[HANDLER] Catalog request:', args);
    
    if (args.type === 'movie' && args.id === 'fullhdfilmizlesene-catalog') {
        const skip = parseInt(args.extra.skip) || 0;
        
        // Cache kontrolü (sadece ilk sayfa için)
        if (skip === 0 && catalogCache.data.length > 0 && 
            (Date.now() - catalogCache.timestamp) < catalogCache.ttl) {
            console.log('[HANDLER] Returning cached catalog');
            const metas = catalogCache.data.map(m => ({
                id: m.id,
                type: m.type,
                name: m.name,
                poster: m.poster,
                posterShape: m.posterShape,
                background: m.background,
                description: m.description,
                releaseInfo: m.releaseInfo
            }));
            return { metas: metas };
        }
        
        const movies = await fetchMovieCatalog(skip);
        
        // Cache'e kaydet (sadece ilk sayfa)
        if (skip === 0 && movies.length > 0) {
            catalogCache.data = movies;
            catalogCache.timestamp = Date.now();
            
            // URL'leri cache'e al
            movies.forEach(movie => {
                if (movie.links && movie.links[0]) {
                    movieUrlCache.set(movie.id, movie.links[0]);
                }
            });
        }
        
        console.log(`[HANDLER] Returning ${movies.length} movies`);
        
        // Stremio için sadece gerekli alanları dön
        const metas = movies.map(m => ({
            id: m.id,
            type: m.type,
            name: m.name,
            poster: m.poster,
            posterShape: m.posterShape,
            background: m.background,
            description: m.description,
            releaseInfo: m.releaseInfo
        }));
        
        return { metas: metas };
    }

    return { metas: [] };
});

// Stream handler
builder.defineStreamHandler(async (args) => {
    console.log('[HANDLER] Stream request:', args);
    
    if (args.type === 'movie' && args.id.startsWith('fhd_')) {
        try {
            // Cache'den URL al
            let movieUrl = movieUrlCache.get(args.id);
            
            // Cache'de yoksa catalog'dan bul
            if (!movieUrl) {
                console.log('[HANDLER] Movie URL not in cache, fetching catalog...');
                const movies = await fetchMovieCatalog(0);
                const movie = movies.find(m => m.id === args.id);
                
                if (movie && movie.links && movie.links[0]) {
                    movieUrl = movie.links[0];
                    movieUrlCache.set(args.id, movieUrl);
                }
            }
            
            if (!movieUrl) {
                console.log('[HANDLER] Movie URL not found');
                return { streams: [] };
            }

            console.log(`[HANDLER] Getting streams for: ${movieUrl}`);
            const streamLinks = await getStreamLinks(movieUrl);
            
            if (streamLinks.length === 0) {
                console.log('[HANDLER] No streams found, returning external link');
                // Hiç stream bulunamadıysa, sayfa linkini göster
                return {
                    streams: [{
                        url: movieUrl,
                        name: '🌐 Tarayıcıda Aç',
                        title: 'Film sayfasını tarayıcıda açar',
                        externalUrl: movieUrl
                    }]
                };
            }
            
            const streams = streamLinks.map((url, index) => {
                // Stream tipini belirle
                let name = '📺 Kaynak ' + (index + 1);
                if (url.includes('.m3u8')) {
                    name += ' (HLS)';
                } else if (url.includes('.mp4')) {
                    name += ' (MP4)';
                } else if (url.includes('iframe')) {
                    name += ' (Embed)';
                }

                return {
                    url: url,
                    name: name,
                    title: name
                };
            });

            console.log(`[HANDLER] Returning ${streams.length} streams`);
            return { streams: streams };
            
        } catch (error) {
            console.error('[HANDLER] Stream handler error:', error.message);
            return { streams: [] };
        }
    }

    return { streams: [] };
});

// Sunucuyu başlat
const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`
🎬 FullHD Film İzlesene Stremio Eklentisi Başlatıldı!
🌐 Sunucu: http://127.0.0.1:${PORT}/manifest.json
📝 Stremio'ya eklemek için yukarıdaki URL'i kullanın
`);
