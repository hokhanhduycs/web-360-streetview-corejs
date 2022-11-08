import { Euler, MathUtils, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import RenderConfig from './renderconfig';
let touchscaling = false;
let touchlast = 0;
const changeEvent = new Event('change');
export class PanoControls extends OrbitControls {
    isLimit;
    onChanged = null;
    constructor(object, domElement) {
        super(object, domElement);
        object.position.set(0, 0, 0.01);
        this.enableDamping = false;
        this.enableZoom = false;
        this.rotateSpeed = -RenderConfig.config.fov / 360;
        // this.rotateSpeed = -this.options.defaultfov/360
        // const v = 2 * Math.atan( Math.tan(this.options.defaultfov*Math.PI/180 / 2) * this.element.clientWidth/this.element.clientHeight)/Math.PI*180
        // console.log(this.options.defaultfov)
        // console.log(v)
        // this.rotateSpeed = -v/this.element.clientWidth*this.element.clientHeight/360
        this.minPolarAngle = Math.PI * 0.1; // radians
        this.maxPolarAngle = Math.PI * 0.9; // radians
        this.isLimit = false;
        this.domElement.addEventListener("touchstart", (event) => this.onTouchStartZoom(event));
        this.domElement.addEventListener("touchmove", (event) => this.onTouchMoveZoom(event));
        this.domElement.addEventListener("touchend", () => this.onTouchEndZoom());
        this.domElement.addEventListener('wheel', (event) => this.onMouseWheel(event));
    }
    limitViewForward(rot) {
        //release limit
        this.minAzimuthAngle = -Infinity; // radians
        this.maxAzimuthAngle = Infinity; // radians
        this.isLimit = rot && Array.isArray(rot) && rot.length == 3;
        //limit hozirontal rot +- 45 degree
        if (this.isLimit) {
            const v = new Vector3(0, 0, -0.1);
            v.applyEuler(new Euler(rot[0], rot[2], rot[1]));
            this.object.position.set(v.x, v.y, v.z);
            this.update();
            const y = this.getAzimuthalAngle();
            this.minAzimuthAngle = y - Math.PI / 4; // radians
            this.maxAzimuthAngle = y + Math.PI / 4; // radians
        }
    }
    lookAt(pos) {
        const v = new Vector3().sub(pos);
        v.multiplyScalar(0.1 / v.length());
        this.object.position.copy(v);
        this.update();
    }
    testRot(y, z) {
        const v = new Vector3(0, 0, -0.1);
        v.applyEuler(new Euler(-y * Math.PI / 180, 0, 0));
        v.applyEuler(new Euler(0, (360 - z) * Math.PI / 180, 0));
        this.object.position.copy(v);
        this.update();
    }
    setDefaultRot(rot) {
        //release limit
        this.minAzimuthAngle = -Infinity; // radians
        this.maxAzimuthAngle = Infinity; // radians
        const v = new Vector3(0, 0, -0.1);
        v.applyEuler(new Euler(-rot.y * Math.PI / 180, 0, 0));
        v.applyEuler(new Euler(0, (360 - rot.z) * Math.PI / 180, 0));
        this.object.position.copy(v);
        this.update();
    }
    onMouseWheel(event) {
        if (!RenderConfig.config.canZoom)
            return;
        const cam = this.object;
        let fov = cam.fov;
        fov += event.deltaY > 0 ? 1 : -1;
        this.updateZoom(fov);
    }
    onTouchStartZoom(event) {
        if (!RenderConfig.config.canZoom)
            return;
        if (event.touches.length == 2) {
            touchscaling = true;
            touchlast = Math.hypot(event.touches[0].pageX - event.touches[1].pageX, event.touches[0].pageY - event.touches[1].pageY);
        }
    }
    onTouchMoveZoom(event) {
        if (!RenderConfig.config.canZoom)
            return;
        const cam = this.object;
        if (event.touches.length == 2 && touchscaling) {
            const dist = Math.hypot(event.touches[0].pageX - event.touches[1].pageX, event.touches[0].pageY - event.touches[1].pageY);
            let fov = cam.fov;
            if (dist - touchlast > 10) {
                fov += 1;
                touchlast = dist;
            }
            else if (dist - touchlast < -10) {
                fov -= 1;
                touchlast = dist;
            }
            this.updateZoom(fov);
        }
    }
    updateZoom(z) {
        if (!RenderConfig.config.canZoom)
            return;
        const cam = this.object;
        cam.fov = MathUtils.clamp(z, RenderConfig.config.minZoom, RenderConfig.config.maxZoom);
        cam.updateProjectionMatrix();
        this.onChanged?.();
    }
    onTouchEndZoom() {
        if (!RenderConfig.config.canZoom)
            return;
        if (touchscaling) {
            touchscaling = false;
        }
    }
}
//# sourceMappingURL=panocontrol.js.map