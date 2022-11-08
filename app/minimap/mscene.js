import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import DBHelper from "../dphelper";
import MiniMapItem from "./mitem";
import MiniMapLayer from "./mlayer";
import MiniMapPoint from "./mpoint";
import Rect from "./mrect";
import MRenderConfig from "./mrenderconfig";
// import localforage from 'localforage'
let ctx;
let cameraImage;
const cameraTransform = { x: 10, y: 10, width: 60, height: 60, r: 45 };
let canvas;
let zoom = 1;
const pivot = { x: 0, y: 0 };
const oldpivot = { x: 0, y: 0 };
const MOUSE_MODE = {
    Left: 0,
    Mid: 1,
    Right: 2
};
let mousemode = MOUSE_MODE.Left;
let el;
let bgimg;
const selectedArea = new Rect();
const matrix = new Matrix4();
const gpsMatrix = new Matrix4();
let invertmatrix = new Matrix4();
let invertquat = new Quaternion();
const quat = new Quaternion();
let tmptime = 0;
let data = null;
let mapwidth = 1024;
let mapheight = 512;
let pointermoveevent;
let pointerupevent;
const campos = new Vector3();
let camrot = 0;
let ready = false;
export default class MiniMapScene extends MiniMapItem {
    onloaded = null;
    onclick = null;
    onchangeselect = null;
    // db = localforage.createInstance({name:'minimap'})
    db = new DBHelper();
    pos = new Vector3();
    rot = new Vector3();
    scale = new Vector3(1);
    gps = new Vector3();
    map = {
        path: ''
    };
    constructor(element, opt) {
        super();
        el = element;
        Object.assign(MRenderConfig.config, opt);
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        el.appendChild(canvas);
        el.addEventListener('pointerdown', (e) => { this.onPointerDown(e); });
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('wheel', (e) => this.onPointerWheel(e));
        pointermoveevent = (e) => this.onPointerMove(e);
        pointerupevent = (e) => this.onPointerUp(e);
        // this.load()
    }
    load(scenename = '0') {
        ready = false;
        this.children = [];
        let furl = `${MRenderConfig.config.baseUrl}/scene/${scenename}`;
        if (MRenderConfig.config.runtime) {
            furl = `${MRenderConfig.config.baseUrl}/scene/${scenename}.json?t=${Math.random()}`;
        }
        fetch(furl)
            .then(res => res.json())
            .then(res => {
            if (MRenderConfig.config.runtime)
                this.loaddata(res);
            else
                this.loaddata(res.data);
        })
            .catch(console.log);
    }
    loaddata(indata) {
        data = indata;
        this.pos = new Vector3(data.pos.x, data.pos.y, data.pos.z);
        this.rot = new Vector3(data.pos.x, data.pos.y, data.pos.z);
        quat.setFromEuler(new Euler(data.rot.x * Math.PI / 180, data.rot.y * Math.PI / 180, data.rot.z * Math.PI / 180));
        invertquat = quat.clone().invert();
        this.scale = new Vector3(data.scale.x, data.scale.y, data.scale.z);
        matrix.compose(this.pos, quat, this.scale);
        invertmatrix = matrix.clone().invert();
        if (data.gps) {
            gpsMatrix.compose(new Vector3((data.gps.east + data.gps.west) / 2, (data.gps.north + data.gps.south) / 2, 0), new Quaternion().setFromEuler(new Euler(0, 0, data.gps.rotation * Math.PI / 180)), new Vector3(data.gps.east - data.gps.west, data.gps.north - data.gps.south, 1));
        }
        this.pos = data.pos;
        this.rot = data.rot;
        this.scale = data.scale;
        this.gps = data.gps;
        this.map.path = data.map.path;
        const ratio = (data.scale.x / data.scale.y);
        if (ratio * el.clientHeight < el.clientWidth) {
            canvas.width = el.clientHeight * ratio;
            canvas.height = el.clientHeight;
        }
        else {
            canvas.width = el.clientWidth;
            canvas.height = el.clientWidth / ratio;
        }
        if (MRenderConfig.config.runtime) {
            const layer = new MiniMapLayer();
            for (const item of data.points) {
                const p = new MiniMapPoint(item);
                layer.children.push(p);
            }
            this.children.push(layer);
        }
        else {
            for (const item of data.children) {
                const layer = new MiniMapLayer(item);
                this.children.push(layer);
            }
        }
        bgimg = new Image();
        bgimg.onload = () => this.init();
        //cheat old path
        if (!data.map.path.startsWith('/')) {
            data.map.path = '/' + data.map.path;
        }
        //cheat old path
        bgimg.src = `${MRenderConfig.config.baseUrl}${data.map.path}`;
        this.db.findpoint(null, 1000).then((ls) => {
            this.traverse(item => {
                if (item instanceof MiniMapPoint) {
                    const p = item;
                    const rp = ls.find(x => x.name == p.name);
                    if (rp && (rp.guid == p.guid || rp.color == 1)) {
                        p.colorid = rp.color;
                    }
                }
            });
            this.render();
        });
    }
    savepoint(item) {
        this.db.savepoint(item);
        this.traverse(c => {
            if (c instanceof MiniMapPoint && c.name == item.name) {
                c.colorid = item.color;
            }
        });
    }
    onPointerWheel(e) {
        if (MRenderConfig.config.canZoom) {
            const v = this.getMousePos(e.offsetX, e.offsetY);
            zoom = Math.round((zoom + e.deltaY / 1000) * 100) / 100;
            pivot.x = e.offsetX - v.x / zoom;
            pivot.y = e.offsetY - v.y / zoom;
            this.render();
        }
    }
    onPointerDown(e) {
        e.preventDefault();
        mousemode = e.button;
        el.addEventListener('pointermove', pointermoveevent);
        el.addEventListener('pointerup', pointerupevent);
        selectedArea.x = e.offsetX;
        selectedArea.y = e.offsetY;
        oldpivot.x = this.getMousePos(e.offsetX, e.offsetY).x;
        oldpivot.y = this.getMousePos(e.offsetX, e.offsetY).y;
        tmptime = new Date().getTime();
    }
    onPointerMove(e) {
        e.preventDefault();
        if (mousemode == MOUSE_MODE.Left) {
            if (MRenderConfig.config.canSelect) {
                selectedArea.width = e.offsetX - selectedArea.x;
                selectedArea.height = e.offsetY - selectedArea.y;
            }
        }
        else {
            if (MRenderConfig.config.canPan) {
                pivot.x = e.offsetX - oldpivot.x / zoom;
                pivot.y = e.offsetY - oldpivot.y / zoom;
            }
        }
        this.render();
    }
    clearSelect() {
        this.traverse(item => {
            item.select = false;
        });
    }
    addSelect(ls) {
        for (const item of ls) {
            item.select = true;
        }
    }
    removeSelect(ls) {
        for (const item of ls) {
            item.select = false;
        }
    }
    onPointerUp(e) {
        e.preventDefault();
        el.removeEventListener('pointermove', pointermoveevent);
        el.removeEventListener('pointerup', pointerupevent);
        if (mousemode == MOUSE_MODE.Left && MRenderConfig.config.canSelect) {
            const ls = [];
            this.traverse(item => {
                if (item instanceof MiniMapPoint) {
                    const p = item;
                    if (p.isInRect(selectedArea))
                        ls.push(p);
                }
            });
            if (e.ctrlKey || e.shiftKey) {
                this.addSelect(ls);
            }
            else if (e.altKey) {
                this.removeSelect(ls);
            }
            else {
                this.clearSelect();
                this.addSelect(ls);
            }
            const lres = [];
            this.traverse(item => {
                if (item instanceof MiniMapPoint) {
                    if (item.select)
                        lres.push(item);
                }
            });
            this.onchangeselect?.(lres);
        }
        //check click
        if (mousemode == MOUSE_MODE.Left && new Date().getTime() - tmptime < 500) {
            selectedArea.width = e.offsetX - selectedArea.x;
            selectedArea.height = e.offsetY - selectedArea.y;
            if (selectedArea.width < 10 && selectedArea.height < 10) {
                let l = 1000000;
                let nearest = null;
                this.traverse(item => {
                    if (item instanceof MiniMapPoint) {
                        const distance = (item.pos2d.x - selectedArea.x) * (item.pos2d.x - selectedArea.x) + (item.pos2d.y - selectedArea.y) * (item.pos2d.y - selectedArea.y);
                        if (distance < l) {
                            l = distance;
                            nearest = item;
                        }
                    }
                });
                if (nearest) {
                    this.onclick?.(nearest);
                }
            }
        }
        //reset selectedArea
        selectedArea.width = 0;
        selectedArea.height = 0;
        this.render();
    }
    selectItem(obj) {
        this.clearSelect();
        if (obj instanceof MiniMapPoint) {
            obj.select = true;
        }
        else {
            obj.traverse(item => {
                if (item instanceof MiniMapPoint) {
                    const p = item;
                    p.select = true;
                }
            });
        }
        this.render();
    }
    setSelected(ls) {
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                item.select = ls.includes(item.name);
            }
        });
        this.render();
    }
    lockItem(obj, isLock) {
        obj.lock = isLock;
        obj.traverse(item => {
            item.lock = isLock;
        }, true);
        this.render();
    }
    seletecHalf(skip) {
        let b = 0;
        this.traverse(item => {
            if (item.select) {
                item.select = b == 0;
                b = (b + 1) % skip;
            }
        });
        this.render();
    }
    seletecInvert() {
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                item.select = !item.select;
            }
        });
        this.render();
    }
    hideSelect() {
        this.traverse(item => {
            if (item instanceof MiniMapPoint && item.select) {
                item.visible = false;
            }
        });
        this.render();
    }
    unhideAll() {
        this.traverse(item => item.visible = true, true);
        this.render();
    }
    lockSelect() {
        this.traverse(item => {
            if (item instanceof MiniMapPoint && item.select) {
                item.lock = true;
            }
        });
        this.render();
    }
    unlockAll() {
        this.traverse(item => item.lock = false, true);
        this.render();
    }
    setSelectProfile(profile) {
        this.traverse(item => {
            if (item instanceof MiniMapPoint && item.select) {
                item.profile = profile;
            }
        });
    }
    getSelectValue() {
        const all = [];
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                const p = item;
                if (p.select)
                    all.push(p);
            }
        });
        const p = new MiniMapPoint(all[0]);
        for (const item of all) {
            for (const key in p) {
                if (typeof p[key] == 'string' && p[key] != item[key])
                    p[key] = '-';
                if (typeof p[key] == 'number' && p[key] != item[key])
                    p[key] = '-';
            }
        }
        return p;
    }
    distanceTo(v1, v2) {
        return Math.sqrt((v2.x - v1.x) * (v2.x - v1.x) + (v2.y - v1.y) * (v2.y - v1.y) + (v2.z - v1.z) * (v2.z - v1.z));
    }
    showlink(isshow) {
        MRenderConfig.config.link = isshow;
        this.render();
    }
    link(distance) {
        const all = [];
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                const p = item;
                if (p.select)
                    all.push(p);
            }
        });
        for (const p of all) {
            const ls = all.filter(x => x.name != p.name && this.distanceTo(x.pos, p.pos) < distance).map(x => ({ name: x.name, pos: x.pos, pos2d: x.pos2d, type: 1 }));
            for (const item of ls) {
                if (!p.links.find(x => x.name == item.name))
                    p.links.push(item);
            }
        }
        this.render();
    }
    unlink() {
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                const p = item;
                if (p.select)
                    p.links = [];
            }
        });
        this.render();
    }
    async save(sname = 'scene') {
        const blob = new Blob([JSON.stringify(this)], { type: 'text/plain' });
        const formdata = new FormData();
        formdata.append('file', blob, `${sname}.scene`);
        let msg = '';
        await fetch(`${MRenderConfig.config.baseUrl}/save`, { method: 'post', body: formdata }).then(res => res.json()).then(res => msg = res.msg).catch(console.log);
        return msg;
    }
    async build(sname = '0') {
        const blob = new Blob([JSON.stringify(this)], { type: 'text/plain' });
        const formdata = new FormData();
        formdata.append('file', blob, `${sname}.json`);
        let msg = '';
        await fetch(`${MRenderConfig.config.baseUrl}/build`, { method: 'post', body: formdata }).then(res => res.json()).then(res => msg = res.msg).catch(console.log);
        return msg;
    }
    async export(onlySelect) {
        const exportdata = {
            reject: {
                data: []
            }
        };
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                if (onlySelect && !item.select)
                    return;
                const p = {
                    id: item.id,
                    guid: item.guid,
                    name: item.name,
                    fullname: item.fullname,
                    profile: item.profile,
                    pos: item.pos,
                    rot: item.rot,
                    quality: item.quality,
                    panotype: item.panotype,
                    links: item.links.map(x => ({ name: x.name, pos: x.pos, type: x.type }))
                };
                exportdata.reject.data.push(p);
            }
        });
        const blob = new Blob([JSON.stringify(exportdata, null, 2)], { type: 'text/plain' });
        const formdata = new FormData();
        formdata.append('file', blob, 'requestcapture.json');
        let msg = 'requestcapture.json : ';
        await fetch(`${MRenderConfig.config.baseUrl}/export`, { method: 'post', body: formdata }).then(res => res.json()).then(res => msg += res.msg).catch(console.log);
        return msg;
    }
    get2DPos(pos) {
        const v = new Vector3(pos.x, pos.y, pos.z);
        v.applyMatrix4(invertmatrix);
        return {
            x: MathUtils.clamp(Math.round(v.x * mapwidth + mapwidth / 2), 0.02 * mapwidth, mapwidth * 0.98),
            y: MathUtils.clamp(Math.round(v.y * mapheight + mapheight / 2), 0.02 * mapheight, mapheight * 0.98),
        };
    }
    getDisplay2DPos(pos) {
        const v = this.get2DPos(pos);
        v.x = (v.x / zoom) + pivot.x;
        v.y = (v.y / zoom) + pivot.y;
        return v;
    }
    get2DRot(rotZ) {
        return -rotZ - (cameraTransform.r - this.rot.z) / 180 * Math.PI;
    }
    init() {
        this.genCam();
        mapwidth = bgimg.width;
        mapheight = bgimg.width / canvas.width * canvas.height;
        zoom = mapwidth / canvas.width;
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                item.pos2d = this.getDisplay2DPos(item.pos);
            }
        });
        ready = true;
        this.updateCam(campos, camrot);
        this.render();
        this.onloaded?.();
    }
    resetTransform() {
        zoom = mapwidth / canvas.width;
        pivot.x = 0;
        pivot.y = 0;
        this.render();
    }
    getMousePos(x, y) {
        return new Vector3((x - pivot.x) * zoom, (y - pivot.y) * zoom, 0);
    }
    render() {
        if (!bgimg) {
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bgimg, 0, 0, mapwidth, mapheight, pivot.x, pivot.y, mapwidth / zoom, mapheight / zoom);
        this.traverse(item => {
            if (item instanceof MiniMapPoint) {
                item.pos2d = this.getDisplay2DPos(item.pos);
                for (const l of item.links) {
                    l.pos2d = this.getDisplay2DPos(l.pos);
                }
            }
        });
        for (const item of this.children) {
            item.render(ctx);
        }
        if (selectedArea.width != 0 && selectedArea.height != 0) {
            ctx.fillStyle = '#ff000033';
            ctx.strokeStyle = '#ff000088';
            ctx.strokeRect(selectedArea.x, selectedArea.y, selectedArea.width, selectedArea.height);
            ctx.fillRect(selectedArea.x, selectedArea.y, selectedArea.width, selectedArea.height);
        }
        this.drawCamera();
    }
    updateCam(pos, rot) {
        if (!ready) {
            campos.x = pos.x;
            campos.y = pos.y;
            camrot = rot;
        }
        else {
            const v = this.getDisplay2DPos(new Vector3(pos.x, pos.y, 0));
            campos.x = v.x;
            campos.y = v.y;
            camrot = this.get2DRot(rot);
            this.render();
        }
    }
    drawCamera() {
        if (!cameraImage) {
            return;
        }
        ctx.translate(campos.x, campos.y);
        ctx.rotate(camrot);
        ctx.drawImage(cameraImage, -cameraTransform.x / zoom, -cameraTransform.y / zoom, cameraTransform.width / zoom, cameraTransform.height / zoom);
        ctx.rotate(-camrot);
        ctx.translate(-campos.x, -campos.y);
    }
    genCam() {
        cameraImage = document.createElement('canvas');
        if (MRenderConfig.config.camera) {
            Object.assign(cameraTransform, MRenderConfig.config.camera.transform);
            const img = new Image();
            img.src = MRenderConfig.config.camera.path;
            img.onload = () => {
                cameraImage.width = cameraTransform.width;
                cameraImage.height = cameraTransform.width;
                const camctx = cameraImage.getContext('2d');
                camctx.drawImage(img, 0, 0, cameraImage.width, cameraImage.height);
                this.render();
            };
        }
    }
}
//# sourceMappingURL=mscene.js.map