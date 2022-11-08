export default class RenderConfig {
    static config = new RenderConfig();
    baseUrl = '';
    projectId = 'demo';
    viewDistance = 100;
    linkDistance = 2000;
    camHeight = 1.6;
    fov = 60;
    minZoom = 20;
    maxZoom = 100;
    showCursor = false;
    showHotspot = false;
    transitionscale = 2;
    updateOnChange = true;
    autorotdelay = 0;
    canZoom = false;
    isMobile = !matchMedia('(pointer:fine)').matches;
    time = '';
    cubeloader = {
        "fov": 90.0,
        "cropscale": 0.5,
        "faces": [
            { "count": 8, "angle": 0.0 },
            { "count": 8, "angle": 45.0 },
            { "count": 1, "angle": 90.0 },
            { "count": 8, "angle": -45.0 },
            { "count": 1, "angle": -90.0 }
        ]
    };
}
//# sourceMappingURL=renderconfig.js.map