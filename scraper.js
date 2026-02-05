import axios from "axios";
import * as cheerio from "cheerio";

const BASE = "https://www.fullhdfilmizlesene.tv";

export async function getCatalog(page = 1) {
  const url = `${BASE}/film-izle/page/${page}`;
  const { data } = await axios.get(url);

  const $ = cheerio.load(data);
  const movies = [];

  $(".poster").each((i, el) => {
    const title = $(el).find("img").attr("alt");
    const href = $(el).find("a").attr("href");
    const img = $(el).find("img").attr("src");

    if (!href) return;

    const id = Buffer.from(href).toString("base64");

    movies.push({
      id,
      type: "movie",
      name: title,
      poster: img
    });
  });

  return movies;
}

export async function getMoviePage(id) {
  const url = Buffer.from(id, "base64").toString("utf8");
  const { data } = await axios.get(url);
  return data;
}
