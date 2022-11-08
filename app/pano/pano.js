import { Euler, Group, Quaternion, Matrix4, PlaneGeometry, MeshBasicMaterial, Mesh, Frustum, TextureLoader, SphereGeometry, DoubleSide, Vector3, Vector2 } from 'three';
import RenderConfig from '../renderconfig';
const frustum = new Frustum();
const textureloader = new TextureLoader();
let lowobj;
let sphereobj;
let cubeobj;
let camera;
let maxAnisotropy = 1;
export default class Pano {
    guid = '';
    name = '';
    fullname = '';
    panotype = 1; //1 is cube 2 is sphere
    quality = 2;
    pos = new Vector3();
    rot = new Vector3();
    links = [];
    obj;
    roomMesh;
    lowReady = false;
    onLoaded = null;
    constructor(cam) {
        camera = cam;
        this.obj = new Group();
        this.quality = 1;
        lowobj = this.createSphere();
        this.obj.add(lowobj);
        sphereobj = new Group();
        cubeobj = new Group();
        this.roomMesh = new Group();
    }
    cleanMaterial(material) {
        material.dispose();
        material.map?.dispose();
    }
    cleanObj(obj) {
        obj.traverse(x => {
            if (x instanceof Mesh) {
                this.cleanMaterial(x.material);
            }
        });
    }
    clear() {
        // this.cleanObj(cubeobj)
        // this.cleanObj(sphereobj)
        this.obj.remove(cubeobj);
        this.obj.remove(sphereobj);
    }
    setMaxAnisotropy(val) {
        maxAnisotropy = val;
    }
    setPanoType(panotype, quality) {
        // if(this.panotype!= panotype || this.quality != quality){
        this.quality = quality;
        this.panotype = panotype;
        this.clear();
        if (this.panotype == 1) {
            let i = 0;
            cubeobj = new Group();
            for (const face of RenderConfig.config.cubeloader.faces) {
                const obj = this.generateCubeRing(face.count, face.angle, i);
                cubeobj.add(obj);
                i += face.count;
            }
            this.obj.add(cubeobj);
            this.roomMesh = cubeobj;
        }
        else if (this.panotype == 2) {
            sphereobj = this.createSphereForZoom(this.quality);
            this.obj.add(sphereobj);
            this.roomMesh = sphereobj;
        }
        // }
    }
    loadPano(data) {
        if (!data.guid) {
            console.log('nodata');
            return;
        }
        this.setPanoType(data.panotype, data.quality);
        data.pos = new Vector3(data.pos.x, data.pos.y, data.pos.z);
        data.rot = new Vector3(data.rot.x, data.rot.y, data.rot.z);
        for (const item of data.links || []) {
            item.pos = new Vector3(item.pos.x, item.pos.y, item.pos.z);
            item.pos2d = new Vector2();
        }
        Object.assign(this, data);
        this.obj.traverse(tile => {
            if (tile instanceof Mesh) {
                const mat = tile.material;
                if (mat.map) {
                    mat.map.dispose();
                }
                tile.visible = false;
                tile.userData.isLow = true;
            }
        });
        this.lowReady = false;
        // this.loadHotspot()
        return this.loadHighTexture(lowobj.children[0]).then(() => {
            this.lowReady = true;
        });
    }
    generateCubeRing(count, angle, basecount) {
        const obj = new Group();
        const sx = 1 + 100 / (99 + this.quality);
        for (let i = 0; i < count; i++) {
            const group = new Group();
            obj.add(group);
            this.createSplitPlane(group, basecount + i);
            group.quaternion.multiply(new Quaternion().setFromEuler(new Euler(0, i * Math.PI * 2 / count, 0)));
            group.quaternion.multiply(new Quaternion().setFromEuler(new Euler(-angle * Math.PI / 180, 0, 0)));
            group.scale.set(sx, sx, sx);
        }
        //for unreal invert y axis(?)
        // obj.rotation.set(0,Math.PI/2,0)
        return obj;
    }
    createSplitPlane(group, face) {
        const opt = RenderConfig.config.cubeloader;
        const width = this.quality;
        const height = this.quality;
        const facesize = RenderConfig.config.viewDistance * 2 * Math.tan(opt.fov / 360 * Math.PI);
        const cropsize = opt.cropscale * facesize;
        const titlesize = cropsize / this.quality;
        const geometry = new PlaneGeometry(titlesize, titlesize, 1, 1);
        geometry.scale(-1, 1, 1);
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const material = new MeshBasicMaterial();
                const plane = new Mesh(geometry, material);
                plane.name = `${this.quality}_${face}_${y}_${x}`;
                plane.position.set(-(x - width / 2 + 0.5) * titlesize, -(y - height / 2 + 0.5) * titlesize, RenderConfig.config.viewDistance);
                // plane.scale.set(titlesize,titlesize,titlesize)
                group.add(plane);
                plane.visible = false;
                plane.userData = {
                    tileX: x,
                    tileY: y,
                    face: face,
                    level: this.quality,
                    isLow: true
                };
                if (this.quality == 1 && this.guid)
                    this.loadHighTexture(plane);
            }
        }
    }
    createSphere() {
        const group = new Group();
        const sx = (1 + 100 / (99 + this.quality)) * 2;
        group.scale.set(sx, sx, sx);
        const geometry = new SphereGeometry(RenderConfig.config.viewDistance, 64, 32);
        geometry.scale(-1, 1, 1);
        const material = new MeshBasicMaterial({ side: DoubleSide });
        const sphere = new Mesh(geometry, material);
        sphere.name = `pano`;
        sphere.rotation.set(0, Math.PI / 2, 0);
        group.add(sphere);
        sphere.userData = {
            isLow: true
        };
        return group;
    }
    createSphereForZoom(tilesRequired) {
        const group = new Group();
        const sx = (1 + 100 / (99 + this.quality)) * 2;
        group.scale.set(sx, sx, sx);
        for (let x = 0; x < tilesRequired * 2; ++x) {
            for (let y = 0; y < tilesRequired; ++y) {
                this.createSphereMeshForTile(group, tilesRequired, x, y);
            }
        }
        //for unreal invert y axis(?)
        group.rotation.set(0, Math.PI / 2, 0);
        return group;
    }
    createSphereMeshForTile(group, tilesRequired, tileX, tileY) {
        const segmentsX = tilesRequired * 2;
        const segmentsY = tilesRequired;
        const phiLength = (Math.PI * 2) / segmentsX;
        const thetaLength = Math.PI / segmentsY;
        const geometry = new SphereGeometry(RenderConfig.config.viewDistance, 64, 32, phiLength * tileX, phiLength, thetaLength * tileY, thetaLength);
        geometry.scale(-1, 1, 1);
        const material = new MeshBasicMaterial();
        const sphere = new Mesh(geometry, material);
        sphere.name = `${tilesRequired}_${tileY}_${tileX}`;
        sphere.userData = {
            tileX: tileX,
            tileY: tileY,
            isLow: true
        };
        group.add(sphere);
    }
    update() {
        if (this.guid && this.lowReady) {
            frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
            this.obj.traverse(tile => {
                if (tile.isObject3D && tile.name && tile.userData && tile.userData.isLow && frustum.intersectsObject(tile))
                    this.loadHighTexture(tile);
            });
        }
    }
    async loadHighTexture(obj) {
        obj.userData.isLow = false;
        const mat = obj.material;
        if (mat.map) {
            mat.map.dispose();
        }
        mat.map = await this.loadTexture(`${RenderConfig.config.baseUrl}/pano${RenderConfig.config.time}/${this.guid}/${obj.name}.jpg`);
        mat.needsUpdate = true;
        obj.visible = true;
        this.onLoaded?.();
    }
    loadTexture(url) {
        return new Promise((rel, rej) => {
            textureloader.load(url, (tex) => {
                tex.anisotropy = maxAnisotropy;
                // tex.minFilter = NearestMipMapLinearFilter 
                // tex.needsUpdate = true
                // console.log(tex)
                rel(tex);
            }, undefined, (e) => { rej(e); });
        });
    }
}
//# sourceMappingURL=pano.js.map