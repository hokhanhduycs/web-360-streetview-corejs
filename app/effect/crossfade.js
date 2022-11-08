import { LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, RGBFormat, Scene, ShaderMaterial, Vector2, WebGLRenderTarget } from "three";
import TWEEN from '@tweenjs/tween.js';
import RenderConfig from "../renderconfig";
class FXScene {
    fbo;
    renderer;
    scene;
    camera;
    constructor(renderer, camera) {
        this.renderer = renderer;
        this.scene = new Scene();
        this.camera = camera;
        const renderTargetParameters = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBFormat };
        this.fbo = new WebGLRenderTarget(window.innerWidth, window.innerHeight, renderTargetParameters);
    }
    cleanMaterial(material) {
        material.dispose();
        material.map?.dispose();
    }
    cleanObj(obj) {
        obj.traverse(x => {
            if (x instanceof Mesh)
                if (x.material) {
                    this.cleanMaterial(x.material);
                }
        });
    }
    clear() {
        this.cleanObj(this.scene);
    }
    render(rtt) {
        // console.log(this.scene.children[0].children.length)
        // this.renderer.setClearColor( this.clearColor );
        if (rtt) {
            this.renderer.setRenderTarget(this.fbo);
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        }
        else {
            this.renderer.setRenderTarget(null);
            this.renderer.render(this.scene, this.camera);
        }
    }
}
const fadematerial = new ShaderMaterial({
    uniforms: {
        tDiffuse1: {
            value: null
        },
        tDiffuse2: {
            value: null
        },
        mixRatio: {
            value: 0.0
        }
    },
    vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        'vUv = vec2( uv.x, uv.y );',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
    ].join('\n'),
    fragmentShader: [
        'uniform float mixRatio;',
        'uniform sampler2D tDiffuse1;',
        'uniform sampler2D tDiffuse2;',
        'varying vec2 vUv;',
        'void main() {',
        '	vec4 texel1 = texture2D( tDiffuse1, vUv );',
        '	vec4 texel2 = texture2D( tDiffuse2, vUv );',
        '		gl_FragColor = mix( texel2, texel1, mixRatio );',
        '}'
    ].join('\n')
});
class TransitionParams {
    'transition' = 1;
}
let currPano;
let fadeobj;
let moveTarget;
class Transition {
    renderer;
    sceneA;
    sceneB;
    scene;
    camera;
    fadetween;
    movetween;
    transitionParams = new TransitionParams();
    moveParams = new TransitionParams();
    onComplete = null;
    isRunning = false;
    constructor(renderer, camera) {
        this.renderer = renderer;
        const size = new Vector2();
        renderer.getSize(size);
        this.scene = new Scene();
        this.sceneA = new FXScene(renderer, camera);
        this.sceneB = new FXScene(renderer, camera);
        this.camera = new OrthographicCamera(size.x / -2, size.x / 2, size.y / 2, size.y / -2, -10, 10);
        const geometry = new PlaneGeometry(window.innerWidth, window.innerHeight);
        const mesh = new Mesh(geometry, fadematerial);
        this.scene.add(mesh);
        fadematerial.uniforms.tDiffuse1.value = this.sceneA.fbo.texture;
        fadematerial.uniforms.tDiffuse2.value = this.sceneB.fbo.texture;
        this.fadetween = new TWEEN.Tween(this.transitionParams).to({ transition: 1 }, 1500).onStart(() => {
            this.sceneA.render(true);
            this.sceneB.render(true);
            this.sceneB.clear();
            // if(fadeobj){
            //     this.sceneB.scene.remove(fadeobj)
            // }
            // currPano.clear()
        }).onComplete(() => {
            this.isRunning = false;
            this.onComplete?.();
        });
        this.movetween = new TWEEN.Tween(this.moveParams).to({ transition: 1 }, 1500).onComplete(() => {
            this.fadetween.start();
        });
        // .repeat( Infinity )
        // .delay( 2000 )
        // .yoyo( true )
        // .start();
    }
    fadeTo(pano) {
        currPano = pano;
        moveTarget = pano.pos.clone();
        fadeobj = pano.roomMesh.clone();
        this.sceneB.scene.add(fadeobj);
        this.transitionParams.transition = 0;
        this.fadetween.start();
        this.isRunning = true;
    }
    moveTo(pano, hp, movetime = 1500, fadetime = 1500) {
        currPano = pano;
        moveTarget = pano.pos.clone();
        const pos = hp.pos.clone();
        // if (hp.type == 1) {
        //     pos.add(new Vector3(0, 0, RenderConfig.config.camHeight))
        // }
        moveTarget.sub(pos);
        moveTarget.multiplyScalar(RenderConfig.config.transitionscale);
        moveTarget.set(-moveTarget.y, moveTarget.z, moveTarget.x);
        // const time = moveTarget.length()*1000
        // const time = 1500
        // moveTarget.set(moveTarget.y,moveTarget.z,-moveTarget.x)   
        // if(fadeobj)
        //     this.sceneB.scene.remove(fadeobj)
        fadeobj = pano.roomMesh.clone();
        this.sceneB.scene.clear();
        this.sceneB.scene.add(fadeobj);
        this.movetween.duration(movetime);
        this.moveParams.transition = 0;
        this.transitionParams.transition = 0;
        this.movetween.duration(fadetime);
        this.movetween.start();
        this.isRunning = true;
    }
    render() {
        // Transition animation
        // TWEEN.update();
        fadematerial.uniforms.mixRatio.value = this.transitionParams.transition;
        if (currPano && this.moveParams.transition != 1 && this.moveParams.transition != 0) {
            fadeobj.position.copy(moveTarget.clone()).multiplyScalar(this.moveParams.transition);
        }
        // Prevent render both scenes when it's not necessary
        if (this.transitionParams.transition == 0) {
            this.sceneB.render(false);
        }
        else if (this.transitionParams.transition == 1) {
            this.sceneA.render(false);
        }
        else {
            // When 0<transition<1 render transition between two scenes
            this.sceneA.render(true);
            // this.sceneB.render( true );
            this.renderer.setRenderTarget(null);
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        }
    }
}
export { FXScene, Transition };
//# sourceMappingURL=crossfade.js.map