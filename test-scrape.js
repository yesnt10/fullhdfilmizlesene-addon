const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://www.fullhdfilmizlesene.tv";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const headers = {
    "User-Agent": USER_AGENT,
    "Referer": BASE_URL
};

async function test() {
    console.log("Testing Catalog...");
    try {
        const catUrl = `${BASE_URL}/yeni-filmler/`;
        const catRes = await axios.get(catUrl, { headers });
        const $ = cheerio.load(catRes.data);
        
        const movies = [];
        $("a[href^='https://www.fullhdfilmizlesene.tv/film/']").each((i, element) => {
            if (movies.length >= 5) return;
            
            const href = $(element).attr("href");
            const img = $(element).find("img");
            
            if (img.length > 0) {
                const title = img.attr("alt") || $(element).attr("title");
                const match = href.match(/\/film\/([^/]+)\/?/);
                if (match && title) {
                    movies.push({
                        id: "fhf:" + match[1],
                        name: title,
                        href: href
                    });
                }
            }
        });
        
        console.log("Found movies:", movies);

        if (movies.length > 0) {
            const movie = movies[0];
            console.log(`\nTesting Stream for ${movie.name} (${movie.href})...`);
            
            const streamRes = await axios.get(movie.href, { headers });
            const $s = cheerio.load(streamRes.data);
            
            const streams = [];
            $s("iframe").each((i, el) => {
                const src = $s(el).attr("src") || $s(el).attr("data-src");
                if (src) {
                    streams.push(src);
                }
            });
            
            console.log("Found streams:", streams);
        }

    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) console.error("Status:", error.response.status);
    }
}

test();
