const { addonBuilder, serveHTTP, publishToCentral } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const builder = new addonBuilder({
    id: 'org.fullhdfilmizlesene',
    version: '1.0.0',
    name: 'FullHDFilmizlesene',
    description: 'fullhdfilmizlesene.tv sitesinden Türkçe filmler',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    idPrefixes: ['fhdf'],
    catalogs: [
        {
            type: 'movie',
            id: 'fullhdfilmizlesene',
            name: 'FullHD Filmizlesene',
            extra: [
                { name: 'search', isRequired: false },
                { name: 'genre', isRequired: false },
                { name: 'skip', isRequired: false }
            ]
        }
    ]
});

// Film meta verilerini çekme
async function getMovies(page = 1, search = null, genre = null) {
    try {
        let url = 'https://www.fullhdfilmizlesene.tv/film-izle/';
        
        if (search) {
            url = `https://www.fullhdfilmizlesene.tv/?s=${encodeURIComponent(search)}`;
        } else if (genre) {
            url = `https://www.fullhdfilmizlesene.tv/tur/${genre}/`;
        } else if (page > 1) {
            url = `https://www.fullhdfilmizlesene.tv/film-izle/page/${page}/`;
        }
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.moviefilm').each((i, element) => {
            const $element = $(element);
            const title = $element.find('.movief .title').text().trim();
            const movieUrl = $element.find('a').attr('href');
            const poster = $element.find('img').attr('src');
            const yearMatch = title.match(/\((\d{4})\)/);
            const year = yearMatch ? yearMatch[1] : '2023';
            
            if (title && movieUrl && poster) {
                const id = movieUrl.split('/').filter(Boolean).pop();
                
                movies.push({
                    id: `fhdf${id}`,
                    type: 'movie',
                    name: title.replace(/\(\d{4}\)/, '').trim(),
                    poster: poster,
                    posterShape: 'regular',
                    background: poster,
                    description: `Film - ${title}`,
                    releaseInfo: year,
                    genres: getGenres($element)
                });
            }
        });
        
        return movies;
    } catch (error) {
        console.error('Film çekme hatası:', error.message);
        return [];
    }
}

function getGenres($element) {
    const genres = [];
    const genreText = $element.find('.movief .category').text();
    
    if (genreText.includes('Aksiyon')) genres.push('Aksiyon');
    if (genreText.includes('Macera')) genres.push('Macera');
    if (genreText.includes('Komedi')) genres.push('Komedi');
    if (genreText.includes('Dram')) genres.push('Drama');
    if (genreText.includes('Korku')) genres.push('Korku');
    if (genreText.includes('Romantik')) genres.push('Romantik');
    if (genreText.includes('Bilim Kurgu')) genres.push('Bilim Kurgu');
    if (genreText.includes('Gerilim')) genres.push('Gerilim');
    if (genreText.includes('Savaş')) genres.push('Savaş');
    if (genreText.includes('Animasyon')) genres.push('Animasyon');
    
    return genres.length > 0 ? genres : ['Film'];
}

// Stream linklerini çekme
async function getStreams(id) {
    try {
        const movieId = id.replace('fhdf', '');
        const url = `https://www.fullhdfilmizlesene.tv/${movieId}/`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const streams = [];
        
        // Video iframelerini bul
        $('iframe').each((i, element) => {
            const src = $(element).attr('src');
            if (src && (src.includes('youtube') || src.includes('vimeo') || src.includes('dailymotion') || src.includes('openload'))) {
                streams.push({
                    url: src,
                    title: `Kaynak ${i + 1}`,
                    name: `Kaynak ${i + 1}`
                });
            }
        });
        
        // Video embed scriptlerini kontrol et
        const html = response.data;
        const videoRegex = /(https?:\/\/[^\s"'<>]+\.(mp4|m3u8|webm|mkv))(?=["'&?\s])/gi;
        const videoMatches = html.match(videoRegex);
        
        if (videoMatches) {
            videoMatches.forEach((url, i) => {
                streams.push({
                    url: url,
                    title: `Direct Stream ${i + 1}`,
                    name: `Direct ${i + 1}`
                });
            });
        }
        
        // Eğer stream bulunamazsa, alternatif yöntem
        if (streams.length === 0) {
            // Film adını al
            const title = $('h1').first().text().trim();
            
            // Alternatif stream için YouTube araması yap
            const searchQuery = encodeURIComponent(`${title} full film izle Türkçe dublaj`);
            streams.push({
                url: `https://www.youtube.com/results?search_query=${searchQuery}`,
                title: `YouTube'da Ara: ${title}`,
                name: 'YouTube',
                ytSearch: true
            });
        }
        
        return streams;
    } catch (error) {
        console.error('Stream çekme hatası:', error.message);
        return [];
    }
}

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (type !== 'movie') return { metas: [] };
    
    try {
        const page = extra && extra.skip ? Math.floor(extra.skip / 20) + 1 : 1;
        const search = extra && extra.search ? extra.search : null;
        const genre = extra && extra.genre ? extra.genre : null;
        
        const metas = await getMovies(page, search, genre);
        
        return {
            metas: metas,
            cacheMaxAge: 60 * 60, // 1 saat cache
            staleRevalidate: 60 * 60,
            staleError: 24 * 60 * 60
        };
    } catch (error) {
        console.error('Catalog hatası:', error);
        return { metas: [] };
    }
});

// Stream handler
builder.defineStreamHandler(async ({ type, id }) => {
    if (type !== 'movie' || !id.startsWith('fhdf')) {
        return { streams: [] };
    }
    
    try {
        const streams = await getStreams(id);
        
        // Stremio formatına çevir
        const stremioStreams = streams.map((stream, index) => ({
            url: stream.url,
            title: stream.title,
            name: stream.name || `Kaynak ${index + 1}`
        }));
        
        return {
            streams: stremioStreams,
            cacheMaxAge: 24 * 60 * 60, // 24 saat cache
            staleRevalidate: 24 * 60 * 60
        };
    } catch (error) {
        console.error('Stream handler hatası:', error);
        return { streams: [] };
    }
});

// Manifest tanımı
const manifest = {
    id: 'org.fullhdfilmizlesene',
    version: '1.0.0',
    name: 'FullHDFilmizlesene',
    description: 'fullhdfilmizlesene.tv sitesinden Türkçe filmler',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    idPrefixes: ['fhdf'],
    catalogs: [
        {
            type: 'movie',
            id: 'fullhdfilmizlesene',
            name: 'FullHD Filmizlesene',
            extra: [
                { name: 'search', isRequired: false },
                { name: 'genre', isRequired: false },
                { name: 'skip', isRequired: false }
            ]
        }
    ]
};

// HTTP sunucusu başlatma
async function startServer() {
    const addonInterface = builder.getInterface();
    
    const { server, port } = await serveHTTP(addonInterface, { port: 7000 });
    
    console.log(`Eklenti http://localhost:${port}/manifest.json adresinde çalışıyor`);
    
    // Merkeze yayınlamak için (opsiyonel)
    // await publishToCentral('https://your-deployment-url/manifest.json');
}

// Hata yakalama
process.on('unhandledRejection', (error) => {
    console.error('İşlenmemiş hata:', error);
});

startServer().catch(console.error);
