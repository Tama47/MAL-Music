/* =========================================================
   LOAD UI
   ========================================================= */

/* Auto-load from URL (?user=) */
window.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");

    if (user) {
        document.getElementById("username").value = user;
        loadMAL(user);
    }
});

/* Manual submit */
function goUser() {
    const username = document.getElementById("username").value.trim();
    if (!username) return;

    const url = new URL(window.location.href);
    url.searchParams.set("user", username);

    history.pushState({}, "", url);

    loadMAL(username);
}


/* =========================================================
   LOAD MAL
   ========================================================= */

async function loadMAL(username) {

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "Loading...";

    const url =
        `https://corsproxy.io/?url=https://myanimelist.net/animelist/${username}/load.json?status=1`;

    console.log("MAL request:", url);

    const malList = await (await fetch(url)).json();

    resultsDiv.innerHTML = "";

    /* Print all IDs first */
    console.log("\nMAL IDS requests...\n");

    malList.forEach(a =>
        console.log(a.anime_id + " -> https://myanimelist.net/anime/" + a.anime_id)
    );

    console.log("\Jikan API requests...\n");

    /* Sequential processing */
    for (const anime of malList) {

        const id = anime.anime_id;
        const title = anime.anime_title_eng || anime.anime_title;
        const image = toLargeImage(anime.anime_image_path);

        const cached = await loadAnime(id, title, image);

        if (!cached) await sleep(1000);
    }
}


/* =========================================================
   LOAD ANIME
   ========================================================= */

async function loadAnime(id, title, image) {

    let usedCache = true;
    let themes = getCache(id);

    if (!themes) {

        console.log("Jikan request:", id);

        const res = await fetch(
            `https://api.jikan.moe/v4/anime/${id}/themes`
        );

        const data = await res.json();

        themes = data.data;

        setCache(id, themes);

        usedCache = false;

    } else {
        console.log("CACHE HIT:", id);
    }

    renderCard(id, title, image, themes);

    return usedCache;
}


/* =========================================================
   RENDER CARD
   ========================================================= */

function renderCard(id, title, image, themes) {

    const openingsSet = new Set();
    const endingsSet = new Set();

    const openings = [];
    const endings = [];

    let opCounter = 1;
    let edCounter = 1;

    /* OPENINGS */
    for (const op of (themes.openings || [])) {

        const parsed = parseTheme(op);
        const key = parsed.titleEng + parsed.artistEng;

        if (openingsSet.has(key)) continue;

        openingsSet.add(key);

        openings.push({
            counter: opCounter++,
            musicTitle: `Opening ${opCounter - 1} | ${parsed.titleEng} by ${parsed.artistEng}`,
            ...parsed
        });
    }

    /* ENDINGS */
    for (const ed of (themes.endings || [])) {

        const parsed = parseTheme(ed);
        const key = parsed.titleEng + parsed.artistEng;

        if (openingsSet.has(key) || endingsSet.has(key)) continue;

        endingsSet.add(key);

        endings.push({
            counter: edCounter++,
            musicTitle: `Ending ${edCounter - 1} | ${parsed.titleEng} by ${parsed.artistEng}`,
            ...parsed
        });
    }

    const malLink = `https://myanimelist.net/anime/${id}`;

    const card = document.createElement("div");
    card.className = "anime-card";

    card.innerHTML = `
        <img src="${image}">

        <div>
            <h3>
                <a class="title-link" href="${malLink}" target="_blank">
                    ${title}
                </a>
            </h3>

            <strong>Openings:</strong>
            ${renderSongs(openings)}

            <br>

            <strong>Endings:</strong>
            ${renderSongs(endings)}
        </div>
    `;

    document.getElementById("results").appendChild(card);
}


/* =========================================================
   SONG RENDER
   ========================================================= */

function renderSongs(list) {

    if (!list.length) return "<div class='song'>None</div>";

    return list.map(item => {

        const engQuery =
            encodeURIComponent(`${item.titleEng} by ${item.artistEng}`);

        const jpQuery =
            encodeURIComponent(`${item.titleJp} - ${item.artistJp}`);

        return `
        <div class="song">
            ${item.musicTitle}

            <a href="https://music.youtube.com/search?q=${engQuery}" target="_blank">🇬🇧</a>
            <a href="https://music.youtube.com/search?q=${jpQuery}" target="_blank">🇯🇵</a>
        </div>
        `;
    }).join("");
}


/* =========================================================
   PARSE THEME
   ========================================================= */

function parseTheme(theme) {

    let cleaned = theme.replace(/^\d+:?\s*"?/, '').trim();

    const bySplit = cleaned.split(/ by /);

    let titlePart = bySplit[0] || cleaned;
    let artistPart = bySplit[1] || "";

    const jpMatch = titlePart.match(/\((.*?)\)/);

    let titleEng = titlePart
        .replace(/\s*\(.*?\)/g, '')
        .replace(/^"+|"+$/g, '')
        .trim();

    let titleJp = jpMatch ? jpMatch[1].trim() : titleEng;

    artistPart = artistPart.replace(/^"+|"+$/g, '').trim();

    const artistJpMatch = artistPart.match(/\((.*?)\)/);

    let artistEng = artistPart.replace(/\(.*?\)/g, '').trim();
    let artistJp = artistJpMatch ? artistJpMatch[1].trim() : artistEng;

    return { titleEng, titleJp, artistEng, artistJp };
}


/* =========================================================
   IMAGE RESIZE
   ========================================================= */

function toLargeImage(url) {
    if (!url) return "";

    url = url.split("?")[0];

    return url
        .replace("/r/192x272", "")
        .replace(".webp", "l.webp")
        .replace(".jpg", "l.jpg");
}


/* =========================================================
   CACHE
   ========================================================= */

function getCache(id) {
    const raw = localStorage.getItem("jikan_" + id);
    if (!raw) return null;

    try {
        const obj = JSON.parse(raw);
        if (Date.now() - obj.time > 86400000) return null;
        return obj.data;
    } catch {
        return null;
    }
}

function setCache(id, data) {
    localStorage.setItem("jikan_" + id, JSON.stringify({
        time: Date.now(),
        data
    }));
}


/* =========================================================
   ⏱ Timer
   ========================================================= */

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
