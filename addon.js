import express from "express";
import { addonBuilder, serveHTTP } from "stremio-addon-sdk";
import { getCatalog } from "./scraper.js";
import { resolveStreams } from "./resolver.js";

const manifest = {
  id: "org.fullhdfilm.addon",
  version: "1.0.0",
  name: "FullHD Film Addon",
  description: "FullHDFilmizlesene movies",
  resources: ["catalog", "stream"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "fullhdfilm",
      name: "FullHD Filmler"
    }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async () => {
  const metas = await getCatalog(1);
  return { metas };
});

builder.defineStreamHandler(async ({ id }) => {
  const streams = await resolveStreams(id);
  return { streams };
});

const addonInterface = builder.getInterface();

const app = express();
serveHTTP(addonInterface, { app });

const PORT = 7000;
app.listen(PORT, () => {
  console.log(`Addon running on http://localhost:${PORT}/manifest.json`);
});
