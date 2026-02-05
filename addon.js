const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

// Eklenti manifestosu
const manifest = {
    id: 'org.hdfilmizle.stremio',
    version: '1.0.0',
    name: 'HDFilmizle Addon',
    description: 'HDFilmizle.to sitesinden film ve dizi izleme',
    resources: ['catalog', 'stream'],
    types: ['movie', 'series'],
    catalogs: [
        {
            type: 'movie',
            id: 'hdfilmizle-movies',
            name: 'HDFilmizle Filmler'
        },
        {
            type: 'series',
            id: 'hdfilmizle-series',
            name: 'HDFilmizle Diziler'
        }
    ],
    idPrefixes: ['hdfilmizle:']
};

const builder = new addonBuilder(manifest);

// Ana site URL'i
const BASE_URL = 'https://www.hdfilmizle.to';

// User agent tanımla
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Film/dizi listesini çek
async function fetchCatalog(type) {
    try {
        const url = type === 'movie' 
            ? `${BASE_URL}/filmler` 
            : `${BASE_URL}/diziler`;
        
        const response = await axios.get(url, { 
            headers,
            timeout: 10000 
        });
        const $ = cheerio.load(response.data);
        const items = [];

        // Her film/dizi elementini parse et
        $('.movie-item, .film-item, article, .item').each((i, element) => {
            try {
                const $elem = $(element);
                const title = $elem.find('h2, h3, .title, a[title]').first().text().trim() 
                    || $elem.find('img').attr('alt');
                const link = $elem.find('a').first().attr('href');
                const poster = $elem.find('img').first().attr('src') 
                    || $elem.find('img').first().attr('data-src');

                if (title && link) {
                    const id = `hdfilmizle:${Buffer.from(link).toString('base64')}`;
                    items.push({
                        id: id,
                        type: type,
                        name: title,
                        poster: poster ? (poster.startsWith('http') ? poster : BASE_URL + poster) : undefined,
                        posterShape: 'poster'
                    });
                }
            } catch (err) {
                console.error('Element parse hatası:', err);
            }
        });

        return items.slice(0, 100); // İlk 100 öğe
    } catch (error) {
        console.error('Katalog çekme hatası:', error.message);
        return [];
    }
}

// Video stream linklerini çek
async function getStreamLinks(url) {
    try {
        const response = await axios.get(url, { 
            headers,
            timeout: 10000 
        });
        const $ = cheerio.load(response.data);
        const streams = [];

        // iframe'leri bul
        $('iframe').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src && (src.includes('player') || src.includes('embed'))) {
                const fullUrl = src.startsWith('http') ? src : BASE_URL + src;
                streams.push({
                    title: `Stream ${i + 1}`,
                    url: fullUrl
                });
            }
        });

        // Video etiketlerini bul
        $('video source, video').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                const fullUrl = src.startsWith('http') ? src : BASE_URL + src;
                streams.push({
                    title: `Direkt Video ${i + 1}`,
                    url: fullUrl
                });
            }
        });

        // JavaScript içinden link aramayı dene
        $('script').each((i, elem) => {
            const scriptContent = $(elem).html();
            if (scriptContent) {
                const urlMatches = scriptContent.match(/(https?:\/\/[^\s"']+\.m3u8)/g);
                if (urlMatches) {
                    urlMatches.forEach((url, idx) => {
                        streams.push({
                            title: `HLS Stream ${idx + 1}`,
                            url: url
                        });
                    });
                }
            }
        });

        return streams;
    } catch (error) {
        console.error('Stream link çekme hatası:', error.message);
        return [];
    }
}

// Katalog handler
builder.defineCatalogHandler(async (args) => {
    console.log('Katalog isteği:', args);
    
    if (args.type === 'movie' && args.id === 'hdfilmizle-movies') {
        const movies = await fetchCatalog('movie');
        return { metas: movies };
    } else if (args.type === 'series' && args.id === 'hdfilmizle-series') {
        const series = await fetchCatalog('series');
        return { metas: series };
    }
    
    return { metas: [] };
});

// Stream handler
builder.defineStreamHandler(async (args) => {
    console.log('Stream isteği:', args);
    
    try {
        // ID'den URL'i çöz
        if (!args.id.startsWith('hdfilmizle:')) {
            return { streams: [] };
        }

        const encodedUrl = args.id.replace('hdfilmizle:', '');
        const url = Buffer.from(encodedUrl, 'base64').toString('utf-8');
        const fullUrl = url.startsWith('http') ? url : BASE_URL + url;

        console.log('İçerik URL:', fullUrl);

        // Stream linklerini çek
        const streamLinks = await getStreamLinks(fullUrl);

        // Stremio stream formatına çevir
        const streams = streamLinks.map((link, index) => ({
            name: link.title,
            title: link.title,
            url: link.url,
            behaviorHints: {
                notWebReady: true
            }
        }));

        // Eğer stream bulunamazsa, ana URL'i döndür
        if (streams.length === 0) {
            streams.push({
                name: 'Ana Sayfa',
                title: 'Siteye Git',
                externalUrl: fullUrl
            });
        }

        return { streams };
    } catch (error) {
        console.error('Stream handler hatası:', error);
        return { streams: [] };
    }
});

module.exports = builder.getInterface();
