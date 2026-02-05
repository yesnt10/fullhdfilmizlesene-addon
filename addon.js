const { addonBuilder } = require("stremio-addon-sdk");

const manifest = {
    "id": "org.fullhdfilmizlesene.addon",
    "version": "1.0.0",
    "name": "FullHDFilmizlesene",
    "description": "Watch movies from fullhdfilmizlesene.tv",
    "resources": ["catalog", "stream", "meta"],
    "types": ["movie"],
    "catalogs": [
        {
            "type": "movie",
            "id": "fhf_new",
            "name": "FullHDFilmizlesene Yeni",
            "extra": [
                { "name": "search", "isRequired": false },
                { "name": "skip", "isRequired": false }
            ]
        }
    ],
    "idPrefixes": ["fhf:"]
};

const builder = new addonBuilder(manifest);

module.exports = builder;
