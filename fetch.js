'use strict';

/**
 * Mantela を芋蔓式に取得する
 * @param { string | URL | Request } firstMantela - 起点となる Mantela
 * @param { object } [optArgs = { }] - 追加の引数
 */
async function
fetchMantelas3(firstMantela, optArgs = { })
{
    /** @type { Map<string, { mantela: Mantela }> } */
    const mantelas = new Map();

    /** @type { Set<string | URL | Request> } */
    const queue = new Set([ firstMantela ]);

    /** @type { Set<string | URL | Request> } */
    const visited = new Set();

    /** @type { Error[] } */
    const errors = [ ];

    /** @type { number } */
    const maxDepth = optArgs?.maxDepth || Infinity;

    /** @type { number } */
    const timeoutMs = optArgs?.timeoutMs;

    /* 負の深さは許されない */
    if (maxDepth < 0)
        throw new RangeError('maxNest must not be negative.');

    for (let depth = 0; queue.size > 0 && depth <= maxDepth; depth++) {
        /* いまあるリソースを同時に取得する */
        const current = [ ...queue.values() ];
        const results = await Promise.allSettled(
            current.map(
                e => fetchWithTimeout(e, { mode: 'cors', timeoutMs: timeoutMs })
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
                            throw new Error(
                                e instanceof Request ? e.url : String(e),
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

            e.value.providers.forEach(e => {
                if (e?.mantela && !visited.has(e.mantela)
                        && e?.identifier && !visited.has(e.identifier))
                    queue.add(e.mantela);
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
 * @param { object } [options = { }] - 追加の引数
 */
function
fetchWithTimeout(resource, options = { })
{
    if (options.timeoutMs == undefined && typeof options.timeoutMs !== 'number')
        return fetch(resource, { ...options});

    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = options.timeoutMs;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(resource, { ...options, signal })
            .finally(() => clearTimeout(timeoutId));
}

/* ex: se et ts=4 : */
