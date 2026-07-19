import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { searchMAL } from '../src/mal.js';
import { loginJKAnime, searchJKAnime, getJKAnimeDetails, saveAnimeJKAnime } from '../src/jkanime.js';

// Setup Mock Fetch utility
const originalFetch = globalThis.fetch;

function setupMockFetch(handler) {
  globalThis.fetch = async (url, options) => {
    try {
      const responseData = await handler(url, options);
      if (responseData) {
        return responseData;
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: true, message: err.message }), { status: 500 });
    }
    return new Response('', { status: 404 });
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

test('MAL Search HTML Scraping Integration', async () => {
  setupMockFetch(async (url) => {
    if (url.includes('myanimelist.net/anime.php')) {
      const mockHTML = `
        <table>
          <tr>
            <td><!-- Cover image column --></td>
            <td>
              <div class="title">
                <a class="hoverinfo_trigger" href="https://myanimelist.net/anime/57466/Honzuki_no_Gekokujou">
                  <strong>Honzuki no Gekokujou 4th Season</strong>
                </a>
              </div>
            </td>
            <td>TV</td>
            <td>12</td>
            <td>8.65</td>
          </tr>
        </table>
      `;
      return new Response(mockHTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  });

  const results = await searchMAL('Honzuki 4th');
  restoreFetch();

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].mal_id, 57466);
  assert.strictEqual(results[0].title, 'Honzuki no Gekokujou 4th Season');
  assert.strictEqual(results[0].type, 'TV');
  assert.strictEqual(results[0].episodes, 12);
  assert.strictEqual(results[0].score, 8.65);
});

test('JKanime Full Integration Flow (Login -> Search -> Fetch Details -> Save Watchlist)', async () => {
  let loginCalled = false;
  let searchCalled = false;
  let detailsCalled = false;
  let saveCalled = false;

  setupMockFetch(async (url, options) => {
    // 1. Mock Login API
    if (url.includes('login.jkanime.net/api/login')) {
      loginCalled = true;
      assert.strictEqual(options.method, 'POST');
      
      const payload = new URLSearchParams(options.body);
      assert.strictEqual(payload.get('usuario'), 'test_user');
      assert.strictEqual(payload.get('password'), 'correct_password');

      return new Response(JSON.stringify({ error: false, jkauth: 'mocked_api_token_value' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'jk_session=session_token_12345; path=/; domain=jkanime.net; secure; httponly'
        }
      });
    }

    // 2. Mock Search page
    if (url.includes('jkanime.net/buscar')) {
      searchCalled = true;
      assert.ok(url.includes('q=Honzuki'));

      const searchHTML = `
        <div class="anime__item">
          <a href="https://jkanime.net/honzuki-no-gekokujou-4/">
            <div class="anime__item__pic" data-setbg="https://cdn.jkdesa.com/cover.jpg"></div>
          </a>
          <div class="anime__item__text">
            <ul><li class="anime">Serie</li></ul>
            <h5><a href="https://jkanime.net/honzuki-no-gekokujou-4/">Honzuki no Gekokujou 4</a></h5>
          </div>
        </div>
      `;
      return new Response(searchHTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 3. Mock Details page
    if (url.includes('jkanime.net/honzuki-no-gekokujou-4/')) {
      detailsCalled = true;
      const detailsHTML = `
        <div class="anime_info"><h3>Honzuki no Gekokujou 4</h3></div>
        <div class="anime_pic"><img src="https://cdn.jkdesa.com/cover.jpg"/></div>
        <p rel="sinopsis">In this season, Myne continues her path to become a librarian.</p>
        <li rel="tipo"><span>Tipo:</span> Serie</li>
        <button id="guardar-anime" data-anime="9988"></button>
      `;
      return new Response(detailsHTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 4. Mock Save/Mark Watchlist API
    if (url.includes('login.jkanime.net/api/guardar_anime')) {
      saveCalled = true;
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers.Cookie, 'jk_session=session_token_12345');
      
      const payload = new URLSearchParams(options.body);
      assert.strictEqual(payload.get('id'), '9988');
      assert.strictEqual(payload.get('tag'), '1'); // watching

      const ainfo = JSON.parse(payload.get('ainfo'));
      assert.strictEqual(ainfo.title, 'Honzuki no Gekokujou 4');
      assert.strictEqual(ainfo.tipo, 'Serie');
      assert.strictEqual(ainfo.url, '/honzuki-no-gekokujou-4/');
      assert.strictEqual(ainfo.status, 'ti-eye');

      return new Response(JSON.stringify({ status: 'ok', message: 'Anime guardado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  // End-to-End Simulation
  // Step A: Login
  const loginRes = await loginJKAnime('test_user', 'correct_password');
  assert.strictEqual(loginRes.jkauth, 'mocked_api_token_value');
  assert.strictEqual(loginRes.cookies, 'jk_session=session_token_12345');

  // Step B: Search
  const searchResults = await searchJKAnime('Honzuki');
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].title, 'Honzuki no Gekokujou 4');
  assert.strictEqual(searchResults[0].href, 'https://jkanime.net/honzuki-no-gekokujou-4/');

  // Step C: Fetch Details
  const details = await getJKAnimeDetails(searchResults[0].href);
  assert.strictEqual(details.animeId, '9988');
  assert.strictEqual(details.title, 'Honzuki no Gekokujou 4');
  assert.strictEqual(details.tipo, 'Serie');
  assert.strictEqual(details.thumb, '/cover.jpg');

  // Step D: Save Watchlist
  const saveRes = await saveAnimeJKAnime(details, 1, loginRes.cookies);
  assert.strictEqual(saveRes.status, 'ok');

  restoreFetch();

  // Verify all async flow steps were executed
  assert.ok(loginCalled, 'Login API mock was not invoked');
  assert.ok(searchCalled, 'Search API mock was not invoked');
  assert.ok(detailsCalled, 'Details Scraper mock was not invoked');
  assert.ok(saveCalled, 'Save Watchlist API mock was not invoked');
});
