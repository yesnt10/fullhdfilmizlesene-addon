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

// Film listesini çek
async function fetchMovieCatalog(skip = 0) {
    try {
        const page = Math.floor(skip / 20) + 1;
        const url = page === 1 ? `${BASE_URL}/film-izle` : `${BASE_URL}/film-izle/page/${page}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const movies = [];

        // Film kartlarını bul ve parse et
        $('.movie-item, article, .film-item, .post').each((i, element) => {
            try {
                const $elem = $(element);
                const $link = $elem.find('a').first();
                const title = $link.attr('title') || $link.text().trim() || $elem.find('h2, h3, .title').text().trim();
                const href = $link.attr('href');
                const $img = $elem.find('img').first();
                const poster = $img.attr('src') || $img.attr('data-src') || '';

                if (title && href) {
                    // URL'den ID oluştur
                    const id = 'fhd_' + href.replace(/[^a-zA-Z0-9]/g, '_');
                    
                    movies.push({
                        id: id,
                        type: 'movie',
                        name: title,
                        poster: poster.startsWith('http') ? poster : (poster ? BASE_URL + poster : ''),
                        posterShape: 'poster',
                        links: [href.startsWith('http') ? href : BASE_URL + href]
                    });
                }
            } catch (err) {
                console.error('Parse error:', err.message);
            }
        });

        return movies;
    } catch (error) {
        console.error('Catalog fetch error:', error.message);
        return [];
    }
}

// Film detay sayfasından stream linklerini çek
async function getStreamLinks(movieUrl) {
    try {
        const response = await axios.get(movieUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const streams = [];

        // iframe src'leri bul
        $('iframe').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                streams.push(src.startsWith('http') ? src : BASE_URL + src);
            }
        });

        // Video kaynak linklerini bul
        $('source, video source').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                streams.push(src.startsWith('http') ? src : BASE_URL + src);
            }
        });

        // data-src attribute'larını kontrol et
        $('[data-src]').each((i, elem) => {
            const src = $(elem).attr('data-src');
            if (src && (src.includes('.mp4') || src.includes('.m3u8') || src.includes('stream'))) {
                streams.push(src.startsWith('http') ? src : BASE_URL + src);
            }
        });

        // Script içindeki video linklerini bul
        $('script').each((i, elem) => {
            const scriptContent = $(elem).html() || '';
            const matches = scriptContent.match(/(https?:\/\/[^\s"']+\.(?:mp4|m3u8))/gi);
            if (matches) {
                streams.push(...matches);
            }
        });

        return [...new Set(streams)]; // Tekrarları kaldır
    } catch (error) {
        console.error('Stream fetch error:', error.message);
        return [];
    }
}

// Catalog handler
builder.defineCatalogHandler(async (args) => {
    console.log('Catalog request:', args);
    
    if (args.type === 'movie' && args.id === 'fullhdfilmizlesene-catalog') {
        const skip = parseInt(args.extra.skip) || 0;
        const movies = await fetchMovieCatalog(skip);
        
        return {
            metas: movies
        };
    }

    return { metas: [] };
});

// Stream handler
builder.defineStreamHandler(async (args) => {
    console.log('Stream request:', args);
    
    if (args.type === 'movie' && args.id.startsWith('fhd_')) {
        try {
            // Cache'den film URL'ini al (gerçek uygulamada database kullanılmalı)
            // Şimdilik catalog'dan çekeceğiz
            const movies = await fetchMovieCatalog(0);
            const movie = movies.find(m => m.id === args.id);
            
            if (!movie || !movie.links || !movie.links[0]) {
                return { streams: [] };
            }

            const streamLinks = await getStreamLinks(movie.links[0]);
            
            const streams = streamLinks.map((url, index) => {
                // Stream tipini belirle
                let name = 'Kaynak ' + (index + 1);
                if (url.includes('.m3u8')) {
                    name += ' (HLS)';
                } else if (url.includes('.mp4')) {
                    name += ' (MP4)';
                }

                return {
                    url: url,
                    name: name,
                    title: name
                };
            });

            return { streams: streams };
        } catch (error) {
            console.error('Stream handler error:', error.message);
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
