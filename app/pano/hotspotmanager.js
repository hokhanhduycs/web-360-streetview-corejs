import { Euler, Frustum, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Raycaster, Sprite, SpriteMaterial, Vector2, Vector3 } from "three";
import assets from "../assets";
import RenderConfig from "../renderconfig";
import { Hotspot, HotspotType } from "./hotspot";
let ground;
let air;
let info;
let virtual;
let cursor;
let control;
let terrain;
let currPano;
const MOUSE_MODE = {
    Left: 0,
    Mid: 1,
    Right: 2
};
let mousemode = MOUSE_MODE.Left;
const mousepos = new Vector2();
const downpos = new Vector2();
const raycaster = new Raycaster();
let lastclick = 0;
let el;
let camera;
const links = [];
let pointerdownevent;
let pointerupevent;
let pointermoveevent;
const frustum = new Frustum();
let clickabletarget = null;
export default class HotspotManager {
    obj;
    transition;
    onChanged = null;
    onRequestLoadPano = null;
    onChangeClickable = null;
    onRighClick = null;
    constructor(cam, domElement, transition) {
        this.transition = transition;
        pointerdownevent = (e) => this.onPointerDown(e);
        pointerupevent = (e) => this.onPointerUp(e);
        pointermoveevent = (e) => this.onPointerMove(e);
        el = domElement;
        camera = cam;
        el.addEventListener('pointerdown', pointerdownevent);
        el.addEventListener('pointermove', pointermoveevent);
        el.addEventListener('pointerup', pointerupevent);
        this.obj = new Group();
    }
    onPointerDown(e) {
        e.preventDefault();
        mousemode = e.button;
        mousepos.x = (e.offsetX / el.offsetWidth) * 2 - 1;
        mousepos.y = -(e.offsetY / el.offsetHeight) * 2 + 1;
        downpos.copy(mousepos);
        lastclick = Date.now();
    }
    onPointerUp(e) {
        e.preventDefault();
        mousepos.x = (e.offsetX / el.offsetWidth) * 2 - 1;
        mousepos.y = -(e.offsetY / el.offsetHeight) * 2 + 1;
        if (Date.now() - lastclick < 300 && mousepos.distanceTo(downpos) < 0.1 * 720 / Math.min(el.clientWidth, el.clientHeight)) {
            this.onClick();
        }
    }
    onClick() {
        if (this.transition.transitionParams.transition != 1)
            return;
        if (mousemode == MOUSE_MODE.Left) {
            const ls = this.navRaycast().concat(this.hotspotRaycast()).concat(this.groudRaycast());
            if (ls.length) {
                const hp = links.find(x => x.obj == ls[0].object);
                if (hp) {
                    if (hp.type == 1)
                        this.transition.moveTo(currPano, hp);
                    control.visible = false;
                    this.onRequestLoadPano?.(hp);
                }
            }
        }
        else if (mousemode == MOUSE_MODE.Right) {
            const p = this.airRaycast();
            this.onRighClick?.(p);
        }
    }
    onPointerMove(e) {
        e.preventDefault();
        mousepos.x = (e.offsetX / el.offsetWidth) * 2 - 1;
        mousepos.y = -(e.offsetY / el.offsetHeight) * 2 + 1;
        this.update();
    }
    dispose() {
        el.removeEventListener('pointerdown', pointerdownevent);
        el.removeEventListener('pointermove', pointermoveevent);
        el.removeEventListener('pointerup', pointerupevent);
    }
    init() {
        const matground = new MeshBasicMaterial({ transparent: true, map: assets.hotspot.texture, opacity: RenderConfig.config.showHotspot ? 1 : 0 });
        const geometry = new PlaneGeometry(0.4, 0.4, 1, 1);
        ground = new Mesh(geometry, matground);
        ground.rotation.set(-Math.PI / 2, 0, 0);
        const matcursor = new MeshBasicMaterial({ transparent: true, map: assets.cursor.texture });
        cursor = new Mesh(geometry, matcursor);
        cursor.rotation.set(-Math.PI / 2, 0, 0);
        cursor.renderOrder = 1;
        this.obj.add(cursor);
        cursor.visible = false;
        const airmat = new SpriteMaterial({ map: assets.airhotspot.texture });
        air = new Sprite(airmat);
        air.scale.set(0.6, 0.6, 0.6);
        const infomat = new SpriteMaterial({ map: assets.infohotspot.texture });
        info = new Sprite(infomat);
        info.scale.set(0.6, 0.6, 0.6);
        const virtualmat = new SpriteMaterial({ map: assets.virtualhotspot.texture });
        virtual = new Sprite(virtualmat);
        virtual.scale.set(0.6, 0.6, 0.6);
        //add control arrow
        control = new Group();
        const controlmat = new MeshBasicMaterial({ transparent: true, map: assets.control.texture });
        const controlshadowmat = new MeshBasicMaterial({ transparent: true, color: "#808080", map: assets.control.texture });
        const controlgeometry = new PlaneGeometry(1, 0.4, 1, 1);
        const arrow = new Mesh(controlgeometry, controlmat);
        const arrowshadow = new Mesh(controlgeometry, controlshadowmat);
        arrowshadow.position.set(0, 0, -0.05);
        arrow.add(arrowshadow);
        //back forward
        let obj = arrow.clone();
        obj.position.set(0, 1, 0);
        obj.name = 'forward';
        control.add(obj);
        //left arrow
        obj = arrow.clone();
        obj.name = 'left';
        obj.position.set(-1, 0, 0);
        obj.rotation.set(0, 0, Math.PI / 2);
        control.add(obj);
        //right arrow
        obj = arrow.clone();
        obj.name = 'right';
        obj.position.set(1, 0, 0);
        obj.rotation.set(0, 0, -Math.PI / 2);
        control.add(obj);
        //back arrow
        obj = arrow.clone();
        obj.name = 'back';
        obj.position.set(0, -1, 0);
        obj.rotation.set(0, 0, Math.PI);
        control.add(obj);
        control.rotation.set(-Math.PI / 2, 0, 0);
        control.scale.set(0.2, 0.2, 0.2);
        this.obj.add(control);
        control.visible = false;
        const terraingeometry = new PlaneGeometry(RenderConfig.config.viewDistance * 5, RenderConfig.config.viewDistance * 5, 1, 1);
        const matterrain = new MeshBasicMaterial({ transparent: true, opacity: 0 });
        terrain = new Mesh(terraingeometry, matterrain);
        terrain.position.set(0, -RenderConfig.config.camHeight, 0);
        terrain.rotation.set(-Math.PI / 2, 0, 0);
        this.obj.add(terrain);
    }
    hotspotRaycast() {
        raycaster.setFromCamera(mousepos, camera);
        const intersects = raycaster.intersectObjects(links.filter(x => x.obj).map(x => x.obj), true);
        if (intersects.length) {
            return intersects;
        }
        return [];
    }
    navRaycast() {
        raycaster.setFromCamera(mousepos, camera);
        const intersects = raycaster.intersectObjects(control.children, true);
        if (intersects.length) {
            intersects[0].object = intersects[0].object.userData.target;
            return intersects;
        }
        return [];
    }
    airRaycast() {
        raycaster.setFromCamera(mousepos, camera);
        return raycaster.ray.direction;
    }
    groudRaycast() {
        raycaster.setFromCamera(mousepos, camera);
        const intersects = raycaster.intersectObjects([terrain]);
        if (intersects.length) {
            const obj = this.findNearest(intersects[0].point);
            if (obj) {
                intersects[0].object = obj;
                return intersects;
            }
        }
        return [];
    }
    findNearest(pos) {
        let distance = RenderConfig.config.linkDistance;
        let target = null;
        frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        for (const hp of links.filter(x => x.obj && x.type == HotspotType.ground && frustum.intersectsObject(x.obj)).map(x => x.obj)) {
            const d = pos.distanceTo(hp.position);
            if (d < distance) {
                distance = d;
                target = hp;
            }
        }
        return target;
    }
    findNearestForward() {
        const q = new Quaternion();
        let target = null;
        camera.getWorldQuaternion(q);
        const dir = new Vector3(0, 0, 1);
        dir.applyQuaternion(q);
        dir.y = 0;
        dir.normalize().negate();
        let distance = RenderConfig.config.linkDistance;
        for (const hp of links.filter(x => x.obj && x.type == HotspotType.ground).map(x => x.obj)) {
            const pos = hp.position.clone();
            pos.y = 0;
            const l = pos.length();
            pos.normalize();
            pos.projectOnVector(dir);
            if (pos.length() * Math.sign(pos.dot(dir)) > 0.8 && l < distance) {
                target = hp;
                distance = l;
            }
        }
        return target;
    }
    load(pano) {
        if (currPano) {
            for (const item of links) {
                if (item.obj) {
                    item.obj.parent?.remove(item.obj);
                }
            }
        }
        links.length = 0;
        //
        currPano = pano;
        for (const item of pano.links) {
            this.addHotspot(item);
        }
    }
    addHotspot(data) {
        const hp = new Hotspot(data);
        links.push(hp);
        const pos = new Vector3().copy(hp.pos).sub(currPano.pos);
        if (hp.type == HotspotType.ground) {
            hp.obj = ground.clone();
            pos.sub(new Vector3(0, 0, RenderConfig.config.camHeight));
            //fix z positive
            if (pos.z > 0)
                pos.set(pos.x, pos.y, -pos.z);
            pos.multiplyScalar((-RenderConfig.config.camHeight) / pos.z);
        }
        if (hp.type == HotspotType.air) {
            hp.obj = air.clone();
            pos.multiplyScalar(10 / pos.length());
        }
        if (hp.type == HotspotType.info) {
            hp.obj = info.clone();
            pos.multiplyScalar(10 / pos.length());
        }
        if (hp.type == HotspotType.virtual) {
            hp.obj = virtual.clone();
            pos.copy(hp.pos);
            pos.multiplyScalar(4 / pos.length());
            pos.set(pos.z, -pos.x, pos.y);
        }
        if (hp.obj) {
            hp.obj.position.set(-pos.y, pos.z, pos.x);
            currPano.obj.add(hp.obj);
        }
    }
    update() {
        if (this.transition.transitionParams.transition != 1 || !terrain || !currPano)
            return;
        //cursor
        raycaster.setFromCamera(mousepos, camera);
        const intersects = raycaster.intersectObjects([terrain]);
        if (RenderConfig.config.showCursor && intersects.length) {
            cursor.visible = true;
            cursor.position.copy(intersects[0].point);
        }
        else {
            cursor.visible = false;
        }
        //arrow control
        const sy = RenderConfig.config.isMobile ? -0.4 : -0.6;
        raycaster.setFromCamera({ x: 0, y: sy }, camera);
        control.position.copy(raycaster.ray.direction);
        const uptarget = this.findNearestForward();
        control.visible = !!uptarget;
        if (uptarget) {
            const v = uptarget.position.clone();
            v.y = 0;
            const distance = v.length();
            v.normalize();
            const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), v);
            q.multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0)));
            control.quaternion.copy(q);
            const ls = [];
            ls.push(new Vector3(0, 1, 0).applyQuaternion(q));
            ls.push(new Vector3(-1, 0, 0).applyQuaternion(q));
            ls.push(new Vector3(1, 0, 0).applyQuaternion(q));
            ls.push(new Vector3(0, -1, 0).applyQuaternion(q));
            for (let index = 1; index < 4; index++)
                control.children[index].visible = false;
            control.children[0].userData.target = uptarget;
            for (let index = 1; index < 4; index++) {
                for (const hp of links.filter(x => x.obj && x.type == HotspotType.ground).map(x => x.obj)) {
                    const p = hp.position.clone();
                    if (distance * 2 < p.length())
                        continue;
                    p.normalize();
                    p.projectOnVector(ls[index]);
                    const l = p.length() * p.dot(ls[index]);
                    if (l > 0.8) {
                        control.children[index].visible = true;
                        control.children[index].userData.target = hp;
                    }
                }
            }
        }
        const clickable = this.hotspotRaycast()[0] || {};
        if (clickable.object != clickabletarget) {
            clickabletarget = clickable.object;
            if (clickable.object) {
                const hp = links.find(x => x.obj == clickable.object);
                if (!hp || !hp.name) {
                    clickabletarget = null;
                }
            }
            this.onChangeClickable?.(!!clickabletarget);
        }
        this.onChanged?.();
    }
    worldtoscreen(pos) {
        return pos.clone().project(camera);
    }
    screentoworld(pos) {
        return pos.clone().unproject(camera).normalize();
    }
    getinfopos() {
        const ls = [];
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        for (const item of links.filter(x => x.type != HotspotType.ground)) {
            const obj = item.obj;
            if (frustum.intersectsObject(obj)) {
                const v = this.worldtoscreen(obj.position);
                if (!item.pos2d)
                    item.pos2d = new Vector2();
                item.pos2d.set(Math.ceil(v.x * w / 2 + w / 2), Math.ceil(-v.y * h / 2 + h / 2));
                ls.push(item);
            }
        }
        return ls;
    }
}
//# sourceMappingURL=hotspotmanager.js.map