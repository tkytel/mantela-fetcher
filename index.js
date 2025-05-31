/*
 * フォーム送信時のイベントハンドラ
 * mantela.json を取得し、接続情報を解析し、表示する。
 */
formMantela.addEventListener('submit', async e => {
	e.preventDefault();
	btnGenerate.disabled = true;
	const start = performance.now();
	outputStatus.textContent = '';
	const { mantelas, errors } = await (_ => checkNest.checked
		? fetchMantelas3(urlMantela.value, {
			maxDepth: +numNest.value,
		})
		: fetchMantelas3(urlMantela.value))();
	const stop = performance.now();
	outputStatus.textContent = `Done.  (${stop - start} ms)`;
	btnGenerate.disabled = false;

	const cloneList = outputList.cloneNode(false);
	outputList.parentNode.replaceChild(cloneList, outputList);
	mantelas.forEach((v, k) => {
		const dt = document.createElement('dt');
		dt.textContent = k;

		const json = JSON.stringify(v.mantela, null, 2);
		const summary = document.createElement('summary');
		summary.textContent = `JSON (${v.mantela.aboutMe.name})`;
		const pre = document.createElement('pre');
		pre.textContent = json;
		const details = document.createElement('details');
		details.append(summary, pre);
		const dd = document.createElement('dd');
		dd.append(details);

		cloneList.append(dt, dd);
	});
	const cloneError = outputError.cloneNode(false);
	outputError.parentNode.replaceChild(cloneError, outputError);
	errors.forEach(e => {
		const dt = document.createElement('dt');
		dt.textContent = e.message;

		const ddNameMesg = document.createElement('dd');
		ddNameMesg.textContent = {
			TypeError: /* may be thrown by fetch() */
				'Mantela.json の取得に失敗した可能性があります'
				+ '（CORS の設定や HTTP ヘッダを確認してみてください）',
			Error: /* may be thrown if status code is not OK */
				'Mantela.json の取得に失敗した可能性があります'
				+ '（正しい URL であるか確認してみてください）',
			SyntaxError: /* may be thrown by res.json() */
				'Mantela.json の解釈に失敗した可能性があります'
				+ '（書式に問題がないか確認してみてください）',
			AbortError: /* may be thrown by AbortController */
				'Mantela.json の取得がタイムアウトしました'
				+ '（URL が正しいか、ネットワークの状態を確認してみてください）',
		}[e.cause.name] || '不明なエラーです';

		const ddCause = document.createElement('dd');
		ddCause.textContent = String(e.cause);

		cloneError.append(dt, ddNameMesg, ddCause);
	});
	summaryError.textContent = `エラー情報（${errors.length} 件）`;
});
