async function store(listCache) {
    await browser.storage.local.set({listCache: listCache});
}

async function getList () {
    let data = await browser.storage.local.get("listCache");
    return data.listCache || [];
}

async function storeList(list) {
  await store(list);
}

export {getList, storeList};
