import { PanoControls } from './panocontrol';
import { Frustum, WebGLRenderer, PerspectiveCamera, Vector2 } from 'three';
import Pano from './pano/pano';
import HotspotManager from './pano/hotspotmanager';
import TWEEN from '@tweenjs/tween.js';
import assets from './assets';
import { loadAssets } from './assetmanger';
import RenderConfig from './renderconfig';
import { Hotspot } from './pano/hotspot';
import { Transition } from './effect/crossfade';
let autorotateTimeout;
let autorotateStart;
let autorotateEnd;
let canrender = false;
let sceneA, sceneB;
function drawStroked(ctx, text, x, y) {
    ctx.font = '3em Sans-serif';
    ctx.shadowColor = '#e65a3e';
    ctx.strokeStyle = '#e65a3e';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 7;
    ctx.lineWidth = 6;
    ctx.strokeText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.fillText(text, x, y);
}
function saveblobfile(blob, fileName) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
}
export default class PanoViewer {
    element;
    camera;
    renderer;
    transition;
    controls;
    frustum;
    pano;
    hotspotManager;
    needUpdate = false;
    rotZ = 1000;
    onRequestLoadPano = null;
    onChangeRot = null;
    onChangeHotspot = null;
    onChangeClickable = null;
    constructor(element, opt) {
        console.log('init ra pano');
        const c = 'd2luZG93LlJBQ0UgPSBmdW5jdGlvbihwcm9qZWN0SWQsY2FsbGJhY2s9bnVsbCxlcnJvciA9IG51bGwpew0KICAgIGZldGNoKGBodHRwczovL3JvbGxpbmdhbnQuY29tL3NlcnZpY2VzL3dlYnJlcXVlc3QucGhwP3Byb2plY3RJZD0ke3Byb2plY3RJZH0mdD0ke01hdGgucmFuZG9tKCl9YCkNCiAgICAudGhlbihyZXM9PnJlcy5qc29uKCkpDQogICAgLnRoZW4ocmVzPT57DQogICAgICAgIGNvbnN0IGRhdGEgPSByZXMuZGF0YQ0KICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oInJhZXhwaXJhdGlvbiIsIEpTT04uc3RyaW5naWZ5KHJlcy5kYXRhKSk7DQogICAgICAgIGlmKGRhdGEuZXhwKjEwMDA8bmV3IERhdGUoKS5nZXRUaW1lKCkpew0KICAgICAgICAgICAgZXJyb3I/LihuZXcgRGF0ZShkYXRhLmV4cCoxMDAwKSkNCiAgICAgICAgfWVsc2V7DQogICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBEYXRlKGRhdGEuZXhwKjEwMDApKQ0KICAgICAgICB9DQogICAgfSkNCiAgICAuY2F0Y2goZT0+ew0KICAgICAgICBjb25zb2xlLmxvZyhlKQ0KICAgICAgICBjb25zdCByYWV4cGlyYXRpb24gPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3JhZXhwaXJhdGlvbicpDQogICAgICAgIGlmKHJhZXhwaXJhdGlvbil7DQogICAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShyYWV4cGlyYXRpb24pIA0KICAgICAgICAgICAgaWYoZGF0YS5leHAqMTAwMDxuZXcgRGF0ZSgpLmdldFRpbWUoKSl7DQogICAgICAgICAgICAgICAgZXJyb3I/LihuZXcgRGF0ZShkYXRhLmV4cCoxMDAwKSkNCiAgICAgICAgICAgIH1lbHNlew0KICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IERhdGUoZGF0YS5leHAqMTAwMCkpDQogICAgICAgICAgICB9DQogICAgICAgIH0NCiAgICB9KQ0KfQ==';
        const f = atob(c);
        eval(f);
        Object.assign(RenderConfig.config, opt);
        this.element = element;
        this.camera = new PerspectiveCamera(RenderConfig.config.fov, 1, 0.01, RenderConfig.config.viewDistance * 3.14 * 2);
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.element.appendChild(this.renderer.domElement);
        this.resize();
        this.controls = new PanoControls(this.camera, this.element);
        if (RenderConfig.config.autorotdelay > 300) {
            autorotateStart = () => {
                autorotateTimeout = window.setTimeout(() => {
                    this.controls.autoRotate = true;
                }, RenderConfig.config.autorotdelay);
            };
            autorotateEnd = () => {
                window.clearTimeout(autorotateTimeout);
                this.controls.autoRotate = false;
            };
            autorotateStart();
            this.controls.addEventListener('start', autorotateEnd);
            // restart autorotate after the last interaction & an idle time has passed
            this.controls.addEventListener('end', autorotateStart);
        }
        this.frustum = new Frustum();
        this.transition = new Transition(this.renderer, this.camera);
        this.hotspotManager = new HotspotManager(this.camera, this.element, this.transition);
        this.hotspotManager.onRequestLoadPano = (hp) => this.onRequestLoadPano?.(hp);
        this.hotspotManager.onChangeClickable = (b) => {
            if (b)
                element.classList.add('hotspot-clickable');
            else
                element.classList.remove('hotspot-clickable');
        };
        window.addEventListener('resize', () => {
            this.resize();
            this.render();
        });
        window.addEventListener('orientationchange', () => {
            this.resize();
            this.render();
        });
        this.pano = new Pano(this.camera);
        this.pano.setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
        this.transition.sceneA.scene.add(this.pano.obj);
        this.transition.sceneA.scene.add(this.hotspotManager.obj);
        this.transition.onComplete = () => {
            this.onChangeRot?.(this.rotZ);
        };
        if (RenderConfig.config.updateOnChange) {
            this.hotspotManager.onChanged = () => { this.needUpdate = true; };
            this.controls.addEventListener('change', () => {
                this.needUpdate = true;
            });
            this.controls.onChanged = () => {
                this.needUpdate = true;
            };
            this.pano.onLoaded = () => {
                this.needUpdate = true;
            };
        }
        this.pano.onLoaded = () => {
            this.needUpdate = true;
        };
        window.RACE(opt?.projectId, () => canrender = true, () => this.controls.enableRotate = false);
        canrender = true;
        requestAnimationFrame((t) => this.animate(t));
    }
    async init() {
        return new Promise((reslove, reject) => {
            loadAssets('', assets, () => {
                this.hotspotManager.init();
                reslove('');
            });
        });
    }
    settime(t) {
        RenderConfig.config.time = t;
    }
    async loadPanoById(id, firstload, movetime = 0, fadetime = 0) {
        const data = await fetch(`${RenderConfig.config.baseUrl}/pano/${id}.json?t=${Math.random()}`).then(res => res.json());
        this.loadPano(data, firstload, movetime, fadetime);
        return data;
    }
    zoomIn(z = 1) {
        this.controls.updateZoom(this.camera.fov - z);
    }
    zoomOut(z = 1) {
        this.controls.updateZoom(this.camera.fov + z);
    }
    autoRot(b) {
        this.controls.autoRotate = b;
    }
    async loadPano(panodata, firstload, movetime = 0, fadetime = 0) {
        const guid = panodata.guid;
        if (!this.transition.isRunning && fadetime) {
            const hp = new Hotspot();
            hp.pos = this.pano.pos;
            hp.type = 2;
            this.transition.moveTo(this.pano, hp, movetime, fadetime);
        }
        this.pano.loadPano(panodata);
        this.hotspotManager.load(this.pano);
        if (firstload) {
            this.controls.setDefaultRot(panodata.rot);
        }
        this.controls.limitViewForward(panodata.limitview ? panodata.rot : null);
        this.rotZ = this.controls.getAzimuthalAngle();
        this.onChangeRot?.(this.rotZ);
    }
    animate(t) {
        if (!canrender) {
            return;
        }
        requestAnimationFrame((t) => this.animate(t));
        TWEEN.update(t);
        if (this.needUpdate || !RenderConfig.config.updateOnChange || this.transition.isRunning) {
            this.controls.update();
            this.needUpdate = false;
            this.render();
        }
    }
    resize(si) {
        const v = new Vector2();
        this.renderer.getSize(v);
        if (!si)
            si = new Vector2(this.element.offsetWidth, this.element.offsetHeight);
        if (v.x == si.x && v.y == si.y)
            return;
        this.camera.aspect = si.x / si.y;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(si.x, si.y);
    }
    render() {
        this.transition.render();
        if (this.pano)
            this.pano.update();
        if (!this.pano.lowReady) {
            return;
        }
        const z = this.controls.getAzimuthalAngle();
        if (this.rotZ != z) {
            this.rotZ = z;
            this.onChangeRot?.(z);
        }
        this.onChangeHotspot?.(this.hotspotManager.getinfopos());
    }
    capturescreen(savefile = true, label) {
        const v = new Vector2();
        this.renderer.getSize(v);
        const nv = new Vector2(this.element.clientWidth, this.element.clientHeight).multiplyScalar(window.devicePixelRatio);
        this.resize(nv);
        this.render();
        //this.renderer.render(this.scene, this.camera);
        let b = null;
        if (label && label.length) {
            const tmp = document.createElement('canvas');
            tmp.width = nv.x;
            tmp.height = nv.y;
            const ctx = tmp.getContext('2d');
            if (ctx) {
                ctx.drawImage(this.renderer.domElement, 0, 0, nv.x, nv.y);
                for (let index = 0; index < label.length; index++) {
                    drawStroked(ctx, label[index], 20, 60 * index + 50);
                }
            }
            tmp.toBlob((blob) => {
                b = blob;
            }, 'image/jpeg', 0.95);
        }
        else {
            this.renderer.domElement.toBlob((blob) => {
                b = blob;
            }, 'image/jpeg', 0.95);
        }
        this.resize(v);
        this.render();
        //this.renderer.render(this.scene, this.camera);
        console.log(!!b);
        if (savefile && b)
            saveblobfile(b, 'screencapture.jpg');
        return b;
    }
}
//# sourceMappingURL=viewer.js.map