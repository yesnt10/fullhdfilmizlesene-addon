const puppeteer = require("puppeteer");

async function test() {
    console.log("Testing Puppeteer...");
    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        
        await page.goto("https://www.fullhdfilmizlesene.tv/yeni-filmler/", { waitUntil: 'domcontentloaded' });
        
        const title = await page.title();
        console.log("Page Title:", title);
        
        const movies = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll("a[href^='https://www.fullhdfilmizlesene.tv/film/']").forEach(el => {
                if (items.length >= 5) return;
                const img = el.querySelector("img");
                if (img) {
                    items.push({
                        href: el.href,
                        title: img.alt || el.title
                    });
                }
            });
            return items;
        });
        
        console.log("Movies:", movies);
        
        await browser.close();
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
