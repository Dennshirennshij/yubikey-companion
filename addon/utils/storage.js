async function getCodes() {
    let data = await browser.storage.local.get("codes");
    return data.codes || [];
}

async function store(codes, listCache) {
    await browser.storage.local.set({codes: codes, listCache: listCache});
}

async function getList () {
    let data = await browser.storage.local.get("listCache");
    return data.listCache || [];
}

async function storeCodes(codes) {
    await store(codes, await getList());
}

async function storeList(list) {
  await store(await getCodes(), list);
}

export {getCodes, storeCodes, getList, storeList};
