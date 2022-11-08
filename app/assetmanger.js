import { TextureLoader } from "three";
const textureloader = new TextureLoader();
function getLoadedCount(assets) {
    let count = 0;
    for (const i in assets) {
        if (assets[i].loading !== true) {
            count++;
        }
    }
    return count;
}
function allAssetsLoaded(assets) {
    for (const i in assets) {
        if (assets[i].loading === true) {
            return false;
        }
    }
    return true;
}
export function loadAssets(basePath, assets, onComplete, onProgress) {
    if (basePath && basePath[basePath.length - 1] != '/') {
        basePath += '/';
    }
    for (const i in assets) {
        const obj = assets[i];
        const assetPath = obj.url;
        obj.loading = true;
        textureloader.load(basePath + assetPath, asset => {
            obj.texture = asset;
            obj.loading = false;
            if (onProgress) {
                onProgress(getLoadedCount(assets));
            }
            if (onComplete && allAssetsLoaded(assets)) {
                onComplete();
            }
        }, () => {
            /* on progress */
        }, (e) => {
            console.error('Error loading asset', e);
        });
    }
}
//# sourceMappingURL=assetmanger.js.map