'use strict';

/**
 * Mantela を芋蔓式に取得する
 * @param { string | URL | Request } firstMantela - 起点となる Mantela
 * @param { FetchMantelas3Options } [optArgs = { }] - 追加の引数
 * @typedef { object } FetchMantelas3Options
 * @property { number } [maxDepth] - Mantela を辿る最大深さ
 * @property { number } [fetchTimeoutMs] - 各 Mantela の取得に費やす最大時間（ミリ秒）
 * @property { 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached' }
 *  [cache] - キャッシュモード
 * @property { 'same-origin' | 'cors' | 'no-cors' | 'navigate' }
 *  [mode] - オリジン間リクストの動作設定
 */
async function
fetchMantelas3(firstMantela, optArgs = { })
{
    /** @type { Map<string, { mantela: Mantela, [key: string]: unknown }> } */
    const mantelas = new Map();

    /** @type { Set<{ url: string | URL | Request, rev: string | URL | Request > } */
    const queue = new Set([ {
        url: firstMantela,      /* Mantela の URL */
        rev: 'firstMantela',    /* その Mantela を参照した人の URL */
    } ]);

    /** @type { Set<string | URL | Request> } */
    const visited = new Set();

    /** @type { Error[] } */
    const errors = [ ];

    /** @type { number } */
    const maxDepth = 'maxDepth' in optArgs ? optArgs.maxDepth : Infinity;
    /* number 以外は許されない */
    if (typeof maxDepth !== 'number')
        throw new TypeError('optArgs.maxDepth must be number');
    /* 負の深さは許されない */
    if (maxDepth < 0)
        throw new RangeError('optArgs.maxDepth must not be negative');

    /** @type { number | undefined } */
    const fetchTimeoutMs = optArgs?.fetchTimeoutMs;
    /* undefined でなければ number 以外は許されない */
    if (fetchTimeoutMs !== undefined && typeof fetchTimeoutMs !== 'number')
        throw new TypeError('optArgs.fetchTimeoutMs must be number or undefined');

    for (let depth = 0; queue.size > 0 && depth <= maxDepth; depth++) {
        /* いまあるリソースを同時に取得する */
        const current = [ ...queue.values() ];
        const options = {
            cache: optArgs?.cache || 'default',
            mode: optArgs?.mode || 'cors',
            timeoutMs: fetchTimeoutMs,
        };
        const results = await Promise.allSettled(
            current.map(
                e => fetchWithTimeout(e.url, options)
                        .then(res => {
                            if (!res.ok)
                                throw new Error(
                                    `Server responded with code ${res.status}`,
                                );
                            return res.json();
                        })
                        .catch(err => {
                            /*
                             * 全てのエラーはここで整形される
                             * .message は原因になった mantela の URL
                             * .cause は実際のエラーを示している
                             */
                            const u = e.url instanceof Request ? e.url.url : String(e.url);
                            const r = e.rev instanceof Request ? e.rev.url : String(e.rev);
                            throw new Error(
                                `${u} (referenced by ${r})`,
                                { cause: err }
                            );
                        })
            )
        );
        queue.clear();

        /* Mantela を登録する */
        results.forEach((e, i) => {
            /* 失敗していたらとりあえず console.error に報告して何もしない */
            if (e.status === 'rejected') {
                console.error(e.reason);
                errors.push(e.reason);
                return;
            }

            /* 自分の識別子を持っていないような Mantela は相手にしない */
            if (!e.value?.aboutMe?.identifier)
                return;

            /* Mantela を登録し、訪問済みに追加 */
            mantelas.set(e.value.aboutMe.identifier, {
                mantela: e.value,
                depth: depth,
            });
            visited.add(current[i]);
            visited.add(e.value.aboutMe.identifier);
        });

        /* 次に取得する Mantela を収集する */
        results.forEach((e, i) => {
            /* 接続済の交換局についての情報を持っていないなら何もしない */
            if (!e.value?.providers)
                return;

            const c = current[i];
            const rev = c.url instanceof Request ? c.url.url : String(c.url);
            e.value.providers.forEach(e => {
                if (e?.mantela && !visited.has(e.mantela)
                        && e?.identifier && !visited.has(e.identifier))
                    queue.add({ url: e.mantela, rev });
            });
        });
    }

    return { mantelas, errors };
}

/**
 * Mantela を芋蔓式に取得する（非推奨; c.f.: fetchMantelas3）
 * @param { string | URL | Request } firstMantela - 起点となる Mantela
 * @param { number } [maxDepth = Infinity] - Mantela を辿る最大深さ
 */
async function
fetchMantelas2(firstMantela, maxDepth = Infinity)
{
    const { mantelas } = await fetchMantelas3(firstMantela, {
        maxDepth: maxDepth,
    });
    return mantelas;
}

/**
 * Mantela を芋蔓式に取得する（非推奨; c.f.: fetchMantelas2）
 * @param { string | URL | Request } firstMantela - 起点となる Mantela
 * @param { number } [maxNest = Infinity] - Mantela を辿る最大深さ
 */
async function
fetchMantelas(firstMantela, maxNest = Infinity)
{
    const convert = m => m.entries().map(e => [ e[0], e[1].mantela ]);
    return new Map(await fetchMantelas2(firstMantela, maxNest).then(convert));
}

/**
 * fetch にタイムアウト機能を追加する
 * @param { string | URL | Request } resource - fetch するリソース
 * @param { FetchWithTimeoutOptions & RequestInit } [options = { }] - 追加の引数
 * @typedef { object } FetchWithTimeoutOptions
 * @property { number } [timeoutMs] - Mantela の取得に費やす最大時間（ミリ秒）
 */
function
fetchWithTimeout(resource, options = { })
{
    if (options?.timeoutMs === undefined)
        return fetch(resource, options);

    if (typeof options.timeoutMs !== 'number')
        throw new TypeError('options.timeoutMs must be a number or undefined');

    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = options.timeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(resource, { ...options, signal })
            .finally(() => clearTimeout(timeoutId));
}

/* ex: se et ts=4 : */
