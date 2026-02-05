const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const builder = new addonBuilder({
    id: 'org.fullhdfilm.tr',
    version: '1.0.0',
    name: 'FullHD Filmizlesene',
    description: 'fullhdfilmizlesene.tv - Türkçe Filmler',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    idPrefixes: ['fhdf']
});

// Ana sayfadaki filmleri çek
async function fetchHomepageMovies() {
    try {
        const { data } = await axios.get('https://www.fullhdfilmizlesene.tv/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const movies = [];
        
        $('.filmbox').each((i, elem) => {
            const $elem = $(elem);
            const title = $elem.find('.title').text().trim();
            const link = $elem.find('a').attr('href');
            const img = $elem.find('img').attr('src');
            
            if (title && link) {
                const id = link.split('/').filter(Boolean).pop();
                
                movies.push({
                    id: `fhdf${id}`,
                    type: 'movie',
                    name: title,
                    poster: img || '',
                    description: `${title} - FullHD Kalitesinde`,
                    genres: ['Film']
                });
            }
        });
        
        return movies.slice(0, 50); // İlk 50 film
    } catch (error) {
        console.error('Hata:', error.message);
        return [];
    }
}

// Stream bulma
async function findStream(id) {
    const movieId = id.replace('fhdf', '');
    
    try {
        const { data } = await axios.get(
            `https://www.fullhdfilmizlesene.tv/${movieId}/`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        
        const $ = cheerio.load(data);
        const streams = [];
        
        // Video embedlerini ara
        $('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"]').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                streams.push({
                    url: src,
                    title: `Video ${i + 1}`,
                    name: 'External Player'
                });
            }
        });
        
        return streams;
    } catch (error) {
        return [];
    }
}

// Handler'lar
builder.defineCatalogHandler(async () => {
    const metas = await fetchHomepageMovies();
    return { metas };
});

builder.defineStreamHandler(async ({ type, id }) => {
    if (type === 'movie' && id.startsWith('fhdf')) {
        const streams = await findStream(id);
        return { streams };
    }
    return { streams: [] };
});

module.exports = builder.getInterface();
