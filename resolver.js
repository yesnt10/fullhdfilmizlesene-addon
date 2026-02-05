import cheerio from "cheerio";
import { getMoviePage } from "./scraper.js";

export async function resolveStreams(id) {
  const html = await getMoviePage(id);
  const $ = cheerio.load(html);

  const streams = [];

  $("iframe").each((i, el) => {
    const src = $(el).attr("src");
    if (!src) return;

    streams.push({
      title: "FullHD Stream",
      url: src
    });
  });

  return streams;
}
