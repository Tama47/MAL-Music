let currentLanguage = "en";

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

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("lang-en")
        .addEventListener("click", () => setLanguage("en"));

    document.getElementById("lang-jp")
        .addEventListener("click", () => setLanguage("jp"));
});

function setLanguage(lang) {

    currentLanguage = lang;

    document
        .getElementById("lang-en")
        .classList.toggle("active", lang === "en");

    document
        .getElementById("lang-jp")
        .classList.toggle("active", lang === "jp");

    const username =
        document.getElementById("username").value.trim();

    if (username) {
        document.getElementById("results").innerHTML = "";
        loadMAL(username);
    }
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

    console.log("\nTenrai API requests...\n");

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
    let metadata = getCache("metadata_" + id);

    if (!themes) {

        const res = await fetch(
            `https://api.tenrai.org/v1/anime/${id}/themes`
        );

        const data = await res.json();

        themes = data.data;

        setCache(id, themes);

        usedCache = false;
    }

    if (!metadata) {

        const animeRes = await fetch(
            `https://api.tenrai.org/v1/anime/${id}`
        );

        const animeData = await animeRes.json();

        metadata = animeData.data;

        setCache("metadata_" + id, metadata);

        usedCache = false;
    }

    if (usedCache) {
        console.log("CACHE HIT:", id);
    } else {
        console.log("Tenrai request:", id);
    }

    renderCard(
        id,
        title,
        image,
        themes,
        metadata.title_english || title,
        metadata.title_japanese || title
    );

    return usedCache;
}


/* =========================================================
   RENDER CARD
   ========================================================= */

function renderCard(id, title, image, themes, titleEng, titleJp) {

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
            ${renderSongs(
                openings,
                id,
                titleEng,
                titleJp
            )}

            <br>

            <strong>Endings:</strong>
            ${renderSongs(
                endings,
                id,
                titleEng,
                titleJp
            )}
        </div>
    `;

    document.getElementById("results").appendChild(card);
}


/* =========================================================
   SONG RENDER
   ========================================================= */

function renderSongs(list, animeId, animeTitleEng, animeTitleJp) {

    if (!list.length)
        return "<div class='song'>None</div>";

    return list.map(item => {

        const isOpening =
            item.musicTitle.startsWith("Opening");

        const type =
            isOpening ? "Opening" : "Ending";

        const songQuery =
            currentLanguage === "jp"
                ? encodeURIComponent(
                    `${item.titleJp} - ${item.artistJp}`
                )
                : encodeURIComponent(
                    `${item.titleEng} by ${item.artistEng}`
                );

        const songText =
            currentLanguage === "jp"
                ? `${item.titleJp} - ${item.artistJp}`
                : `${item.titleEng} by ${item.artistEng}`;

        const labelText =
            currentLanguage === "jp"
                ? `ノンクレジット${isOpening ? "OP" : "ED"}`
                : type;

        const searchText = currentLanguage === "jp" ?
            `${animeTitleJp} ノンクレジット${isOpening ? "OP" : "ED"}` :
            `${animeTitleEng} ${type}`;

        const searchQuery = encodeURIComponent(searchText);

        return `
        <div class="song">

            <a href="https://www.google.com/search?q=${searchQuery}&tbm=vid" target="_blank">
                ${labelText}
            </a>

            |

            <a href="https://music.youtube.com/search?q=${songQuery}" target="_blank">
                ${songText}
            </a>

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

    let artistJp = artistEng;

    // only accept JP if it actually contains Japanese characters
    if (artistJpMatch && /[\u3040-\u30ff\u4e00-\u9faf]/.test(artistJpMatch[1])) {
        artistJp = artistJpMatch[1].trim();
    }

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
    const raw = localStorage.getItem("Tenrai_" + id);
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
    localStorage.setItem("Tenrai_" + id, JSON.stringify({
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
