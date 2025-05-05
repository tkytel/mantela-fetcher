/*
 * フォーム送信時のイベントハンドラ
 * mantela.json を取得し、接続情報を解析し、表示する。
 */
formMantela.addEventListener('submit', async e => {
	e.preventDefault();
	btnGenerate.disabled = true;
	const start = performance.now();
	outputStatus.textContent = '';
	const mantelas = await (_ => checkNest.checked
		? fetchMantelas(urlMantela.value, +numNest.value)
		: fetchMantelas(urlMantela.value))();
	const stop = performance.now();
	outputStatus.textContent = `Done.  (${stop - start} ms)`;
	btnGenerate.disabled = false;

	const cloneList = outputList.cloneNode(false);
	outputList.parentNode.replaceChild(cloneList, outputList);
	mantelas.forEach((v, k) => {
		const dt = document.createElement('dt');
		dt.textContent = k;

		const json = JSON.stringify(v, null, 2);
		const summary = document.createElement('summary');
		summary.textContent = `JSON (${v.aboutMe.name})`;
		const pre = document.createElement('pre');
		pre.textContent = json;
		const details = document.createElement('details');
		details.append(summary, pre);
		const dd = document.createElement('dd');
		dd.append(details);

		cloneList.append(dt, dd);
	});
});
